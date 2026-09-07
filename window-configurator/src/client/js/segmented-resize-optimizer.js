import * as THREE from 'three';

const DEFAULT_EDGE_EXTENSION_M = 0.013;
const DEFAULT_PROTECTED_END_M = 0.12;
const EPSILON = 1e-7;

const PROFILE_SOURCES = new Set([
    'frame',
    'sash',
    'bead',
    'divider',
    'trans',
    'trans-gasket',
    'gasket',
]);

function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function trackKey(track) {
    return `${finite(track?.start).toFixed(8)}:${finite(track?.end).toFixed(8)}`;
}

function topologyKey(state) {
    if (!state) return '';
    const windows = (state.windows || []).map(cell => [
        String(cell.id || ''),
        String(cell.type || ''),
        String(cell.handleSide || ''),
        finite(cell.rect?.x0).toFixed(8),
        finite(cell.rect?.y0).toFixed(8),
        finite(cell.rect?.x1).toFixed(8),
        finite(cell.rect?.y1).toFixed(8),
    ].join(':')).sort();
    const tracks = ['x', 'y'].map(axis => (
        (state.gridTracks?.[axis] || []).map(trackKey).join(',')
    ));
    const trans = (state.transConnections || []).map(connection => [
        String(connection.cellAId || ''),
        String(connection.cellBId || ''),
        String(connection.ownerCellId || ''),
        connection.enabled === false ? '0' : '1',
    ].join(':')).sort();
    const guides = (state.mergeGuides || []).map(guide => [
        String(guide.orientation || ''),
        finite(guide.coordinate).toFixed(8),
        finite(guide.start).toFixed(8),
        finite(guide.end).toFixed(8),
    ].join(':')).sort();
    return JSON.stringify([windows, tracks, trans, guides]);
}


function sizingKey(state) {
    return ['x', 'y'].map(axis => (
        (state?.gridTracks?.[axis] || []).map(track => finite(track?.sizeM).toFixed(8)).join(',')
    )).join('|');
}

function axisAnchors(state, axis, edgeExtensionM) {
    const tracks = state?.gridTracks?.[axis] || [];
    if (!tracks.length) return null;
    const sizes = tracks.map(track => Math.max(0, finite(track.sizeM)));
    const structuralTotal = sizes.reduce((sum, size) => sum + size, 0);
    if (!(structuralTotal > EPSILON)) return null;

    const anchors = [-(structuralTotal / 2 + edgeExtensionM)];
    let cursor = -structuralTotal / 2;
    for (let index = 0; index < sizes.length - 1; index += 1) {
        cursor += sizes[index];
        anchors.push(cursor);
    }
    anchors.push(structuralTotal / 2 + edgeExtensionM);
    return anchors;
}

