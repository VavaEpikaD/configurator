import * as THREE from 'three';
import { createWindowBuilder as createBaseWindowBuilder } from './window-builder.js?window-dimensions-base=1';

const DIMENSION_LINE_COLOUR = 0x38bdf8;
const DIMENSION_OUTWARD_OFFSET_M = 0.09;
const OUTSIDE_EPSILON_M = 1e-5;

function isDimensionLine(object) {
    return Boolean(
        object?.isLine
        && object.material?.color?.getHex?.() === DIMENSION_LINE_COLOUR
    );
}

function isDimensionGroup(group) {
    if (!group?.isGroup) return false;
    const lineCount = group.children.filter(isDimensionLine).length;
    const labelCount = group.children.filter(child => child?.isSprite).length;
    return lineCount >= 3 && labelCount >= 2;
}

export function createWindowBuilder(options) {
    const builder = createBaseWindowBuilder(options);
    const mainGroup = builder?.mainGroup;
    let dimensionsVisible = true;
    let syncQueued = false;

    function getOuterFrameBounds() {
        if (!mainGroup) return null;
        mainGroup.updateWorldMatrix(true, true);
        const inverseRootMatrix = new THREE.Matrix4().copy(mainGroup.matrixWorld).invert();
        const bounds = new THREE.Box3();
        let foundFrame = false;

        mainGroup.traverse(child => {
            if (!child?.isMesh || !child.geometry) return;
            const selection = child.userData?.componentSelection || {};
            if (String(selection.source || '').toLowerCase() !== 'frame') return;
            if (!child.userData?.frameSegment) return;

            if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
            if (!child.geometry.boundingBox || child.geometry.boundingBox.isEmpty()) return;

            const localBox = child.geometry.boundingBox.clone();
            const toRootLocal = new THREE.Matrix4().multiplyMatrices(
                inverseRootMatrix,
                child.matrixWorld
            );
            localBox.applyMatrix4(toRootLocal);
            if (!foundFrame) {
                bounds.copy(localBox);
                foundFrame = true;
            } else {
                bounds.union(localBox);
            }
        });

        if (!foundFrame || bounds.isEmpty()) return null;
        return {
            minX: bounds.min.x,
            maxX: bounds.max.x,
            minY: bounds.min.y,
            maxY: bounds.max.y,
        };
    }

    function getOutsideShift(minX, maxX, minY, maxY, bounds) {
        let x = 0;
        let y = 0;
        if (maxX < bounds.minX - OUTSIDE_EPSILON_M) x = -DIMENSION_OUTWARD_OFFSET_M;
        else if (minX > bounds.maxX + OUTSIDE_EPSILON_M) x = DIMENSION_OUTWARD_OFFSET_M;
        if (maxY < bounds.minY - OUTSIDE_EPSILON_M) y = -DIMENSION_OUTWARD_OFFSET_M;
        else if (minY > bounds.maxY + OUTSIDE_EPSILON_M) y = DIMENSION_OUTWARD_OFFSET_M;
        return { x, y };
    }

    function shiftDimensionLine(line, bounds) {
        const position = line?.geometry?.getAttribute?.('position');
        if (!position?.count) return false;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (let index = 0; index < position.count; index += 1) {
            const x = position.getX(index);
            const y = position.getY(index);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }

        const shift = getOutsideShift(minX, maxX, minY, maxY, bounds);
        if (!shift.x && !shift.y) return false;

        for (let index = 0; index < position.count; index += 1) {
            position.setXY(
                index,
                position.getX(index) + shift.x,
                position.getY(index) + shift.y
            );
        }
        position.needsUpdate = true;
        line.geometry.computeBoundingBox?.();
        line.geometry.computeBoundingSphere?.();
        return true;
    }

    function shiftDimensionLabel(label, bounds) {
        const x = Number(label?.position?.x);
        const y = Number(label?.position?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        const shift = getOutsideShift(x, x, y, y, bounds);
        if (!shift.x && !shift.y) return false;
        label.position.x += shift.x;
        label.position.y += shift.y;
        return true;
    }

    function applyDimensionOutwardOffset(group) {
        if (group?.userData?.windowDimensionOutwardOffsetApplied === true) return;
        const bounds = getOuterFrameBounds();
        if (!bounds) return;

        let moved = false;
        group.children.forEach(child => {
            if (isDimensionLine(child)) {
                moved = shiftDimensionLine(child, bounds) || moved;
            } else if (child?.isSprite) {
                moved = shiftDimensionLabel(child, bounds) || moved;
            }
        });
        if (moved) group.userData.windowDimensionOutwardOffsetApplied = true;
    }

    function getDimensionGroups() {
        return (mainGroup?.children || []).filter(group => {
            if (group?.userData?.windowDimensionOverlay === true) return true;
            if (!isDimensionGroup(group)) return false;
            group.userData.windowDimensionOverlay = true;
            return true;
        });
    }

    function applyDimensionsVisibility() {
        getDimensionGroups().forEach(group => {
            applyDimensionOutwardOffset(group);
            group.visible = dimensionsVisible;
        });
        return dimensionsVisible;
    }

    function queueDimensionsVisibilitySync() {
        if (syncQueued) return;
        syncQueued = true;
        queueMicrotask(() => {
            syncQueued = false;
            applyDimensionsVisibility();
        });
    }

    // Dimension guides are recreated whenever the Window geometry is rebuilt.
    // Observe only additions to the Window root group so the display preference
    // and the extra outward clearance are reapplied after every rebuild,
    // including rebuilds initiated internally by the CAD/profile controller.
    if (mainGroup?.add) {
        const baseAdd = mainGroup.add.bind(mainGroup);
        mainGroup.add = (...objects) => {
            const result = baseAdd(...objects);
            queueDimensionsVisibilitySync();
            return result;
        };
    }

    function setVisible(value) {
        dimensionsVisible = Boolean(value);
        applyDimensionsVisibility();
        window.dispatchEvent(new CustomEvent('window-dimensions-visibility-changed', {
            detail: { visible: dimensionsVisible },
        }));
        return dimensionsVisible;
    }

    const dimensionsApi = Object.freeze({
        getVisible: () => dimensionsVisible,
        setVisible,
        toggle: () => setVisible(!dimensionsVisible),
    });

    window.WINDOW_DIMENSIONS_API = dimensionsApi;
    window.dispatchEvent(new CustomEvent('window-dimensions-api-ready', {
        detail: { visible: dimensionsVisible },
    }));

    return builder;
}
