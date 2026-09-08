import * as THREE from 'three';
import { getHouseDimensions } from './house-config.js';
import { getWindowLocale } from './i18n.js';

// Resolve the tree relative to this module instead of the website root.
// Local dev loads this module from /js/, while production mounts the
// configurator below /window-configurator/ (and localized aliases).
const TREE_MODEL_URLS = Object.freeze([
    new URL('../assets/models/environment/tree.glb', import.meta.url).href,
]);
const TREE_TARGET_HEIGHTS_M = Object.freeze([2.45, 2.8]);
const ENVIRONMENT_LABELS = Object.freeze({
    'en-US': 'Environment',
    'ro-RO': 'Mediu',
    'de-DE': 'Umgebung',
});

/**
 * Creates the optional contextual environment around the configured window.
 *
 * The previous implementation built a complete house and rotated the complete
 * window assembly by 180 degrees whenever the environment was enabled. The
 * environment is now deliberately lightweight: one front wall containing the
 * configured window opening, plus two shared background trees. The window keeps
 * its authored orientation at all times.
 */
export function createHouseBuilder({
    scene,
    ground,
    gridHelper,
    isARMode = false,
    captureMode = false,
}) {
    const houseGroup = new THREE.Group();
    houseGroup.name = 'windowEnvironmentRoot';

    const wallGroup = new THREE.Group();
    wallGroup.name = 'windowEnvironmentWall';

    const treesGroup = new THREE.Group();
    treesGroup.name = 'windowEnvironmentTrees';

    houseGroup.add(wallGroup, treesGroup);
    scene.add(houseGroup);

    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0xf2f2f0,
        roughness: 0.92,
        metalness: 0,
        side: THREE.DoubleSide,
    });
    const outlineMaterial = new THREE.LineBasicMaterial({
        color: 0xa8adb3,
    });

    let currentWallGeometry = null;
    let currentWallEdges = null;
    let treeSource = null;
    let treeLoadStarted = false;
    let treeInstances = [];
    let lastEnvironmentLayout = null;

    function syncEnvironmentToggleLabel() {
        const toggle = document.getElementById('cShowHouse');
        const label = toggle?.closest('.action-box')?.querySelector(':scope > label:first-child');
        if (!label) return;
        label.textContent = ENVIRONMENT_LABELS[getWindowLocale()] || ENVIRONMENT_LABELS['en-US'];
    }

    syncEnvironmentToggleLabel();
    globalThis.window?.addEventListener('window-locale-applied', () => {
        // Locale application rewrites the legacy "Show house" text first.
        // Apply the environment name immediately afterwards.
        queueMicrotask(syncEnvironmentToggleLabel);
    });

    function disposeWallGeometry() {
        currentWallEdges?.dispose?.();
        currentWallGeometry?.dispose?.();
        currentWallEdges = null;
        currentWallGeometry = null;
        wallGroup.clear();
    }

    function cloneTreeSource() {
        if (!treeSource) return null;
        const clone = treeSource.clone(true);
        clone.traverse(child => {
            if (!child?.isMesh) return;
            child.castShadow = !captureMode;
            child.receiveShadow = !captureMode;
        });
        return clone;
    }

    function fitTreeToHeight(tree, targetHeight) {
        tree.updateMatrixWorld(true);
        const initialBox = new THREE.Box3().setFromObject(tree);
        const initialHeight = Math.max(0.0001, initialBox.max.y - initialBox.min.y);
        tree.scale.multiplyScalar(targetHeight / initialHeight);
        tree.updateMatrixWorld(true);

        const fittedBox = new THREE.Box3().setFromObject(tree);
        const center = fittedBox.getCenter(new THREE.Vector3());
        tree.position.x -= center.x;
        tree.position.z -= center.z;
        tree.position.y -= fittedBox.min.y;
        tree.updateMatrixWorld(true);
    }

    function rebuildTrees() {
        treesGroup.clear();
        treeInstances = [];
        if (!treeSource || !lastEnvironmentLayout) return;

        const { wallWidth, floorY } = lastEnvironmentLayout;
        const placements = [
            {
                x: -wallWidth / 2 - 1.15,
                y: floorY,
                z: -2.8,
                rotationY: 0.42,
                height: TREE_TARGET_HEIGHTS_M[0],
            },
            {
                x: wallWidth / 2 + 1.25,
                y: floorY,
                z: -3.15,
                rotationY: -0.58,
                height: TREE_TARGET_HEIGHTS_M[1],
            },
        ];

        placements.forEach((placement, index) => {
            const tree = cloneTreeSource();
            if (!tree) return;
            tree.name = `windowEnvironmentTree${index + 1}`;
            fitTreeToHeight(tree, placement.height);
            tree.position.add(new THREE.Vector3(placement.x, placement.y, placement.z));
            tree.rotation.y = placement.rotationY;
            tree.updateMatrixWorld(true);
            treesGroup.add(tree);
            treeInstances.push(tree);
        });
    }

    async function ensureTreesLoaded() {
        if (treeLoadStarted || treeSource) return;
        treeLoadStarted = true;
        let lastError = null;
        let GLTFLoader = null;

        try {
            // The window runtime vendors only the Three.js addons it already
            // needs, so there is no local lib/loaders/GLTFLoader.js to resolve.
            // Reuse the same pinned loader source already used by ar-export.js
            // instead of making the whole configurator fail at module load time.
            ({ GLTFLoader } = await import(
                'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js'
            ));
        } catch (error) {
            console.warn('Environment tree loader could not be loaded.', error);
            return;
        }

        const loader = new GLTFLoader();

        for (const url of TREE_MODEL_URLS) {
            try {
                const gltf = await loader.loadAsync(url);
                treeSource = gltf?.scene || null;
                if (treeSource) {
                    rebuildTrees();
                    return;
                }
            } catch (error) {
                lastError = error;
            }
        }

        console.warn('Environment trees could not be loaded from the shared tree asset.', lastError);
    }

    function buildWall(windowWidth, windowHeight, wallWidth, wallHeight, wallThickness) {
        disposeWallGeometry();

        const floorY = -wallHeight / 2;
        const wallTopY = floorY + wallHeight;
        const wallMinX = -wallWidth / 2;
        const wallMaxX = wallWidth / 2;

        const wallShape = new THREE.Shape();
        wallShape.moveTo(wallMinX, floorY);
        wallShape.lineTo(wallMaxX, floorY);
        wallShape.lineTo(wallMaxX, wallTopY);
        wallShape.lineTo(wallMinX, wallTopY);
        wallShape.closePath();

        const opening = new THREE.Path();
        opening.moveTo(-windowWidth / 2, -windowHeight / 2);
        opening.lineTo(windowWidth / 2, -windowHeight / 2);
        opening.lineTo(windowWidth / 2, windowHeight / 2);
        opening.lineTo(-windowWidth / 2, windowHeight / 2);
        opening.closePath();
        wallShape.holes.push(opening);

        currentWallGeometry = new THREE.ExtrudeGeometry(wallShape, {
            depth: wallThickness,
            bevelEnabled: false,
            curveSegments: 1,
            steps: 1,
        });
        currentWallEdges = new THREE.EdgesGeometry(currentWallGeometry);

        const wall = new THREE.Mesh(currentWallGeometry, wallMaterial);
        wall.name = 'windowEnvironmentSingleWall';
        wall.position.z = -wallThickness / 2;
        wall.castShadow = !captureMode;
        wall.receiveShadow = !captureMode;

        const outline = new THREE.LineSegments(currentWallEdges, outlineMaterial);
        outline.name = 'windowEnvironmentWallOutline';
        wall.add(outline);
        wallGroup.add(wall);

        return floorY;
    }

    function buildHouse(A, B) {
        syncEnvironmentToggleLabel();

        const showEnvironment = document.getElementById('cShowHouse')?.checked === true;

        // Environment mode no longer changes placementRoot.rotation. Keeping the
        // window at its normal rotation removes the old 180° spin/flip entirely.
        if (isARMode || !showEnvironment) {
            houseGroup.visible = false;
            ground.position.y = -1.2;
            gridHelper.position.y = -1.19;
            return;
        }

        houseGroup.visible = true;

        const windowWidth = Math.max(0.1, Number(A) || 0.1);
        const windowHeight = Math.max(0.1, Number(B) || 0.1);
        const baseDimensions = getHouseDimensions(windowWidth, windowHeight);

        // Keep a useful amount of visible wall around even the largest layouts.
        const wallWidth = Math.max(baseDimensions.width, windowWidth + 1.2);
        const wallHeight = Math.max(baseDimensions.wallHeight, windowHeight + 1.0);
        const wallThickness = baseDimensions.wallThickness;
        const floorY = buildWall(
            windowWidth,
            windowHeight,
            wallWidth,
            wallHeight,
            wallThickness
        );

        ground.position.y = floorY;
        gridHelper.position.y = floorY + 0.005;

        lastEnvironmentLayout = { wallWidth, wallHeight, floorY };
        if (treeSource) {
            rebuildTrees();
        } else {
            ensureTreesLoaded();
        }
    }

    return {
        buildHouse,
        houseGroup,
    };
}