function createAxisWarp(baseState, targetState, axis, {
    edgeExtensionM,
    protectedEndM,
}) {
    const oldAnchors = axisAnchors(baseState, axis, edgeExtensionM);
    const newAnchors = axisAnchors(targetState, axis, edgeExtensionM);
    if (!oldAnchors || !newAnchors || oldAnchors.length !== newAnchors.length) return null;

    const radii = oldAnchors.map((anchor, index) => {
        const oldLeft = index > 0 ? Math.abs(anchor - oldAnchors[index - 1]) : Infinity;
        const oldRight = index + 1 < oldAnchors.length ? Math.abs(oldAnchors[index + 1] - anchor) : Infinity;
        const newLeft = index > 0 ? Math.abs(newAnchors[index] - newAnchors[index - 1]) : Infinity;
        const newRight = index + 1 < newAnchors.length ? Math.abs(newAnchors[index + 1] - newAnchors[index]) : Infinity;
        const localGap = Math.min(oldLeft, oldRight, newLeft, newRight);
        return Math.min(protectedEndM, Number.isFinite(localGap) ? localGap * 0.44 : protectedEndM);
    });

    return value => {
        const coordinate = finite(value);

        for (let index = 0; index < oldAnchors.length; index += 1) {
            const delta = coordinate - oldAnchors[index];
            if (Math.abs(delta) <= radii[index] + EPSILON) {
                // The end/joint zone is rigid: translate it without scaling.
                return newAnchors[index] + delta;
            }
        }

        if (coordinate < oldAnchors[0]) {
            return newAnchors[0] + (coordinate - oldAnchors[0]);
        }
        const last = oldAnchors.length - 1;
        if (coordinate > oldAnchors[last]) {
            return newAnchors[last] + (coordinate - oldAnchors[last]);
        }

        for (let index = 0; index < last; index += 1) {
            if (coordinate < oldAnchors[index] || coordinate > oldAnchors[index + 1]) continue;
            const oldStart = oldAnchors[index] + radii[index];
            const oldEnd = oldAnchors[index + 1] - radii[index + 1];
            const newStart = newAnchors[index] + radii[index];
            const newEnd = newAnchors[index + 1] - radii[index + 1];
            if (oldEnd <= oldStart + EPSILON) {
                const t = (coordinate - oldAnchors[index])
                    / Math.max(EPSILON, oldAnchors[index + 1] - oldAnchors[index]);
                return THREE.MathUtils.lerp(newAnchors[index], newAnchors[index + 1], t);
            }
            const t = THREE.MathUtils.clamp((coordinate - oldStart) / (oldEnd - oldStart), 0, 1);
            return THREE.MathUtils.lerp(newStart, newEnd, t);
        }
        return coordinate;
    };
}

function boxFromGeometryWorld(mesh) {
    const geometry = mesh?.geometry;
    if (!geometry?.isBufferGeometry) return null;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox || geometry.boundingBox.isEmpty()) return null;
    return geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
}

function shouldStretchMesh(mesh, worldBox) {
    if (!mesh?.isMesh || !worldBox) return false;
    if (mesh.userData?.windowGlassCellId) return true;
    const source = String(mesh.userData?.componentSelection?.source || '').toLowerCase();
    if (PROFILE_SOURCES.has(source)) return true;

    const size = worldBox.getSize(new THREE.Vector3());
    const major = Math.max(size.x, size.y);
    const minor = Math.max(0.001, Math.min(size.x, size.y));
    return major >= 0.18 && major / minor >= 2.25;
}

function matrixHasPlanarRotation(matrix) {
    const e = matrix.elements;
    const sx = Math.hypot(e[0], e[1], e[2]) || 1;
    const sy = Math.hypot(e[4], e[5], e[6]) || 1;
    const xOffAxis = Math.hypot(e[1] / sx, e[2] / sx);
    const yOffAxis = Math.hypot(e[4] / sy, e[6] / sy);
    return xOffAxis > 1e-4 || yOffAxis > 1e-4;
}

