// Three.js Scene Setup
let scene, camera, renderer, model, controls;
let depthMaterial, depthRenderTarget;
const canvas3D = document.getElementById('canvas-3d');
const canvasDepth = document.getElementById('canvas-depth');

// Initialize Three.js
function initThreeJS() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f7fa);

    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        canvas3D.clientWidth / canvas3D.clientHeight,
        0.1,
        10000
    );
    updateCameraDistance(10);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas3D, antialias: true });
    renderer.setSize(canvas3D.clientWidth, canvas3D.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    window.lightRef = directionalLight;

    // Setup depth rendering
    setupDepthRendering();

    // Animation loop
    animate();
}

function setupDepthRendering() {
    // Create render target for depth
    depthRenderTarget = new THREE.WebGLRenderTarget(1024, 1024);

    // Depth material for rendering
    depthMaterial = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
    });
}

function updateCameraDistance(distance) {
    camera.position.set(distance * 0.8, distance * 0.7, distance);
    camera.lookAt(0, 0, 0);
}

// Model Loading
const fileInput = document.getElementById('file-input');

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        loadModel(file.name, event.target.result);
    };
    reader.readAsArrayBuffer(file);
});

function loadModel(filename, data) {
    const ext = filename.split('.').pop().toLowerCase();
    const statusDiv = document.getElementById('file-status');

    try {
        if (ext === 'stl') {
            loadSTL(data, statusDiv);
        } else if (ext === 'glb' || ext === 'gltf') {
            loadGLTF(data, filename, statusDiv);
        } else {
            showStatus('Invalid file format', 'error', statusDiv);
        }
    } catch (error) {
        showStatus('Error loading file: ' + error.message, 'error', statusDiv);
        console.error(error);
    }
}

function loadSTL(data, statusDiv) {
    const geometry = new STLLoader().parse(data);
    geometry.computeBoundingBox();
    geometry.center();

    if (model) {
        scene.remove(model);
    }

    const material = new THREE.MeshPhongMaterial({ color: 0x888888 });
    model = new THREE.Mesh(geometry, material);
    scene.add(model);

    showStatus('STL model loaded successfully!', 'success', statusDiv);
}

function loadGLTF(data, filename, statusDiv) {
    const loader = new GLTFLoader();
    loader.parse(
        data,
        '',
        (gltf) => {
            if (model) {
                scene.remove(model);
            }

            model = gltf.scene;
            scene.add(model);

            // Center and scale the model
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);

            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 5 / maxDim;
            model.scale.multiplyScalar(scale);

            showStatus('GLTF model loaded successfully!', 'success', statusDiv);
        },
        (error) => {
            showStatus('Error loading GLTF: ' + error.message, 'error', statusDiv);
            console.error(error);
        }
    );
}

// Control Handlers
document.getElementById('rotate-x').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById('rotate-x-value').textContent = value + '°';
    updateModelRotation();
});

document.getElementById('rotate-y').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById('rotate-y-value').textContent = value + '°';
    updateModelRotation();
});

document.getElementById('rotate-z').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById('rotate-z-value').textContent = value + '°';
    updateModelRotation();
});

document.getElementById('light-intensity').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById('light-intensity-value').textContent = value.toFixed(1);
    if (window.lightRef) {
        window.lightRef.intensity = value;
    }
});

document.getElementById('camera-distance').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById('camera-distance-value').textContent = value;
    updateCameraDistance(value);
});

function updateModelRotation() {
    if (!model) return;

    const x = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rotate-x').value));
    const y = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rotate-y').value));
    const z = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rotate-z').value));

    model.rotation.order = 'XYZ';
    model.rotation.x = x;
    model.rotation.y = y;
    model.rotation.z = z;
}

document.getElementById('reset-view').addEventListener('click', () => {
    document.getElementById('rotate-x').value = 45;
    document.getElementById('rotate-y').value = 45;
    document.getElementById('rotate-z').value = 0;
    document.getElementById('light-intensity').value = 1;
    document.getElementById('camera-distance').value = 10;

    document.getElementById('rotate-x-value').textContent = '45°';
    document.getElementById('rotate-y-value').textContent = '45°';
    document.getElementById('rotate-z-value').textContent = '0°';
    document.getElementById('light-intensity-value').textContent = '1.0';
    document.getElementById('camera-distance-value').textContent = '10';

    updateModelRotation();
    updateCameraDistance(10);
    if (window.lightRef) {
        window.lightRef.intensity = 1;
    }
});

