import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function createWindowCameraViewController({ camera, controls }) {
    let lastReportedSide = null;

    function getViewSide() {
        const depth = camera.position.z - controls.target.z;
        if (Math.abs(depth) < 0.02 && lastReportedSide) return lastReportedSide;
        return depth >= 0 ? 'inside' : 'outside';
    }

    function reportViewSide({ force = false } = {}) {
        const side = getViewSide();
        if (!force && side === lastReportedSide) return side;
        lastReportedSide = side;
        window.dispatchEvent(new CustomEvent('window-camera-view-changed', {
            detail: { side },
        }));
        return side;
    }

    function setViewSide(side) {
        if (side !== 'outside' && side !== 'inside') return getViewSide();
        const currentSide = getViewSide();
        if (currentSide === side) {
            reportViewSide({ force: true });
            return currentSide;
        }

        // Move the camera to the opposite side of its current OrbitControls
        // target. The configured window itself never rotates, and the camera
        // keeps its current distance, panning target and vertical angle.
        const offset = camera.position.clone().sub(controls.target);
        if (offset.lengthSq() < 0.000001) {
            offset.set(0, 0, side === 'inside' ? 1 : -1);
        } else {
            offset.x *= -1;
            offset.z *= -1;
        }
        camera.position.copy(controls.target).add(offset);
        controls.update();
        return reportViewSide({ force: true });
    }

    controls.addEventListener('change', () => reportViewSide());
    reportViewSide({ force: true });

    return {
        getViewSide,
        setViewSide,
    };
}

export function createSceneContext({
    container,
    isARMode = false,
    captureMode = false,
}) {
    if (!container) {
        throw new Error('The Three.js canvas container was not found.');
    }

    const scene = new THREE.Scene();
    scene.background = isARMode ? null : new THREE.Color(0xf1f3f5);
    scene.fog = isARMode ? null : new THREE.FogExp2(0xf1f3f5, 0.1);

    const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.05,
        50
    );
    camera.position.set(1.4, 0.9, 2.2);

    const renderer = new THREE.WebGLRenderer({
        antialias: !captureMode,
        alpha: isARMode,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(captureMode ? 1 : Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = !captureMode;
    if (!captureMode) {
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    container.appendChild(renderer.domElement);

    if (isARMode) {
        renderer.xr.enabled = true;
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !captureMode;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controls.enabled = !isARMode;

    const cameraViewController = createWindowCameraViewController({ camera, controls });
    window.WINDOW_CAMERA_VIEW_API = cameraViewController;
    window.dispatchEvent(new CustomEvent('window-camera-view-api-ready', {
        detail: { side: cameraViewController.getViewSide() },
    }));

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0xd9dde1,
        roughness: 0.95,
        metalness: 0,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.2;
    ground.receiveShadow = !captureMode;
    ground.visible = !isARMode;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(30, 30, 0x475569, 0x334155);
    gridHelper.position.y = -1.19;
    gridHelper.visible = !isARMode;
    // Keep the grid disabled by default, matching the previous implementation.
    // scene.add(gridHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const primaryLight = new THREE.DirectionalLight(0xffffff, 1.2);
    primaryLight.position.set(5, 8, 5);
    primaryLight.castShadow = !captureMode;
    primaryLight.shadow.mapSize.width = 2048;
    primaryLight.shadow.mapSize.height = 2048;
    primaryLight.shadow.bias = -0.0002;
    scene.add(primaryLight);

    const fillLight = new THREE.DirectionalLight(0x3b82f6, 0.5);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);

    return {
        scene,
        camera,
        renderer,
        controls,
        ground,
        gridHelper,
    };
}