export function createSegmentedResizeOptimizer({
    mainGroup,
    getWindowState,
    getIsExploded = () => false,
    edgeExtensionM = DEFAULT_EDGE_EXTENSION_M,
    protectedEndM = DEFAULT_PROTECTED_END_M,
} = {}) {
    if (!mainGroup) throw new Error('Segmented resize optimizer requires the window main group.');
    if (typeof getWindowState !== 'function') throw new Error('Segmented resize optimizer requires getWindowState().');

    let baseline = null;
    let previewActive = false;

    function clearBaseline() {
        baseline = null;
        previewActive = false;
    }

    function captureBaseline() {
        const state = getWindowState();
        if (!state) return false;
        mainGroup.updateWorldMatrix(true, true);

        const meshes = [];
        let unsupportedRotatedStretchMesh = false;
        mainGroup.traverse(object => {
            if (!object?.isMesh || !object.geometry?.isBufferGeometry) return;
            const position = object.geometry.getAttribute('position');
            if (!position?.array?.length) return;
            const worldBox = boxFromGeometryWorld(object);
            const stretch = shouldStretchMesh(object, worldBox);
            if (stretch && matrixHasPlanarRotation(object.matrixWorld)) {
                unsupportedRotatedStretchMesh = true;
                return;
            }
            const center = worldBox?.getCenter(new THREE.Vector3()) || new THREE.Vector3();
            meshes.push({
                mesh: object,
                geometry: object.geometry,
                position,
                basePositions: new Float32Array(position.array),
                matrixWorld: object.matrixWorld.clone(),
                inverseMatrixWorld: object.matrixWorld.clone().invert(),
                worldCenter: center,
                stretch,
            });
        });

        if (unsupportedRotatedStretchMesh || !meshes.length) {
            clearBaseline();
            return false;
        }

        baseline = {
            state,
            topology: topologyKey(state),
            sizing: sizingKey(state),
            meshes,
        };
        return true;
    }

    function restoreBaselineGeometry() {
        if (!baseline) return;
        for (const record of baseline.meshes) {
            if (record.mesh.geometry !== record.geometry) continue;
            const position = record.geometry.getAttribute('position');
            if (!position || position.array.length !== record.basePositions.length) continue;
            position.array.set(record.basePositions);
            position.needsUpdate = true;
            record.geometry.computeBoundingBox();
            record.geometry.computeBoundingSphere();
        }
        mainGroup.updateWorldMatrix(true, true);
    }

    function previewState(targetState) {
        if (!targetState || getIsExploded()) return false;
        const currentState = getWindowState();
        if (baseline && sizingKey(currentState) !== baseline.sizing) {
            // An exact build/state commit happened since the previous drag.
            // Capture its exact CAD geometry as the new segmented baseline.
            clearBaseline();
        }
        if (!baseline && !captureBaseline()) return false;
        if (topologyKey(targetState) !== baseline.topology) {
            restoreBaselineGeometry();
            clearBaseline();
            return false;
        }

        const warpX = createAxisWarp(baseline.state, targetState, 'x', {
            edgeExtensionM,
            protectedEndM,
        });
        const warpY = createAxisWarp(baseline.state, targetState, 'y', {
            edgeExtensionM,
            protectedEndM,
        });
        if (!warpX || !warpY) return false;

        const local = new THREE.Vector3();
        const world = new THREE.Vector3();
        const warped = new THREE.Vector3();

        for (const record of baseline.meshes) {
            if (record.mesh.geometry !== record.geometry) continue;
            const position = record.geometry.getAttribute('position');
            if (!position || position.array.length !== record.basePositions.length) continue;

            let rigidDeltaX = 0;
            let rigidDeltaY = 0;
            if (!record.stretch) {
                rigidDeltaX = warpX(record.worldCenter.x) - record.worldCenter.x;
                rigidDeltaY = warpY(record.worldCenter.y) - record.worldCenter.y;
            }

            for (let index = 0; index < position.count; index += 1) {
                const offset = index * position.itemSize;
                local.set(
                    record.basePositions[offset],
                    record.basePositions[offset + 1],
                    record.basePositions[offset + 2] || 0
                );
                world.copy(local).applyMatrix4(record.matrixWorld);
                if (record.stretch) {
                    warped.set(warpX(world.x), warpY(world.y), world.z);
                } else {
                    warped.set(world.x + rigidDeltaX, world.y + rigidDeltaY, world.z);
                }
                warped.applyMatrix4(record.inverseMatrixWorld);
                position.setXYZ(index, warped.x, warped.y, warped.z);
            }

            position.needsUpdate = true;
            // The straight middle is transformed affinely. End/joint zones are
            // translated rigidly, so normals remain valid; only culling/raycast
            // bounds need to be refreshed during the interactive preview.
            record.geometry.computeBoundingBox();
            record.geometry.computeBoundingSphere();
        }

        mainGroup.updateWorldMatrix(true, true);
        previewActive = true;
        return true;
    }

    function cancelPreview() {
        if (!previewActive) {
            clearBaseline();
            return;
        }
        restoreBaselineGeometry();
        clearBaseline();
    }

    function commitExactBuild() {
        // buildWindow() replaces/reuses the geometry with the exact CAD result.
        // Drop preview references so the next drag captures that exact result as
        // the new three-section baseline.
        clearBaseline();
    }

    return {
        previewState,
        cancelPreview,
        commitExactBuild,
        isPreviewActive: () => previewActive,
    };
}