// Chromadepth Generation
document.getElementById('generate-chromadepth').addEventListener('click', generateChromadepth);

function generateChromadepth() {
    if (!model) {
        showStatus('Please load a model first!', 'error', document.getElementById('chromadepth-status'));
        return;
    }

    const statusDiv = document.getElementById('chromadepth-status');
    showStatus('Generating chromadepth visualization...', 'info', statusDiv);

    try {
        // Render depth map
        const depthTexture = renderDepthMap();
        
        // Convert to chromadepth colors
        convertToChromadepth(depthTexture);
        
        showStatus('Chromadepth generated successfully!', 'success', statusDiv);
    } catch (error) {
        showStatus('Error generating chromadepth: ' + error.message, 'error', statusDiv);
        console.error(error);
    }
}

function renderDepthMap() {
    // Swap materials to depth material
    const originalMaterials = [];
    model.traverse((child) => {
        if (child.isMesh) {
            originalMaterials.push(child.material);
            child.material = depthMaterial;
        }
    });

    // Render to texture
    renderer.setRenderTarget(depthRenderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    // Restore materials
    let index = 0;
    model.traverse((child) => {
        if (child.isMesh) {
            child.material = originalMaterials[index];
            index++;
        }
    });

    return depthRenderTarget.texture;
}

function convertToChromadepth(depthTexture) {
    const width = depthRenderTarget.width;
    const height = depthRenderTarget.height;

    // Read pixels from depth texture
    const pixels = new Uint8Array(width * height * 4);
    const gl = renderer.getContext();
    renderer.setRenderTarget(depthRenderTarget);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    renderer.setRenderTarget(null);

    // Apply chromadepth palette
    const chromadepthPixels = new Uint8Array(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) {
        // Use red channel as depth (depth is encoded in red)
        const depth = pixels[i]; // Red channel
        const chromaColor = getChromadepthColor(depth);

        chromadepthPixels[i] = chromaColor.r;
        chromadepthPixels[i + 1] = chromaColor.g;
        chromadepthPixels[i + 2] = chromaColor.b;
        chromadepthPixels[i + 3] = 255; // Alpha
    }

    // Display on canvas
    const ctx = canvasDepth.getContext('2d');
    canvasDepth.width = width;
    canvasDepth.height = height;

    const imageData = ctx.createImageData(width, height);
    imageData.data.set(chromadepthPixels);
    ctx.putImageData(imageData, 0, 0);

    // Store for download
    window.chromadepthImageData = imageData;
}

// Download handlers
document.getElementById('download-chromadepth').addEventListener('click', () => {
    if (!window.chromadepthImageData) {
        showStatus('Generate chromadepth first!', 'error', document.getElementById('chromadepth-status'));
        return;
    }

    const link = document.createElement('a');
    link.href = canvasDepth.toDataURL('image/png');
    link.download = 'chromadepth-visualization.png';
    link.click();
});

document.getElementById('download-depth-map').addEventListener('click', () => {
    if (!model) {
        showStatus('Load a model first!', 'error', document.getElementById('chromadepth-status'));
        return;
    }

    // Render depth map in grayscale for download
    const originalMaterials = [];
    model.traverse((child) => {
        if (child.isMesh) {
            originalMaterials.push(child.material);
            child.material = depthMaterial;
        }
    });

    renderer.setRenderTarget(depthRenderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    let index = 0;
    model.traverse((child) => {
        if (child.isMesh) {
            child.material = originalMaterials[index];
            index++;
        }
    });

    const link = document.createElement('a');
    link.href = renderer.domElement.toDataURL('image/png');
    link.download = 'depth-map.png';
    link.click();
});

// Utility function
function showStatus(message, type, element) {
    element.className = 'status ' + type;
    element.textContent = message;
}

// Handle window resize
window.addEventListener('resize', () => {
    const width = canvas3D.clientWidth;
    const height = canvas3D.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Initialize
initThreeJS();
