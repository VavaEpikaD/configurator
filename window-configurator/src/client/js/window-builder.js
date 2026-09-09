import * as THREE from 'three';
import { createWindowGeometry } from './window-geometry.js?v=uv-8';
import { WINDOW_WIDTH_MAX_M, normalizeHexColour } from './config.js';
import {
    PROFILE_CURVE_SEGMENTS,
    createRoundedRectShape,
} from './geometry-utils.js?v=uv-8';
import { getHouseDimensions } from './house-config.js';
import { getProfileCatalogEntry, isDrainageCapProfile } from './profile-catalog.js';
import { translateCadTransformSource } from './profile-coordinate-transform.js';
import { createHouseBuilder } from './house-builder.js?v=uv-8';
import {
    getDividerSegmentAlongCoordinate,
    getDividerCrossSectionMetrics,
    getFixedGlassPanePlacement,
    getHorizontalConnectionFaceDirection,
    getTopFixedBottomSashSashLayout,
    getFrameDividerSocketInset,
    getFrameHalfFrameSocketInset,
    getFrameDividerMiterContactStart,
    getFrameGridMiterInset,
    getFrameMixedPlusMiterInset,
    getFrameShiftedDividerSocketInset,
    getFrameReentrantMiterInset,
    getFrameSidePlacements,
    getLinearDividerLayout,
    getEditableWindowTopologyGeometry,
    getEditableCellInteriorPlacement,
    getEditableDividerSegmentPlacement,
    getEditableReentrantFramePlacement,
    getEditableFixedGlazingDividerCadTransform,
    getReentrantFillerTriangle,
    getHalfFrameTriangle,
    getInsideHalfFrameTriangle,
    getHalfMullionTriangle,
    getFrameInsideHalfFrameInset,
    getRectangularDividerEndNotchInset,
    INTERSECTION_MULLION_END_NOTCH_DEPTH_M,
    INTERSECTION_MULLION_END_NOTCH_LENGTH_M,
    RECTANGULAR_DIVIDER_SETBACK_M,
} from './window-layout-geometry.js';
import {
    getDividerConnectionVariantKey,
    getTransOwnerHandleSide,
} from './window-layout-state.js';
import { isComponentProfileVisibleOnHost } from './component-group-visibility.js';

const S = 0.001;
const NOMINAL_OUTER_FRAME_FACE_M = 0.057;

export function createWindowBuilder({
    scene,
    camera,
    renderer = null,
    geometryLibrary = null,
    ground,
    gridHelper,
    isARMode,
    captureMode,
    pageParams,
    componentSelection,
    glassMat,
    handleMat,
    profileInput,
    glassThicknessInput,
    glassThicknessLabel,
    isGlazingBeadProfile,
    getProfileGroup,
    getProfileShape,
    getProfileCadXShiftMm,
    getProfileCadYShiftMm = () => 0,
    getProfileCadPointMm = (profile, svgX, svgY) => ({
        x: Number(svgX) + getProfileCadXShiftMm(profile),
        y: -Number(svgY) + getProfileCadYShiftMm(profile),
    }),
    getActiveGlazingBeadCode,
    getActiveGasketCode,
    getProfileComponentNumber,
    getEffectiveProfileBbox,
    updateComponentPictures,
    getFinishState,
    getSelectedHandleSide,
    onGlassClick = () => { },
    onFabricationSnapshot = () => { },
    isProfileEnabled = () => true,
    isProfileGroupVisible = () => true,
    canPlaceProfileOnSide = () => true,
    getWindowLayoutState = () => ({
        layoutId: 'single',
        dividerOrientation: null,
        dividerProfileId: null,
    }),
}) {
    const geometry = createWindowGeometry(geometryLibrary, { captureMode });
    let currentMetadata = null;
    let profilesData = [];
    let sectionSampleMetadata = null;
    let sectionSampleProfilesData = [];

    // EXPLOSION REGISTER
    let isExploded = (isARMode && pageParams.get('explode') === '1') || document.getElementById('cExplode').checked;
    let explodeProgress = 0;
    let explodableObjects = [];
    let editableTopologyGeometry = null;
    let selectedGlassCellId = null;
    const glassNumberSprites = new Map();
    let lastFabricationSnapshot = null;
    let explodeCellAnchors = new Map();
    let explodeDividerChainAnchors = new Map();
    let explodeTransAnchors = new Map();

    function registerExplode(obj, dx, dy, dz) {
        obj.userData.basePos = obj.position.clone();
        obj.userData.explodeDir = new THREE.Vector3(dx, dy, dz);
        explodableObjects.push(obj);
    }

    const EXPLODE_CENTER_EPSILON = 1e-6;
    const EXPLODE_COLLISION_EPSILON = 0.004;
    const EXPLODE_COLLISION_LANE_GAP = 0.04;
    const EXPLODE_WINDOW_SCALE_FACTOR = 1.5;
    const EXPLODE_WINDOW_CENTER_SHIFT_FACTOR = EXPLODE_WINDOW_SCALE_FACTOR - 1;
    const EXPLODE_LAYER_ORDER = Object.freeze(['structure', 'sash', 'glass', 'bead']);
    const EXPLODE_LAYER_BASE_DISTANCE = Object.freeze({
        // The structural skeleton first spreads according to the enlarged bay
        // centers. Additional local branching happens in later layers.
        structure: 0.0,
        sash: 0.12,
        glass: 0.09,
        bead: 0.14,
    });
    const EXPLODE_LAYER_Z = Object.freeze({
        structure: 0.0,
        sash: 0.25,
        glass: 0.5,
        bead: 0.75,
    });

    function resetExplodeAnchors() {
        explodeCellAnchors = new Map();
        explodeDividerChainAnchors = new Map();
        explodeTransAnchors = new Map();
    }

    function setExplodeCellAnchor(cell) {
        if (!cell?.id) return;
        explodeCellAnchors.set(String(cell.id), Object.freeze({
            x: Number(cell.centerX) || 0,
            y: Number(cell.centerY) || 0,
            width: Number(cell.width) || 0,
            height: Number(cell.height) || 0,
        }));
    }

    function getExplodeCellAnchor(cellId) {
        if (!cellId && cellId !== 0) return null;
        return explodeCellAnchors.get(String(cellId)) || null;
    }

    function getExplodeAssemblyAnchor(assembly) {
        const primaryData = assembly?.primary?.object?.userData || {};
        const transAnchor = getExplodeTransAnchor(primaryData.transSegmentId);
        if (transAnchor) return { x: transAnchor.x, y: transAnchor.y };
        const candidateCellId = primaryData.windowGlassCellId || primaryData.windowCell || primaryData.transOwnerCellId || null;
        const cellAnchor = getExplodeCellAnchor(candidateCellId);
        if (cellAnchor) return { x: cellAnchor.x, y: cellAnchor.y };
        const boxCenter = assembly?.box?.getCenter(new THREE.Vector3());
        if (boxCenter) return { x: boxCenter.x, y: boxCenter.y };
        return { x: 0, y: 0 };
    }

    function getExplodeSideVector(sideKey) {
        if (sideKey === 'left') return new THREE.Vector2(-1, 0);
        if (sideKey === 'right') return new THREE.Vector2(1, 0);
        if (sideKey === 'top') return new THREE.Vector2(0, 1);
        if (sideKey === 'bottom') return new THREE.Vector2(0, -1);
        return new THREE.Vector2(0, 0);
    }

    function getExplodeCenterVector(anchor, configurationCenter) {
        const dx = Number(anchor?.x) - Number(configurationCenter?.x || 0);
        const dy = Number(anchor?.y) - Number(configurationCenter?.y || 0);
        const vector = new THREE.Vector2(dx, dy);
        if (vector.lengthSq() <= EXPLODE_CENTER_EPSILON * EXPLODE_CENTER_EPSILON) {
            return new THREE.Vector2(0, 0);
        }
        return vector.normalize();
    }

    function getExplodeLayerBranchVector(assembly, anchor, configurationCenter) {
        if (!assembly) return new THREE.Vector2(0, 0);
        if (assembly.layer === 'structure') return new THREE.Vector2(0, 0);
        if (assembly.layer === 'glass') {
            return getExplodeCenterVector(anchor, configurationCenter);
        }
        const sideVector = getExplodeSideVector(assembly.sideKey);
        if (sideVector.lengthSq() > 0) return sideVector;
        const assemblyCenter = assembly?.box?.getCenter(new THREE.Vector3());
        if (!assemblyCenter) return new THREE.Vector2(0, 0);
        const vector = new THREE.Vector2(
            assemblyCenter.x - Number(anchor?.x || 0),
            assemblyCenter.y - Number(anchor?.y || 0)
        );
        if (vector.lengthSq() <= EXPLODE_CENTER_EPSILON * EXPLODE_CENTER_EPSILON) {
            return getExplodeCenterVector(anchor, configurationCenter);
        }
        return vector.normalize();
    }

    function smoothExplodeRange(value, start, end) {
        if (value <= start) return 0;
        if (value >= end) return 1;
        const t = (value - start) / Math.max(1e-6, end - start);
        return t * t * (3 - 2 * t);
    }

    function getExplodeProgressFactors(progress, layer) {
        const p = THREE.MathUtils.clamp(progress, 0, 1);
        return {
            base: smoothExplodeRange(p, 0.0, 0.45),
            layer: layer === 'structure'
                ? smoothExplodeRange(p, 0.45, 0.55)
                : layer === 'sash'
                    ? smoothExplodeRange(p, 0.55, 0.72)
                    : layer === 'glass'
                        ? smoothExplodeRange(p, 0.72, 0.87)
                        : smoothExplodeRange(p, 0.87, 1.0),
        };
    }

    function applyExplodeTransforms(progress) {
        const explodeT = THREE.MathUtils.clamp(progress, 0, 1);
        explodableObjects.forEach(object => {
            const basePos = object?.userData?.basePos;
            if (!basePos) return;
            const baseVector = object?.userData?.explodeBaseDir || new THREE.Vector3();
            const layerVector = object?.userData?.explodeLayerDir || object?.userData?.explodeDir || new THREE.Vector3();
            const offset = new THREE.Vector3()
                .copy(baseVector)
                .add(layerVector)
                .multiplyScalar(explodeT);
            object.position.copy(basePos).add(offset);
        });
        applyExplodedWindowForwardOffset(explodeT);
    }

    function getExplodeDividerChainAnchor(segmentId) {
        if (!segmentId && segmentId !== 0) return null;
        return explodeDividerChainAnchors.get(String(segmentId)) || null;
    }

    function getExplodeTransAnchor(segmentId) {
        if (!segmentId && segmentId !== 0) return null;
        return explodeTransAnchors.get(String(segmentId)) || null;
    }

    function almostEqualExplodeValue(left, right, epsilon = 1e-6) {
        return Math.abs(Number(left) - Number(right)) <= epsilon;
    }

    function buildExplodeDividerChainAnchors() {
        explodeDividerChainAnchors = new Map();
        const segments = Array.isArray(editableTopologyGeometry?.dividerSegments)
            ? editableTopologyGeometry.dividerSegments.filter(segment => segment?.id)
            : [];
        if (!segments.length) return;

        const normalized = segments.map(segment => {
            const orientation = String(segment.orientation || '');
            const perpendicular = Number(segment.perpendicularOffset);
            const start = Number.isFinite(Number(segment.structuralWorldStart))
                ? Number(segment.structuralWorldStart)
                : Number(segment.worldStart);
            const end = Number.isFinite(Number(segment.structuralWorldEnd))
                ? Number(segment.structuralWorldEnd)
                : Number(segment.worldEnd);
            if (!orientation || !Number.isFinite(perpendicular) || !Number.isFinite(start) || !Number.isFinite(end)) {
                return null;
            }
            return {
                id: String(segment.id),
                orientation,
                perpendicular,
                start: Math.min(start, end),
                end: Math.max(start, end),
            };
        }).filter(Boolean);

        const visited = new Set();
        normalized.forEach(segment => {
            if (visited.has(segment.id)) return;
            const queue = [segment];
            const component = [];
            visited.add(segment.id);
            while (queue.length) {
                const current = queue.shift();
                component.push(current);
                normalized.forEach(candidate => {
                    if (visited.has(candidate.id)) return;
                    if (candidate.orientation !== current.orientation) return;
                    if (!almostEqualExplodeValue(candidate.perpendicular, current.perpendicular)) return;
                    const touches = almostEqualExplodeValue(candidate.start, current.end)
                        || almostEqualExplodeValue(candidate.end, current.start)
                        || almostEqualExplodeValue(candidate.start, current.start)
                        || almostEqualExplodeValue(candidate.end, current.end);
                    if (!touches) return;
                    visited.add(candidate.id);
                    queue.push(candidate);
                });
            }

            if (!component.length) return;
            const orientation = component[0].orientation;
            const perpendicular = component.reduce((sum, item) => sum + item.perpendicular, 0) / component.length;
            const spanStart = Math.min(...component.map(item => item.start));
            const spanEnd = Math.max(...component.map(item => item.end));
            const anchor = orientation === 'vertical'
                ? Object.freeze({
                    x: perpendicular,
                    y: (spanStart + spanEnd) / 2,
                    orientation,
                })
                : Object.freeze({
                    x: (spanStart + spanEnd) / 2,
                    y: perpendicular,
                    orientation,
                });
            component.forEach(item => {
                explodeDividerChainAnchors.set(item.id, anchor);
            });
        });
    }

    function buildExplodeTransAnchors() {
        explodeTransAnchors = new Map();
        const segments = Array.isArray(editableTopologyGeometry?.transSegments)
            ? editableTopologyGeometry.transSegments.filter(segment => segment?.id)
            : [];
        segments.forEach(segment => {
            const perpendicular = Number(segment.perpendicularOffset);
            const start = Number.isFinite(Number(segment.structuralWorldStart))
                ? Number(segment.structuralWorldStart)
                : Number(segment.worldStart);
            const end = Number.isFinite(Number(segment.structuralWorldEnd))
                ? Number(segment.structuralWorldEnd)
                : Number(segment.worldEnd);
            if (!Number.isFinite(perpendicular) || !Number.isFinite(start) || !Number.isFinite(end)) return;
            explodeTransAnchors.set(String(segment.id), Object.freeze({
                x: perpendicular,
                y: (Math.min(start, end) + Math.max(start, end)) / 2,
                orientation: String(segment.orientation || 'vertical'),
            }));
        });
    }

    function getExplosionConfigurationCenter() {
        if (editableTopologyGeometry) {
            const minX = Number(editableTopologyGeometry.overallMinX);
            const maxX = Number(editableTopologyGeometry.overallMaxX);
            const minY = Number(editableTopologyGeometry.overallMinY);
            const maxY = Number(editableTopologyGeometry.overallMaxY);
            if ([minX, maxX, minY, maxY].every(Number.isFinite)) {
                return {
                    x: (minX + maxX) / 2,
                    y: (minY + maxY) / 2,
                };
            }
        }
        return { x: 0, y: 0 };
    }

    function getExplosionObjectCenter(obj) {
        const center = obj.position.clone();
        const geometry = obj.geometry;
        if (!geometry) return center;

        if (!geometry.boundingBox) geometry.computeBoundingBox();
        if (!geometry.boundingBox || geometry.boundingBox.isEmpty()) return center;

        const geometryCenter = geometry.boundingBox.getCenter(new THREE.Vector3());
        geometryCenter.multiply(obj.scale).applyQuaternion(obj.quaternion);
        return center.add(geometryCenter);
    }

    function getOutwardExplosionSign(obj, axis, fallbackSign = 1) {
        const objectCenter = getExplosionObjectCenter(obj);
        const configurationCenter = getExplosionConfigurationCenter();
        const delta = axis === 'x'
            ? objectCenter.x - configurationCenter.x
            : objectCenter.y - configurationCenter.y;
        if (Math.abs(delta) > EXPLODE_CENTER_EPSILON) return Math.sign(delta);
        return Math.sign(fallbackSign) || 1;
    }

    function registerOutwardAxisExplode(obj, axis, distance, dz, fallbackSign = 1) {
        const sign = getOutwardExplosionSign(obj, axis, fallbackSign);
        obj.userData.explodeLayout = {
            axis,
            fallbackSign: Math.sign(fallbackSign) || 1,
            requestedDistance: Math.max(0, Number(distance) || 0),
            requestedZ: Number(dz) || 0,
        };
        registerExplode(
            obj,
            axis === 'x' ? distance * sign : 0,
            axis === 'y' ? distance * sign : 0,
            dz
        );
    }

    const EXPLODE_Z_OFFSETS = {
        frame: 0.0,
        sash: 0.25,
        glass: 0.5,
        bead: 0.75,
        divider: 0.0
    };

    function getExplodeObjectBox(object) {
        if (!object) return null;
        const box = new THREE.Box3().setFromObject(object, true);
        if (box.isEmpty()) return null;
        return box;
    }

    function getExplodeObjectSideKey(object, axis, sign) {
        const side = String(object?.userData?.componentSelection?.side || '');
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') {
            return side;
        }
        if (axis === 'x') return sign < 0 ? 'left' : 'right';
        return sign < 0 ? 'bottom' : 'top';
    }

    function getExplodeComponentId(object) {
        return String(
            object?.userData?.connectionProfileId
            || object?.userData?.componentSelection?.name
            || ''
        ).replace(/[^0-9A-Za-z_-]/g, '');
    }

    function getExplodeSemanticLayer(object) {
        const explicit = String(object?.userData?.explodeLayer || '');
        if (EXPLODE_LAYER_ORDER.includes(explicit)) return explicit;

        const source = String(object?.userData?.componentSelection?.source || '').toLowerCase();
        const componentId = getExplodeComponentId(object);

        // In normal geometry the trans is fixed to its owner sash, but in
        // exploded view it should separate like a mullion/structural divider.
        if (object?.userData?.trans || source === 'trans') return 'structure';

        // Fixed-light 224063 is seated on the outer frame/mullion. The moving
        // 224063 copy keeps the sash classification supplied by its source.
        if (componentId.includes('224063') && object?.userData?.fixedGlazingAccessory) {
            return 'structure';
        }

        if (
            source === 'bead'
            || componentId.includes('573920')
            || componentId.includes('573930')
            || componentId.includes('573940')
            || componentId.includes('224350')
            || componentId.includes('224378')
            || componentId.includes('224379')
        ) {
            return 'bead';
        }
        if (source === 'sash') return 'sash';
        if (source === 'frame' || source === 'divider') return 'structure';
        return 'structure';
    }

    function isExplodeFollower(object) {
        if (object?.userData?.explodeFollower === true) return true;
        const type = String(object?.userData?.componentSelection?.componentType || '').toLowerCase();
        return [
            'gasket',
            'insulation',
            'hardware',
            'glass-support',
            'seal',
            'end-cap',
            'drainage-cap',
        ].includes(type);
    }

    function getExplodeAssemblyIdentity(object, layer, sideKey) {
        const explicit = String(object?.userData?.explodeAssemblyKey || '');
        if (explicit) return `${layer}:${sideKey}:${explicit}`;

        const data = object?.userData || {};
        if (data.transSegmentId) return `${layer}:${sideKey}:trans:${data.transSegmentId}`;
        if (data.dividerSegmentId) return `${layer}:${sideKey}:divider:${data.dividerSegmentId}`;
        if (data.frameSegment) return `${layer}:${sideKey}:frame:${data.frameSegment}`;

        const cell = String(data.windowCell || data.transOwnerCellId || 'global');
        const boundary = String(data.fixedGlazingConnectionBoundary || '');
        if (boundary) return `${layer}:${sideKey}:cell:${cell}:boundary:${boundary}`;
        return `${layer}:${sideKey}:cell:${cell}`;
    }

    function getExplodeMatchScore(follower, assembly) {
        const followerData = follower.object?.userData || {};
        const primaryData = assembly.primary?.object?.userData || {};
        let score = 0;

        if (followerData.frameSegment && followerData.frameSegment === primaryData.frameSegment) score += 120;
        if (followerData.dividerSegmentId && followerData.dividerSegmentId === primaryData.dividerSegmentId) score += 120;
        if (followerData.transSegmentId && followerData.transSegmentId === primaryData.transSegmentId) score += 120;
        if (followerData.windowCell && followerData.windowCell === primaryData.windowCell) score += 45;
        if (
            followerData.fixedGlazingConnectionBoundary
            && followerData.fixedGlazingConnectionBoundary === primaryData.fixedGlazingConnectionBoundary
        ) score += 35;

        const followerCenter = follower.box.getCenter(new THREE.Vector3());
        const primaryCenter = assembly.primary.box.getCenter(new THREE.Vector3());
        score -= followerCenter.distanceTo(primaryCenter) * 12;
        return score;
    }

    function unionExplodeAssemblyBox(assembly, box) {
        if (!assembly.box) assembly.box = box.clone();
        else assembly.box.union(box);
    }

    function translateExplodeBox2D(box, axis, sign, distance) {
        const dx = axis === 'x' ? sign * distance : 0;
        const dy = axis === 'y' ? sign * distance : 0;
        return {
            minX: box.min.x + dx,
            maxX: box.max.x + dx,
            minY: box.min.y + dy,
            maxY: box.max.y + dy,
        };
    }

    function explodeBoxesOverlap2D(left, right) {
        if (!left || !right) return false;
        const overlapX = Math.min(left.maxX, right.maxX) - Math.max(left.minX, right.minX);
        const overlapY = Math.min(left.maxY, right.maxY) - Math.max(left.minY, right.minY);
        return overlapX > EXPLODE_COLLISION_EPSILON && overlapY > EXPLODE_COLLISION_EPSILON;
    }

    function getRequiredExplodeDistancePastBox(assembly, otherBox) {
        if (!assembly?.box || !otherBox) return 0;
        if (assembly.axis === 'x') {
            const tangentOverlap = Math.min(assembly.box.max.y, otherBox.maxY)
                - Math.max(assembly.box.min.y, otherBox.minY);
            if (tangentOverlap <= EXPLODE_COLLISION_EPSILON) return 0;
            return assembly.sign > 0
                ? otherBox.maxX - assembly.box.min.x + EXPLODE_COLLISION_EPSILON
                : assembly.box.max.x - otherBox.minX + EXPLODE_COLLISION_EPSILON;
        }

        const tangentOverlap = Math.min(assembly.box.max.x, otherBox.maxX)
            - Math.max(assembly.box.min.x, otherBox.minX);
        if (tangentOverlap <= EXPLODE_COLLISION_EPSILON) return 0;
        return assembly.sign > 0
            ? otherBox.maxY - assembly.box.min.y + EXPLODE_COLLISION_EPSILON
            : assembly.box.max.y - otherBox.minY + EXPLODE_COLLISION_EPSILON;
    }

    function getExplodeBoundsFromEntries(entries) {
        if (!entries?.length) {
            return {
                minX: 0,
                maxX: 0,
                minY: 0,
                maxY: 0,
            };
        }
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        entries.forEach(entry => {
            if (!entry?.box) return;
            minX = Math.min(minX, entry.box.min.x);
            maxX = Math.max(maxX, entry.box.max.x);
            minY = Math.min(minY, entry.box.min.y);
            maxY = Math.max(maxY, entry.box.max.y);
        });
        return {
            minX: Number.isFinite(minX) ? minX : 0,
            maxX: Number.isFinite(maxX) ? maxX : 0,
            minY: Number.isFinite(minY) ? minY : 0,
            maxY: Number.isFinite(maxY) ? maxY : 0,
        };
    }

    function getStructureAssemblyBaseShift(assembly, configurationCenter, bounds) {
        const primaryData = assembly?.primary?.object?.userData || {};
        const anchor = getExplodeAssemblyAnchor(assembly);
        const sideKey = String(assembly?.sideKey || '');
        const source = String(primaryData?.componentSelection?.source || '').toLowerCase();
        const isDivider = Boolean(primaryData.dividerSegmentId) || source === 'divider';
        const isTrans = Boolean(primaryData.transSegmentId) || source === 'trans';
        const isFrame = Boolean(primaryData.frameSegment) || source === 'frame';

        if (isFrame) {
            if (sideKey === 'left') {
                return new THREE.Vector3((Number(bounds.minX) - Number(configurationCenter.x)) * EXPLODE_WINDOW_CENTER_SHIFT_FACTOR, 0, 0);
            }
            if (sideKey === 'right') {
                return new THREE.Vector3((Number(bounds.maxX) - Number(configurationCenter.x)) * EXPLODE_WINDOW_CENTER_SHIFT_FACTOR, 0, 0);
            }
            if (sideKey === 'top') {
                return new THREE.Vector3(0, (Number(bounds.maxY) - Number(configurationCenter.y)) * EXPLODE_WINDOW_CENTER_SHIFT_FACTOR, 0);
            }
            if (sideKey === 'bottom') {
                return new THREE.Vector3(0, (Number(bounds.minY) - Number(configurationCenter.y)) * EXPLODE_WINDOW_CENTER_SHIFT_FACTOR, 0);
            }
        }

        if (isDivider || isTrans) {
            const chainAnchor = isDivider
                ? getExplodeDividerChainAnchor(primaryData.dividerSegmentId)
                : null;
            const transAnchor = isTrans
                ? getExplodeTransAnchor(primaryData.transSegmentId)
                : null;
            const effectiveAnchor = chainAnchor || transAnchor || anchor;
            return new THREE.Vector3(
                (Number(effectiveAnchor.x) - Number(configurationCenter.x)) * EXPLODE_WINDOW_CENTER_SHIFT_FACTOR,
                (Number(effectiveAnchor.y) - Number(configurationCenter.y)) * EXPLODE_WINDOW_CENTER_SHIFT_FACTOR,
                0
            );
        }

        return new THREE.Vector3(
            (Number(anchor.x) - Number(configurationCenter.x)) * EXPLODE_WINDOW_CENTER_SHIFT_FACTOR,
            (Number(anchor.y) - Number(configurationCenter.y)) * EXPLODE_WINDOW_CENTER_SHIFT_FACTOR,
            0
        );
    }

    function finalizeExplodedLayout() {
        const entries = explodableObjects
            .map((object, index) => {
                const box = getExplodeObjectBox(object);
                if (!box) return null;
                const center = box.getCenter(new THREE.Vector3());
                const meta = object?.userData?.explodeLayout || null;
                const layer = getExplodeSemanticLayer(object);
                const axis = meta?.axis || null;
                const configurationCenter = getExplosionConfigurationCenter();
                const delta = axis === 'x'
                    ? center.x - configurationCenter.x
                    : axis === 'y'
                        ? center.y - configurationCenter.y
                        : 0;
                const fallbackSign = Math.sign(meta?.fallbackSign || 1) || 1;
                const sign = axis
                    ? (Math.abs(delta) > EXPLODE_CENTER_EPSILON ? Math.sign(delta) : fallbackSign)
                    : 0;
                const sideKey = axis
                    ? getExplodeObjectSideKey(object, axis, sign)
                    : 'center';
                return {
                    object,
                    index,
                    box,
                    center,
                    axis,
                    sign,
                    layer,
                    sideKey,
                    follower: isExplodeFollower(object),
                    identity: getExplodeAssemblyIdentity(object, layer, sideKey),
                };
            })
            .filter(Boolean);

        if (!entries.length) return;

        const assemblies = [];
        const primaryAssemblies = new Map();
        const followers = [];

        entries.forEach(entry => {
            if (entry.follower) {
                followers.push(entry);
                return;
            }
            let assembly = primaryAssemblies.get(entry.identity);
            if (!assembly) {
                assembly = {
                    id: entry.identity,
                    layer: entry.layer,
                    sideKey: entry.sideKey,
                    axis: entry.axis,
                    sign: entry.sign,
                    members: [],
                    box: null,
                    primary: entry,
                    originalIndex: entry.index,
                };
                primaryAssemblies.set(entry.identity, assembly);
                assemblies.push(assembly);
            }
            assembly.members.push(entry);
            unionExplodeAssemblyBox(assembly, entry.box);
        });

        followers.forEach(entry => {
            const candidates = assemblies.filter(assembly => assembly.layer === entry.layer);
            let target = null;
            let bestScore = -Infinity;
            candidates.forEach(assembly => {
                const score = getExplodeMatchScore(entry, assembly);
                if (score > bestScore) {
                    bestScore = score;
                    target = assembly;
                }
            });
            if (!target) {
                target = {
                    id: `${entry.identity}:follower:${entry.index}`,
                    layer: entry.layer,
                    sideKey: entry.sideKey,
                    axis: entry.axis,
                    sign: entry.sign,
                    members: [],
                    box: null,
                    primary: entry,
                    originalIndex: entry.index,
                };
                assemblies.push(target);
            }
            target.members.push(entry);
            unionExplodeAssemblyBox(target, entry.box);
        });

        const configurationCenter = getExplosionConfigurationCenter();
        const configurationBounds = getExplodeBoundsFromEntries(entries);
        assemblies.forEach(assembly => {
            const anchor = getExplodeAssemblyAnchor(assembly);
            const baseShift = assembly.layer === 'structure'
                ? getStructureAssemblyBaseShift(assembly, configurationCenter, configurationBounds)
                : new THREE.Vector3(
                    (Number(anchor.x) - Number(configurationCenter.x)) * EXPLODE_WINDOW_CENTER_SHIFT_FACTOR,
                    (Number(anchor.y) - Number(configurationCenter.y)) * EXPLODE_WINDOW_CENTER_SHIFT_FACTOR,
                    0
                );
            const branchDirection = getExplodeLayerBranchVector(assembly, anchor, configurationCenter);
            const layerDistance = Number(EXPLODE_LAYER_BASE_DISTANCE[assembly.layer]) || 0;
            const layerShift = new THREE.Vector3(
                branchDirection.x * layerDistance,
                branchDirection.y * layerDistance,
                Number(EXPLODE_LAYER_Z[assembly.layer]) || 0
            );
            assembly.members.forEach(member => {
                member.object.userData.explodeResolvedLayer = assembly.layer;
                member.object.userData.explodeBaseDir = baseShift.clone();
                member.object.userData.explodeLayerDir = layerShift.clone();
                member.object.userData.explodeDir = baseShift.clone().add(layerShift);
                member.object.userData.explodeLayout = {
                    ...(member.object.userData.explodeLayout || {}),
                    layer: assembly.layer,
                    distance: layerDistance,
                    lane: 0,
                    anchorX: Number(anchor.x) || 0,
                    anchorY: Number(anchor.y) || 0,
                };
            });
        });
    }

    function bboxDistance(boxA, boxB) {
        if (!boxA || !boxB) return Infinity;
        const distX = Math.max(0, boxA.minX - boxB.maxX, boxB.minX - boxA.maxX);
        const distY = Math.max(0, boxA.minY - boxB.maxY, boxB.minY - boxA.maxY);
        return Math.hypot(distX, distY);
    }

    // 3D SAMPLE EXTRUSION GENERATOR (10CM)
    function createSampleExtrusion(profile) {
        const sampleMetadata = sectionSampleMetadata || currentMetadata;
        // Use the same thickness-aware template as the full window. Using
        // profile.shape here locked the section sample to the original 573940
        // glazing bead even after the glass thickness selected 573930/573920.
        const activeShape = getProfileShape(profile);
        const extrudeSettings = { depth: 0.1, bevelEnabled: false, curveSegments: PROFILE_CURVE_SEGMENTS, steps: 1 };
        const geom = geometry.profile(activeShape, extrudeSettings);
        const posAttribute = geom.attributes.position;
        const v = new THREE.Vector3();

        for (let i = 0; i < posAttribute.count; i++) {
            v.fromBufferAttribute(posAttribute, i);

            // Reconstruct and align CAD coordinates from SVG space.
            const cadPoint = getProfileCadPointMm(profile, v.x, v.y);
            const x_cad = cadPoint.x;
            const y_cad = cadPoint.y;

            // Center X coordinates around 0
            let x_norm = x_cad - sampleMetadata.globalCenterX;

            // Normalize Y coordinate based on drawing type (Horizontal vs Vertical)
            let y_norm;
            if (sampleMetadata.isVertical) {
                if (profile.section === 'bottom') {
                    y_norm = y_cad - sampleMetadata.globalMinY;
                } else {
                    y_norm = sampleMetadata.globalMaxY - y_cad;
                }
            } else {
                y_norm = y_cad - sampleMetadata.globalMinY;
            }

            let u = x_norm * S;
            let inw = y_norm * S;

            // Map to extruded local coordinate space
            // Keep v.z as the extrusion coordinate (0 to 0.1)
            // Add a small local offset per part index to prevent z-fighting at boundaries
            let zOffset = profile.index * 0.0001;
            let finalZ = v.z === 0 ? -zOffset : v.z + zOffset;

            posAttribute.setXYZ(i, u, inw, finalZ);
        }
        geom.computeVertexNormals();

        const mesh = geometry.profileMesh(geom, profile.material, 'z');
        mesh.castShadow = !captureMode;
        mesh.receiveShadow = !captureMode;
        return mesh;
    }

    function getDividerSourceBounds(dividerProfiles) {
        const declared = dividerProfiles.find(profile => profile.dividerSourceBounds)
            ?.dividerSourceBounds;
        if (declared) return declared;

        const boxes = dividerProfiles.map(profile => profile.bbox).filter(Boolean);
        if (!boxes.length) return null;
        const minX = Math.min(...boxes.map(bbox => Number(bbox.minX)));
        const maxX = Math.max(...boxes.map(bbox => Number(bbox.maxX)));
        const minY = Math.min(...boxes.map(bbox => Number(bbox.minY)));
        const maxY = Math.max(...boxes.map(bbox => Number(bbox.maxY)));
        return {
            minX,
            maxX,
            minY,
            maxY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
        };
    }

    function getDividerFaceSpanM(dividerProfiles) {
        const bounds = getDividerSourceBounds(dividerProfiles);
        if (!bounds) return 0;
        return getDividerCrossSectionMetrics(bounds).faceSpanM;
    }

    function getFrameFaceSpanM() {
        // The converted CAD assembly bounding box includes small lips/flanges
        // outside the nominal frame face, so using the complete bbox produced
        // a 72 mm layout face and made a 600 x 900 cell render as 615 x 930.
        // The AW CT 65 outer-frame sizing face is 57 mm (575760 / 575770).
        return NOMINAL_OUTER_FRAME_FACE_M;
    }


    function getTransSourceBounds(transProfiles) {
        const declared = transProfiles.find(profile => profile.transSourceBounds)?.transSourceBounds;
        if (declared) return declared;
        const boxes = transProfiles.map(profile => profile.bbox).filter(Boolean);
        if (!boxes.length) return null;
        const minX = Math.min(...boxes.map(bbox => Number(bbox.minX)));
        const maxX = Math.max(...boxes.map(bbox => Number(bbox.maxX)));
        const minY = Math.min(...boxes.map(bbox => Number(bbox.minY)));
        const maxY = Math.max(...boxes.map(bbox => Number(bbox.maxY)));
        return {
            minX,
            maxX,
            minY,
            maxY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
        };
    }

    function getFrameJointInwardSpanM(profiles) {
        let maxInwardMm = 0;

        profiles
            .filter(profile => getProfileGroup(profile) === 'frame')
            .forEach(profile => {
                const bbox = getEffectiveProfileBbox(profile);
                if (!bbox) return;

                [bbox.minY, bbox.maxY].forEach(cadY => {
                    const inwardMm = cadYToInwardDistanceMm(cadY, profile.section);
                    if (Number.isFinite(inwardMm)) {
                        maxInwardMm = Math.max(maxInwardMm, inwardMm);
                    }
                });
            });

        return maxInwardMm * S;
    }

    function createDividerSampleExtrusion(profile, bounds) {
        const shape = getProfileShape(profile);
        const geom = geometry.profile(shape, {
            depth: 0.1,
            bevelEnabled: false,
            curveSegments: PROFILE_CURVE_SEGMENTS,
            steps: 1,
        });
        const position = geom.attributes.position;
        const point = new THREE.Vector3();
        const centerX = Number(bounds?.centerX) || 0;
        const centerY = Number(bounds?.centerY) || 0;
        const zOffset = profile.index * 0.0001;

        for (let index = 0; index < position.count; index += 1) {
            point.fromBufferAttribute(position, index);
            const cadPoint = getProfileCadPointMm(profile, point.x, point.y);
            const cadX = cadPoint.x;
            const cadY = cadPoint.y;
            let depth = (centerY - cadY) * S;
            let face = (cadX - centerX) * S;
            const sectionRotationDeg = Number(
                profile?.dividerSectionRotationDeg
                ?? profile?.transSectionRotationDeg
                ?? 0
            );
            if (sectionRotationDeg === 180) {
                // Correct only the verified front/back reversal. Keep the
                // standalone mullion/trans section plane; do not rotate it
                // from the join INSERT basis.
                depth = -depth;
                face = -face;
            }
            const extrusion = point.z === 0 ? -zOffset : point.z + zOffset;
            position.setXYZ(index, depth, face, extrusion);
        }

        geom.deleteAttribute('normal');
        geom.computeVertexNormals();
        const mesh = geometry.profileMesh(geom, profile.material, 'z');
        mesh.castShadow = !captureMode;
        mesh.receiveShadow = !captureMode;
        return mesh;
    }

    // The adapter supplies the product-specific scalar plane; the shared base
    // subdivides/clips intermediate positions without changing the CAD rules.
    const splitBufferGeometryAtScalarZero = geometry.split;
    const clipBufferGeometryToScalarHalfspace = geometry.clip;

    function createDividerSegment(
        profile,
        length,
        orientation,
        bounds,
        depthOffset = 0,
        frameInwardSpan = 0,
        perpendicularOffset = 0,
        longitudinalOffset = 0,
        faceDirection = 1,
        longitudinalJoint = null
    ) {
        const shape = getProfileShape(profile);
        const sourceGeom = geometry.profile(shape, {
            depth: 1,
            bevelEnabled: false,
            curveSegments: 8,
            steps: 1,
        });
        const centerX = Number(bounds?.centerX) || 0;
        const dividerMetrics = getDividerCrossSectionMetrics(bounds);
        const resolveRenderedFace = rawPoint => {
            const cadPoint = getProfileCadPointMm(profile, rawPoint.x, rawPoint.y);
            let renderedFace = (cadPoint.x - centerX) * S;
            if (Number(profile?.dividerSectionRotationDeg) === 180) {
                renderedFace = -renderedFace;
            }
            renderedFace *= Number(faceDirection) < 0 ? -1 : 1;
            return renderedFace;
        };

        // Re-entrant merged-L filler pieces are not short dividers in the
        // missing direction. They are one half of the surviving mullion section
        // extruded parallel to that mullion. Clip the source section at its
        // centre plane before applying the V deformation so the filler occupies
        // only the merged-window side of the profile.
        const faceHalfSign = Math.sign(Number(longitudinalJoint?.faceHalfSign) || 0);
        let geom = sourceGeom;
        if (faceHalfSign) {
            const previousGeom = geom;
            geom = clipBufferGeometryToScalarHalfspace(previousGeom, rawPoint => (
                resolveRenderedFace(rawPoint) * faceHalfSign
            ));
            previousGeom.dispose();
        }

        // Arrow deformation has a kink at its V apex. A normal mullion uses the
        // face centre (bias 0); a mixed perimeter + can bias the apex across the
        // face by the CAD 21 mm correction. Insert vertices on every active apex
        // plane before deformation so the asymmetric V remains a real 90-degree
        // cut instead of a bridged/trapezoidal polygon.
        const arrowBiases = [];
        const negativeMode = longitudinalJoint?.negativeEndMode || 'arrow';
        const positiveMode = longitudinalJoint?.positiveEndMode || 'arrow';
        if (negativeMode === 'arrow') {
            arrowBiases.push(Number(longitudinalJoint?.negativeArrowFaceBias) || 0);
        }
        if (positiveMode === 'arrow') {
            arrowBiases.push(Number(longitudinalJoint?.positiveArrowFaceBias) || 0);
        }
        const uniqueArrowBiases = [...new Set(arrowBiases.map(value => value.toFixed(9)))].map(Number);
        uniqueArrowBiases.forEach(bias => {
            const previousGeom = geom;
            geom = splitBufferGeometryAtScalarZero(previousGeom, rawPoint => (
                resolveRenderedFace(rawPoint) - bias
            ));
            previousGeom.dispose();
        });

        // A divider socket is also piecewise-linear across the mullion face:
        // one half stays square while the branch-facing half opens on a 45°
        // plane. When the two ends of the same mullion use opposite socket
        // directions (a b / c b / c d), the upper and lower end can otherwise
        // deform the same unsplit source triangle in opposite ways. That is the
        // source of the twisted/bridged geometry at the top of the middle
        // mullion. Insert vertices on every socket transition plane before the
        // longitudinal deformation, just like we already do for arrow V apices.
        const socketOffset = Number(longitudinalJoint?.socketInwardOffset) || 0;
        const sharedSocketSign = Number(longitudinalJoint?.socketInwardSign) || 0;
        const getEndSocketSign = key => (
            Number(longitudinalJoint?.[key]) || sharedSocketSign
        );
        const getEndFrameSpan = key => {
            const value = Number(longitudinalJoint?.[key]);
            return Number.isFinite(value) ? Math.max(0, value) : Math.max(0, frameInwardSpan);
        };
        const socketBreakFaces = [];
        const collectSocketBreakFaces = (mode, sign, endFrameSpan) => {
            if (mode !== 'socket') return;
            const straightContactSpan = getFrameDividerMiterContactStart({
                dividerFaceSpan: dividerMetrics.faceSpanM,
                frameInwardSpan: endFrameSpan,
            });
            if (sign) {
                socketBreakFaces.push((straightContactSpan - socketOffset) / sign);
            } else {
                // Legacy symmetric socket based on abs(face): both shoulders
                // are kinks and therefore both need explicit vertices.
                socketBreakFaces.push(straightContactSpan, -straightContactSpan);
            }
        };
        collectSocketBreakFaces(
            negativeMode,
            getEndSocketSign('negativeSocketInwardSign'),
            getEndFrameSpan('negativeFrameInwardSpan')
        );
        collectSocketBreakFaces(
            positiveMode,
            getEndSocketSign('positiveSocketInwardSign'),
            getEndFrameSpan('positiveFrameInwardSpan')
        );
        [...new Set(socketBreakFaces.map(value => Number(value).toFixed(9)))]
            .map(Number)
            .forEach(faceBreak => {
                const previousGeom = geom;
                geom = splitBufferGeometryAtScalarZero(previousGeom, rawPoint => (
                    resolveRenderedFace(rawPoint) - faceBreak
                ));
                previousGeom.dispose();
            });

        // The real end machining is an L-shaped notch in SIDE view. The
        // branch already ends 19 mm before the grid; from that square end, only
        // the outermost 5 mm flange is cut back another 25 mm. This is not a
        // 5 mm longitudinal shortening of the two 25 mm face wings.
        const hasNegativeRectangularEndNotch = Boolean(
            profile?.isAlu === true
            && longitudinalJoint?.negativeRectangularEndNotch
        );
        const hasPositiveRectangularEndNotch = Boolean(
            profile?.isAlu === true
            && longitudinalJoint?.positiveRectangularEndNotch
        );
        const hasRectangularEndNotch = (
            hasNegativeRectangularEndNotch
            || hasPositiveRectangularEndNotch
        );

        // The 575800 source is authored with the full-width 5 mm flange at the
        // minimum CAD-Y side of the assembly (the 88 mm-wide flange visible in
        // section). Split the section exactly at that 5 mm boundary so only
        // that flange receives the 25 mm longitudinal cut-back.
        const notchOuterCadY = Number(bounds?.minY);
        const notchCadYBoundary = Number.isFinite(notchOuterCadY)
            ? notchOuterCadY + INTERSECTION_MULLION_END_NOTCH_DEPTH_M / S
            : null;
        if (hasRectangularEndNotch && Number.isFinite(notchCadYBoundary)) {
            const previousGeom = geom;
            geom = splitBufferGeometryAtScalarZero(previousGeom, rawPoint => {
                const cadPoint = getProfileCadPointMm(profile, rawPoint.x, rawPoint.y);
                return cadPoint.y - notchCadYBoundary;
            });
            previousGeom.dispose();

            // ExtrudeGeometry normally has only z=0 and z=1 longitudinal
            // vertices. Add vertices at the 25 mm cut planes before moving the
            // flange endpoint; otherwise the flange would taper diagonally over
            // the entire mullion instead of forming the requested square L cut.
            const notchFraction = Math.min(
                1,
                INTERSECTION_MULLION_END_NOTCH_LENGTH_M / Math.max(1e-9, length)
            );
            const longitudinalBreaks = [];
            if (hasNegativeRectangularEndNotch && notchFraction < 1 - 1e-9) {
                longitudinalBreaks.push(notchFraction);
            }
            if (hasPositiveRectangularEndNotch && notchFraction < 1 - 1e-9) {
                longitudinalBreaks.push(1 - notchFraction);
            }
            [...new Set(longitudinalBreaks.map(value => value.toFixed(9)))]
                .map(Number)
                .forEach(extrusionBreak => {
                    const sourceBeforeSplit = geom;
                    geom = splitBufferGeometryAtScalarZero(
                        sourceBeforeSplit,
                        rawPoint => (Number(rawPoint.z) || 0) - extrusionBreak
                    );
                    sourceBeforeSplit.dispose();
                });
        }

        // Divider-mounted glazing/rebate gaskets follow the mullion they are
        // mounted on, but are intentionally 10 mm shorter overall. Keep them
        // centred on the mullion (5 mm clearance at each longitudinal end).
        // The local diagonal end cut is then applied inside that shorter span.
        const isAttachedDividerGasket = Boolean(
            isFixedGlassAnchorGasket(profile)
            || isFrameToSashRebateGasket(profile)
        );
        const trimNegativeGasketEnd = Boolean(
            isAttachedDividerGasket
            && longitudinalJoint?.negativeRectangularEndNotch
        );
        const trimPositiveGasketEnd = Boolean(
            isAttachedDividerGasket
            && longitudinalJoint?.positiveRectangularEndNotch
        );
        const dividerGasketTotalShortening = isAttachedDividerGasket ? 0.030 : 0;
        const defaultGasketEndTrim = dividerGasketTotalShortening / 2;
        const resolveGasketEndTrim = overrideValue => {
            const parsed = Number(overrideValue);
            return Number.isFinite(parsed)
                ? Math.max(0, parsed)
                : defaultGasketEndTrim;
        };
        const negativeGasketTrim = resolveGasketEndTrim(
            longitudinalJoint?.negativeGasketTrimOverride
        );
        const positiveGasketTrim = resolveGasketEndTrim(
            longitudinalJoint?.positiveGasketTrimOverride
        );
        // Avoid the divider's full 88 mm-face arrow deformation at a notched
        // branch end. Keep the gasket endpoint on the mullion endpoint and
        // apply only the small local 45-degree cut across the gasket section.
        const useNegativeLocalGasketMiter = Boolean(
            isAttachedDividerGasket
            && (trimNegativeGasketEnd || longitudinalJoint?.negativeLocalGasketMiter)
        );
        const usePositiveLocalGasketMiter = Boolean(
            isAttachedDividerGasket
            && (trimPositiveGasketEnd || longitudinalJoint?.positiveLocalGasketMiter)
        );
        const renderedNegativeEndMode = trimNegativeGasketEnd
            ? 'square'
            : (longitudinalJoint?.negativeEndMode || 'arrow');
        const renderedPositiveEndMode = trimPositiveGasketEnd
            ? 'square'
            : (longitudinalJoint?.positiveEndMode || 'arrow');
        const renderedNegativeFrameInwardSpan = trimNegativeGasketEnd
            ? 0
            : longitudinalJoint?.negativeFrameInwardSpan;
        const renderedPositiveFrameInwardSpan = trimPositiveGasketEnd
            ? 0
            : longitudinalJoint?.positiveFrameInwardSpan;
        const renderedLength = Math.max(
            0,
            length - negativeGasketTrim - positiveGasketTrim
        );
        const renderedLongitudinalOffset = longitudinalOffset
            + negativeGasketTrim / 2
            - positiveGasketTrim / 2;

        const position = geom.attributes.position;
        const point = new THREE.Vector3();
        const centerY = Number(bounds?.centerY) || 0;
        const metrics = dividerMetrics;
        let localGasketFaceMin = Infinity;
        let localGasketFaceMax = -Infinity;
        if (useNegativeLocalGasketMiter || usePositiveLocalGasketMiter) {
            for (let index = 0; index < position.count; index += 1) {
                const renderedFace = resolveRenderedFace({
                    x: position.getX(index),
                    y: position.getY(index),
                });
                if (!Number.isFinite(renderedFace)) continue;
                localGasketFaceMin = Math.min(localGasketFaceMin, renderedFace);
                localGasketFaceMax = Math.max(localGasketFaceMax, renderedFace);
            }
        }
        const hasLocalGasketFaceRange = (
            Number.isFinite(localGasketFaceMin)
            && Number.isFinite(localGasketFaceMax)
            && localGasketFaceMax - localGasketFaceMin > 1e-9
        );
        const getLocalGasketMiterInset = (face, sign = 1) => {
            if (!hasLocalGasketFaceRange) return 0;
            return sign >= 0
                ? Math.max(0, face - localGasketFaceMin)
                : Math.max(0, localGasketFaceMax - face);
        };
        const rectangularNotchInsetByTriangle = hasRectangularEndNotch
            ? new Array(Math.ceil(position.count / 3)).fill(0)
            : null;
        if (rectangularNotchInsetByTriangle && Number.isFinite(notchOuterCadY)) {
            for (let base = 0; base + 2 < position.count; base += 3) {
                let cadYSum = 0;
                for (let offset = 0; offset < 3; offset += 1) {
                    const cadPoint = getProfileCadPointMm(
                        profile,
                        position.getX(base + offset),
                        position.getY(base + offset)
                    );
                    cadYSum += cadPoint.y;
                }
                const averageCadY = cadYSum / 3;
                rectangularNotchInsetByTriangle[Math.floor(base / 3)] =
                    getRectangularDividerEndNotchInset({
                        sectionDepthFromOuterFace: Math.max(
                            0,
                            (averageCadY - notchOuterCadY) * S
                        ),
                    });
            }
        }

        for (let index = 0; index < position.count; index += 1) {
            point.fromBufferAttribute(position, index);
            const cadPoint = getProfileCadPointMm(profile, point.x, point.y);
            const cadX = cadPoint.x;
            const cadY = cadPoint.y;
            let sectionDepth = (centerY - cadY) * S;
            let face = (cadX - centerX) * S;
            if (Number(profile?.dividerSectionRotationDeg) === 180) {
                sectionDepth = -sectionDepth;
                face = -face;
            }
            face *= Number(faceDirection) < 0 ? -1 : 1;
            // Keep every standalone mullion component on its exact CAD depth.
            // Unlike the detached 10 cm sample, the assembled divider must not
            // stagger components by profile index; even sub-millimetre offsets
            // make the section appear slightly displaced from the joined frame.
            const depth = sectionDepth + depthOffset;
            const socketInwardSign = Number(longitudinalJoint?.socketInwardSign) || 0;
            const negativeSocketInwardSign = Number(
                longitudinalJoint?.negativeSocketInwardSign
            ) || socketInwardSign;
            const positiveSocketInwardSign = Number(
                longitudinalJoint?.positiveSocketInwardSign
            ) || socketInwardSign;
            const socketInwardOffset = Number(longitudinalJoint?.socketInwardOffset) || 0;
            const socketInwardDistance = socketInwardSign
                ? face * socketInwardSign + socketInwardOffset
                : Math.abs(face);
            const negativeSocketInwardDistance = negativeSocketInwardSign
                ? face * negativeSocketInwardSign + socketInwardOffset
                : Math.abs(face);
            const positiveSocketInwardDistance = positiveSocketInwardSign
                ? face * positiveSocketInwardSign + socketInwardOffset
                : Math.abs(face);
            const sourceExtrusionT = Math.min(
                1,
                Math.max(0, Number(point.z) || 0)
            );
            let effectiveExtrusionT = sourceExtrusionT;
            const notchInset = Number(
                rectangularNotchInsetByTriangle?.[Math.floor(index / 3)]
            ) || 0;
            if (notchInset > 1e-9 && length > 1e-9) {
                const notchFraction = Math.min(1, notchInset / length);
                if (hasNegativeRectangularEndNotch) {
                    effectiveExtrusionT = Math.max(effectiveExtrusionT, notchFraction);
                }
                if (hasPositiveRectangularEndNotch) {
                    effectiveExtrusionT = Math.min(
                        effectiveExtrusionT,
                        1 - notchFraction
                    );
                }
            }

            let along = getDividerSegmentAlongCoordinate({
                extrusionT: effectiveExtrusionT,
                length: renderedLength,
                faceOffset: face,
                faceSpan: metrics.faceSpanM,
                frameInwardSpan,
                negativeFrameInwardSpan: renderedNegativeFrameInwardSpan,
                positiveFrameInwardSpan: renderedPositiveFrameInwardSpan,
                negativeEndMode: renderedNegativeEndMode,
                positiveEndMode: renderedPositiveEndMode,
                negativeArrowFaceBias: longitudinalJoint?.negativeArrowFaceBias,
                positiveArrowFaceBias: longitudinalJoint?.positiveArrowFaceBias,
                socketInwardDistance,
                negativeSocketInwardDistance,
                positiveSocketInwardDistance,
            });

            // Local gasket miters are referenced to the gasket itself, not to
            // the 88 mm mullion face. The longest edge therefore remains at the
            // exact 25 mm trim plane and only the opposite edge recedes by the
            // gasket's own width, matching the small diagonal end in the CAD.
            if (useNegativeLocalGasketMiter) {
                const sign = Number(longitudinalJoint?.negativeLocalGasketMiterSign) || 1;
                along += getLocalGasketMiterInset(face, sign) * (1 - effectiveExtrusionT);
            }
            if (usePositiveLocalGasketMiter) {
                const sign = Number(longitudinalJoint?.positiveLocalGasketMiterSign) || 1;
                along -= getLocalGasketMiterInset(face, sign) * effectiveExtrusionT;
            }

            if (orientation === 'horizontal') {
                position.setXYZ(index, along, -face, depth);
            } else {
                position.setXYZ(index, face, along, depth);
            }
        }

        position.needsUpdate = true;
        geom.deleteAttribute('normal');
        geom.computeVertexNormals();
        geom.computeBoundingBox();
        geom.computeBoundingSphere();

        const mesh = geometry.profileMesh(geom, profile.material, orientation === 'horizontal' ? 'x' : 'y');
        // Apply the layout position before registerExplode() captures basePos.
        // Repeated dividers used to be translated only afterwards, so the pose
        // animation reset every copy to (0, 0) and collapsed them into one.
        if (orientation === 'vertical') {
            mesh.position.x = (Number(perpendicularOffset) || 0);
            mesh.position.y = (Number(renderedLongitudinalOffset) || 0);
        } else if (orientation === 'horizontal') {
            mesh.position.y = (Number(perpendicularOffset) || 0);
            mesh.position.x = (Number(renderedLongitudinalOffset) || 0);
        }
        mesh.castShadow = !captureMode;
        mesh.receiveShadow = !captureMode;
        mesh.userData.componentSelection = {
            name: getProfileComponentNumber(profile),
            source: 'divider',
            componentId: profile.componentId,
            componentType: profile.componentType,
            profileIndex: profile.index,
            legacyIndex: profile.legacyIndex,
            side: orientation,
        };
        componentSelection.add(mesh);

        const explodeDistance = 0.12;
        registerOutwardAxisExplode(
            mesh,
            orientation === 'vertical' ? 'x' : 'y',
            explodeDistance,
            EXPLODE_Z_OFFSETS.divider,
            1
        );
        return mesh;
    }

    function clipDividerMeshToReentrantFillerTriangle(
        mesh,
        filler,
        dividerFaceSpan,
        { includeFaceBoundary = true } = {}
    ) {
        const triangle = filler?.fillerKind === 'rectangular-host'
            ? getHalfMullionTriangle({
                filler,
                triangleSpan: filler?.triangleSpan || RECTANGULAR_DIVIDER_SETBACK_M,
            })
            : getReentrantFillerTriangle({
                filler,
                dividerFaceSpan,
            });
        if (!mesh?.geometry || triangle.length !== 3) return false;

        const [a, b, c] = triangle;
        const area2 = (b.x - a.x) * (c.y - a.y)
            - (b.y - a.y) * (c.x - a.x);
        if (Math.abs(area2) <= 1e-12) return false;
        const windingSign = area2 > 0 ? 1 : -1;

        // Structural mullion islands are clipped to the complete triangular
        // half-face, including its base edge. A join gasket such as 224063 is
        // seated just outside that aluminium face, however. Clipping the gasket
        // against the triangle's base deletes exactly the part that must follow
        // the fixed glazing. For those follower components keep the same two
        // 45-degree V shoulders but leave the face-normal side open.
        const clipEdges = includeFaceBoundary
            ? [[a, b], [b, c], [c, a]]
            : [[a, b], [c, a]];

        clipEdges.forEach(([p0, p1]) => {
            const previousGeometry = mesh.geometry;
            const clippedGeometry = clipBufferGeometryToScalarHalfspace(
                previousGeometry,
                rawPoint => {
                    const worldX = rawPoint.x + (Number(mesh.position.x) || 0);
                    const worldY = rawPoint.y + (Number(mesh.position.y) || 0);
                    const edgeX = p1.x - p0.x;
                    const edgeY = p1.y - p0.y;
                    const pointX = worldX - p0.x;
                    const pointY = worldY - p0.y;
                    return windingSign * (edgeX * pointY - edgeY * pointX);
                }
            );
            if (clippedGeometry !== previousGeometry) previousGeometry.dispose();
            mesh.geometry = clippedGeometry;
        });

        const positions = mesh.geometry?.attributes?.position;
        if (!positions || positions.count < 3) return false;
        mesh.geometry.deleteAttribute('normal');
        mesh.geometry.computeVertexNormals();
        geometry.prepare(mesh.geometry, mesh.material);
        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();
        return true;
    }

    function clipFrameMeshToHalfFrameTriangle(mesh, filler) {
        const triangle = filler?.positionMode === 'inside'
            ? getInsideHalfFrameTriangle({
                filler,
                frameReferenceSpan: filler?.frameReferenceSpan,
            })
            : getHalfFrameTriangle({
                filler,
                frameReferenceSpan: filler?.frameReferenceSpan,
            });
        if (!mesh?.geometry || triangle.length !== 3) return false;

        const [a, b, c] = triangle;
        const area2 = (b.x - a.x) * (c.y - a.y)
            - (b.y - a.y) * (c.x - a.x);
        if (Math.abs(area2) <= 1e-12) return false;
        const windingSign = area2 > 0 ? 1 : -1;

        [[a, b], [b, c], [c, a]].forEach(([p0, p1]) => {
            const previousGeometry = mesh.geometry;
            const clippedGeometry = clipBufferGeometryToScalarHalfspace(
                previousGeometry,
                rawPoint => {
                    const worldX = rawPoint.x + (Number(mesh.position.x) || 0);
                    const worldY = rawPoint.y + (Number(mesh.position.y) || 0);
                    const edgeX = p1.x - p0.x;
                    const edgeY = p1.y - p0.y;
                    const pointX = worldX - p0.x;
                    const pointY = worldY - p0.y;
                    return windingSign * (edgeX * pointY - edgeY * pointX);
                }
            );
            if (clippedGeometry !== previousGeometry) previousGeometry.dispose();
            mesh.geometry = clippedGeometry;
        });

        const positions = mesh.geometry?.attributes?.position;
        if (!positions || positions.count < 3) return false;
        mesh.geometry.deleteAttribute('normal');
        mesh.geometry.computeVertexNormals();
        geometry.prepare(mesh.geometry, mesh.material);
        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();
        return true;
    }

    const templateGeometryCache = new Map();

    function getTemplateGeometry(profile) {
        const shape = getProfileShape(profile);
        const activeBead = getActiveGlazingBeadCode();
        const activeGasket = getActiveGasketCode();
        const cacheKey = `${profile.index}:${activeBead}:${activeGasket}`;

        if (!templateGeometryCache.has(cacheKey)) {
            const extrudeSettings = { depth: 1.0, bevelEnabled: false, curveSegments: 8, steps: 1 };
            const geom = geometry.profile(shape, extrudeSettings);
            templateGeometryCache.set(cacheKey, geom);
        }

        return templateGeometryCache.get(cacheKey);
    }

    function clearTemplateGeometryCache() {
        for (const geom of templateGeometryCache.values()) {
            geom.dispose();
        }
        templateGeometryCache.clear();
    }

    // MITER ENGINE EXTRUDER
    function createMiteredSide(
        profile,
        lengthA,
        lengthB,
        side,
        expDist,
        originX = 0,
        originY = 0,
        dividerJoint = null
    ) {
        const isHorizontal = side === 'bottom' || side === 'top';
        const length = isHorizontal ? lengthA : lengthB;

        const templateGeom = getTemplateGeometry(profile);
        let geom = geometry.clone(templateGeom);

        // The divider joint has a real topology break where the two perimeter
        // frame halves stop meeting each other vertically and begin the 45°
        // faces that touch the mullion V. Insert vertices exactly on that break
        // before deformation so one straight SVG edge cannot bridge both regions.
        const dividerJointEnds = new Set(
            Array.isArray(dividerJoint?.localJointEnds) && dividerJoint.localJointEnds.length
                ? dividerJoint.localJointEnds
                : (dividerJoint?.localJointEnd ? [dividerJoint.localJointEnd] : [])
        );
        const frameJointEndModes = dividerJoint?.endModes || {};
        const frameJointCenterShifts = dividerJoint?.centerShifts || {};
        const getFrameJointEndMode = localEnd => {
            const explicitMode = frameJointEndModes?.[localEnd];
            if (explicitMode) return explicitMode;
            return dividerJointEnds.has(localEnd) ? 'socket' : 'miter';
        };
        const hasFrameProfileBreakJoint = [...dividerJointEnds].some(localEnd => {
            const mode = getFrameJointEndMode(localEnd);
            return mode === 'socket'
                || mode === 'half-frame-socket'
                || mode === 'shifted-socket'
                || mode === 'mixed-plus'
                || mode === 'mixed-reentrant';
        });
        if (hasFrameProfileBreakJoint && Number(dividerJoint.faceSpan) > 0) {
            const halfDividerFace = Number(dividerJoint.faceSpan) / 2;
            const frameInwardSpan = Math.max(
                0,
                Number(dividerJoint.frameInwardSpan) || 0
            );
            const straightContactSpan = Math.max(
                0,
                frameInwardSpan - halfDividerFace
            );
            const unsplitGeom = geom;
            geom = splitBufferGeometryAtScalarZero(unsplitGeom, rawPoint => {
                const cadPoint = getProfileCadPointMm(profile, rawPoint.x, rawPoint.y);
                const yCad = cadPoint.y;
                let inwardMm;
                if (currentMetadata.isVertical) {
                    inwardMm = profile.section === 'bottom'
                        ? yCad - currentMetadata.globalMinY
                        : currentMetadata.globalMaxY - yCad;
                } else {
                    inwardMm = yCad - currentMetadata.globalMinY;
                }
                return inwardMm * S - straightContactSpan;
            });
            unsplitGeom.dispose();
        }

        const posAttribute = geom.attributes.position;
        const v = new THREE.Vector3();

        for (let i = 0; i < posAttribute.count; i++) {
            v.fromBufferAttribute(posAttribute, i);

            // Reconstruct and align CAD coordinates from SVG space.
            const cadPoint = getProfileCadPointMm(profile, v.x, v.y);
            const x_cad = cadPoint.x;
            const y_cad = cadPoint.y;

            // Center X coordinates around 0
            let x_norm = x_cad - currentMetadata.globalCenterX;

            // Normalize Y coordinate based on drawing type (Horizontal vs Vertical)
            let y_norm;
            if (currentMetadata.isVertical) {
                // For vertical profile: Top is Frame (inw=0), Bottom is Sash (inw=max)
                if (profile.section === 'bottom') {
                    y_norm = y_cad - currentMetadata.globalMinY;
                } else {
                    y_norm = currentMetadata.globalMaxY - y_cad;
                }
            } else {
                // For horizontal profile: Bottom is Frame (inw=0), Top is Sash (inw=max)
                y_norm = y_cad - currentMetadata.globalMinY;
            }

            let u = x_norm * S;       // Profile depth (Z axis in 3D profile space)
            let inw = y_norm * S;     // Profile height (inward distance to glass)

            // Scale v.z (which is between 0 and 1.0 in the template) to the new length
            let zScaled = v.z * length;
            let zRaw = zScaled - length / 2;

            // Outer corners keep the normal full 45-degree miter. At a
            // divider joint, the outer part of the split frame stays vertical
            // on the centre plane so the left/right pieces still touch each
            // other. Only the inner part opens at 45° to receive the mullion V.
            const resolveFrameEndInset = localEnd => {
                const mode = getFrameJointEndMode(localEnd);
                if (mode === 'square') return 0;
                if (mode === 'reverse-miter') {
                    return getFrameReentrantMiterInset({
                        inwardDistance: inw,
                        frameInwardSpan: dividerJoint.frameInwardSpan,
                        dividerFaceSpan: dividerJoint.faceSpan,
                        frameBoundaryOffset: dividerJoint.reentrantFrameBoundaryOffset,
                    });
                }
                if (mode === 'socket') {
                    return getFrameDividerSocketInset({
                        inwardDistance: inw,
                        dividerFaceSpan: dividerJoint.faceSpan,
                        frameInwardSpan: dividerJoint.frameInwardSpan,
                    });
                }
                if (mode === 'half-frame-socket') {
                    return getFrameHalfFrameSocketInset({
                        inwardDistance: inw,
                        dividerFaceSpan: dividerJoint.faceSpan,
                        frameInwardSpan: dividerJoint.frameInwardSpan,
                    });
                }
                if (mode === 'inside-half-frame') {
                    return getFrameInsideHalfFrameInset({
                        inwardDistance: inw,
                        frameInwardSpan: dividerJoint.frameInwardSpan,
                        halfFrameSpan: RECTANGULAR_DIVIDER_SETBACK_M,
                    });
                }
                if (mode === 'grid-miter') {
                    return getFrameGridMiterInset({
                        inwardDistance: inw,
                        dividerFaceSpan: dividerJoint.faceSpan,
                        frameInwardSpan: dividerJoint.frameInwardSpan,
                    });
                }
                if (mode === 'shifted-socket') {
                    const worldCenterShift = Number(frameJointCenterShifts?.[localEnd]) || 0;
                    const localAxisSign = side === 'bottom' || side === 'right' ? -1 : 1;
                    return getFrameShiftedDividerSocketInset({
                        inwardDistance: inw,
                        dividerFaceSpan: dividerJoint.faceSpan,
                        frameInwardSpan: dividerJoint.frameInwardSpan,
                        centerShift: worldCenterShift * localAxisSign,
                        localEnd,
                    });
                }
                if (mode === 'mixed-plus' || mode === 'mixed-reentrant') {
                    return getFrameMixedPlusMiterInset({
                        inwardDistance: inw,
                        dividerFaceSpan: dividerJoint.faceSpan,
                        frameInwardSpan: dividerJoint.frameInwardSpan,
                    });
                }
                return inw;
            };
            const positiveEndInset = resolveFrameEndInset('positive');
            const negativeEndInset = resolveFrameEndInset('negative');
            let z_cut = zRaw > 0
                ? zRaw - positiveEndInset
                : zRaw + negativeEndInset;

            // Orient the side correctly around the window frame
            let xw, yw, zw = u;

            if (side === 'bottom') {
                xw = -z_cut;
                yw = -lengthB / 2 + inw;
            }
            else if (side === 'top') {
                xw = z_cut;
                yw = lengthB / 2 - inw;
            }
            else if (side === 'left') {
                xw = -lengthA / 2 + inw;
                yw = z_cut;
            }
            else if (side === 'right') {
                xw = lengthA / 2 - inw;
                yw = -z_cut;
            }

            posAttribute.setXYZ(i, xw, yw, zw);
        }

        posAttribute.needsUpdate = true;

        // Recalculate lighting normals from the final transformed and mitered geometry.
        geom.deleteAttribute('normal');
        geom.computeVertexNormals();
        geom.normalizeNormals();

        geom.computeBoundingBox();
        geom.computeBoundingSphere();

        const mesh = geometry.profileMesh(geom, profile.material, isHorizontal ? 'x' : 'y');
        mesh.position.set(originX, originY, 0);
        mesh.castShadow = !captureMode;
        mesh.receiveShadow = !captureMode;

        const group = getProfileGroup(profile);
        mesh.userData.componentSelection = {
            name: getProfileComponentNumber(profile),
            source: group,
            componentId: profile.componentId,
            componentType: profile.componentType,
            profileIndex: profile.index,
            legacyIndex: profile.legacyIndex,
            side,
        };
        componentSelection.add(mesh);

        // Map each group to its outward explosion offset (X/Y)
        const EXPLODE_XY_OFFSETS = {
            frame: 0.0,
            sash: 0.12,
            bead: 0.18
        };
        const actualExpDist = EXPLODE_XY_OFFSETS[group] !== undefined ? EXPLODE_XY_OFFSETS[group] : expDist;

        // Keep every profile moving perpendicular to its own length, but choose
        // the sign from its physical position relative to the complete window
        // configuration. This prevents profiles belonging to added bays from
        // exploding back toward the first bay instead of away from the whole
        // construction.
        const explodeAxis = (side === 'left' || side === 'right') ? 'x' : 'y';
        const fallbackSign = (side === 'left' || side === 'bottom') ? -1 : 1;
        const expZ = EXPLODE_Z_OFFSETS[group] !== undefined ? EXPLODE_Z_OFFSETS[group] : 0.0;

        registerOutwardAxisExplode(mesh, explodeAxis, actualExpDist, expZ, fallbackSign);
        return mesh;
    }

    // SCENE ELEMENTS
    const WINDOW_GROUND_CLEARANCE_M = 0.02;
    const placementRoot = new THREE.Group();
    const mainGroup = new THREE.Group();
    const pivotOscilo = new THREE.Group();
    const pivotBatant = new THREE.Group();
    let handleLeverGroup = new THREE.Group();
    let sashPoseAssemblies = [];
    const sashPoseAnglesByCell = new Map();
    let activePoseCellId = null;
    let poseStateInitialized = false;
    let handleHitMeshes = [];
    let glassHitMeshes = [];
    let lastBuiltHandleSide = null;
    let handleHoldUntil = 0;
    let handleAngleAnimation = null;

    const HANDLE_CLICK_DRAG_THRESHOLD_PX = 5;
    const HANDLE_CLOSED_EPSILON_DEG = 0.5;
    const handleRaycaster = new THREE.Raycaster();
    const handlePointer = new THREE.Vector2();
    let handlePointerStart = null;

    function getOpeningAngleLimit() {
        const input = document.getElementById('openAngle');
        const fallback = document.getElementById('mBatant')?.checked ? 80 : 15;
        const max = Number.parseFloat(input?.max);
        return Number.isFinite(max) ? max : fallback;
    }

    function easeHandleMotion(t) {
        const clamped = Math.min(1, Math.max(0, t));
        // Smootherstep gives the sash zero velocity at both ends, especially
        // avoiding the abrupt stop that a linear/ordinary lerp produces.
        return clamped * clamped * clamped * (
            clamped * (clamped * 6 - 15) + 10
        );
    }

    function clampOpeningAngle(value, maxAngle = getOpeningAngleLimit()) {
        return Math.min(maxAngle, Math.max(0, Number.parseFloat(value) || 0));
    }

    function getPoseAngle(cellId) {
        const id = cellId ? String(cellId) : null;
        if (!id) return 0;
        return clampOpeningAngle(sashPoseAnglesByCell.get(id) || 0);
    }

    function setPoseAngle(cellId, value) {
        const id = cellId ? String(cellId) : null;
        if (!id) return 0;
        const clamped = clampOpeningAngle(value);
        sashPoseAnglesByCell.set(id, clamped);
        return clamped;
    }

    function hasPoseAssembly(cellId) {
        const id = cellId ? String(cellId) : null;
        return Boolean(id && sashPoseAssemblies.some(assembly => String(assembly.cellId) === id));
    }

    function getActivePoseCellId() {
        if (activePoseCellId && hasPoseAssembly(activePoseCellId)) {
            return String(activePoseCellId);
        }
        if (selectedGlassCellId && hasPoseAssembly(selectedGlassCellId)) {
            return String(selectedGlassCellId);
        }
        return sashPoseAssemblies[0]?.cellId ? String(sashPoseAssemblies[0].cellId) : null;
    }

    function syncOpenAngleControl(cellId = getActivePoseCellId()) {
        const input = document.getElementById('openAngle');
        const value = cellId ? getPoseAngle(cellId) : 0;
        if (input) input.value = String(Math.round(value));
        const valAngleEl = document.getElementById('valAngle');
        if (valAngleEl) valAngleEl.innerText = `${Math.round(value)}°`;
    }

    function startHandleAngleToggle(cellId) {
        const id = cellId ? String(cellId) : null;
        if (!id || !hasPoseAssembly(id)) return false;

        const maxAngle = getOpeningAngleLimit();
        const from = getPoseAngle(id);
        const isSameAnimation = handleAngleAnimation?.cellId === id;
        // A second click on the same moving sash means close. Otherwise only
        // the clicked sash toggles between closed and the current mode limit.
        const to = isSameAnimation
            ? 0
            : (from > HANDLE_CLOSED_EPSILON_DEG ? 0 : maxAngle);
        const travelRatio = maxAngle > 0 ? Math.abs(to - from) / maxAngle : 1;

        activePoseCellId = id;
        handleAngleAnimation = {
            cellId: id,
            from,
            to,
            maxAngle,
            startedAt: performance.now(),
            durationMs: 300 + 400 * travelRatio,
        };
        syncOpenAngleControl(id);
        return true;
    }

    function cancelHandleAngleAnimation() {
        handleAngleAnimation = null;
    }

    function handleOpenAngleInput() {
        const input = document.getElementById('openAngle');
        const cellId = getActivePoseCellId();
        if (!input || !cellId) return;
        activePoseCellId = cellId;
        handleAngleAnimation = null;
        const value = setPoseAngle(cellId, input.value);
        const valAngleEl = document.getElementById('valAngle');
        if (valAngleEl) valAngleEl.innerText = `${Math.round(value)}°`;
    }

    function raycastMeshes(clientX, clientY, meshes) {
        const domElement = renderer?.domElement;
        if (!domElement || !meshes.length) return null;
        const rect = domElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;

        handlePointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        handlePointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        handleRaycaster.setFromCamera(handlePointer, camera);
        scene.updateMatrixWorld(true);
        return handleRaycaster.intersectObjects(meshes, false)[0] || null;
    }

    function raycastHandle(clientX, clientY) {
        return raycastMeshes(clientX, clientY, handleHitMeshes)?.object || null;
    }

    function raycastGlass(clientX, clientY) {
        return raycastMeshes(clientX, clientY, glassHitMeshes);
    }

    function handleCanvasPointerDown(event) {
        if (event.button !== 0) {
            handlePointerStart = null;
            return;
        }
        handlePointerStart = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
        };
    }

    function handleCanvasPointerUp(event) {
        const start = handlePointerStart;
        handlePointerStart = null;
        if (!start || start.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > HANDLE_CLICK_DRAG_THRESHOLD_PX) {
            return;
        }
        const handleObject = raycastHandle(event.clientX, event.clientY);
        if (handleObject) {
            const handleCellId = handleObject.userData?.windowHandleCellId;
            if (startHandleAngleToggle(handleCellId)) {
                event.preventDefault();
            }
            return;
        }

        const glassHit = raycastGlass(event.clientX, event.clientY);
        const cellId = glassHit?.object?.userData?.windowGlassCellId;
        if (cellId) {
            onGlassClick({
                cellId,
                point: glassHit.point?.clone?.() || null,
                object: glassHit.object,
            });
            event.preventDefault();
        }
    }

    function handleCanvasPointerCancel() {
        handlePointerStart = null;
    }

    if (!isARMode && !captureMode && renderer?.domElement) {
        renderer.domElement.addEventListener('pointerdown', handleCanvasPointerDown);
        renderer.domElement.addEventListener('pointerup', handleCanvasPointerUp);
        renderer.domElement.addEventListener('pointercancel', handleCanvasPointerCancel);
        document.getElementById('openAngle')?.addEventListener('input', cancelHandleAngleAnimation);
        document.getElementById('openAngle')?.addEventListener('input', handleOpenAngleInput);
    }

    placementRoot.add(mainGroup);
    placementRoot.visible = !isARMode;
    scene.add(placementRoot);

    const { buildHouse } = createHouseBuilder({
        geometryLibrary: geometry.library,
        scene,
        ground,
        gridHelper,
        isARMode,
        captureMode,
    });

    function getHouseExplodedWindowForwardOffset() {
        const showHouse = document.getElementById('cShowHouse')?.checked === true;
        if (isARMode || !showHouse) {
            return 0;
        }

        const width = Number.parseFloat(document.getElementById('widthA')?.value)
            || WINDOW_WIDTH_MAX_M;
        const height = Number.parseFloat(document.getElementById('heightB')?.value) || 1.5;
        const houseDimensions = getHouseDimensions(width, height);

        // Pull the whole window slightly toward the camera while exploded so
        // no frame sections appear embedded inside the front wall thickness.
        return houseDimensions.wallThickness + 0.05;
    }

    function applyExplodedWindowForwardOffset(progress) {
        mainGroup.position.z = getHouseExplodedWindowForwardOffset() * progress;
    }

    function alignWindowLayoutAboveGround() {
        if (isARMode) return;

        // Rebuilds must start from the normal authored placement. If a previous
        // taller topology needed an upward correction, shrinking it again must
        // not leave the whole configurator permanently floating higher.
        placementRoot.position.y = 0;
        placementRoot.updateWorldMatrix(true, true);
        mainGroup.updateWorldMatrix(true, true);

        const bounds = new THREE.Box3().setFromObject(mainGroup, true);
        if (bounds.isEmpty()) return;

        const groundY = Number(ground?.position?.y);
        if (!Number.isFinite(groundY)) return;

        const minimumAllowedY = groundY + WINDOW_GROUND_CLEARANCE_M;
        if (bounds.min.y < minimumAllowedY) {
            placementRoot.position.y = minimumAllowedY - bounds.min.y;
            placementRoot.updateWorldMatrix(true, true);
        }
    }

    const sectionGroup = new THREE.Group();
    // Positioned in front of the camera, floating at eye level
    sectionGroup.position.set(0.7, 0.35, 1.1);
    sectionGroup.visible = !isARMode && !captureMode;
    scene.add(sectionGroup);

    function profileCadCenterX(profile) {
        const bbox = getEffectiveProfileBbox(profile);
        return bbox ? (bbox.minX + bbox.maxX) / 2 : 0;
    }

    function profileCadCenterY(profile) {
        const bbox = getEffectiveProfileBbox(profile);
        return bbox ? (bbox.minY + bbox.maxY) / 2 : 0;
    }

    function isFixedGlassAnchorGasket(profile) {
        return String(profile?.blockName || '').includes('224063');
    }

    function isFrameToSashRebateGasket(profile) {
        return profile?.role === 'frame'
            && String(profile?.blockName || '').includes('245472');
    }

    function isMovingGlazingBeadGasket(profile) {
        return String(profile?.blockName || '').includes('224378') || profile.isGasketTemplate === true;
    }

    function accessoryRequiresOpeningSashConnection(profile) {
        const catalogEntry = getProfileCatalogEntry(profile);
        const connectionCellTypes = catalogEntry?.attachment?.connectionCellTypes || [];
        return catalogEntry?.type === 'profile-accessory'
            && connectionCellTypes.includes('opening-sash')
            && !connectionCellTypes.includes('fixed-glazing');
    }

    function getEditableDividerSideCellType(segment, runtimeCellSide) {
        const cellId = runtimeCellSide === 'left'
            ? segment?.negativeCellId
            : (runtimeCellSide === 'right' ? segment?.positiveCellId : null);
        if (!cellId) return null;
        return editableTopologyGeometry?.cells?.find(cell => cell.id === cellId)?.cellType || null;
    }

    function shouldRenderEditableMullionAccessory(profile, segment, runtimeCellSide) {
        if (!accessoryRequiresOpeningSashConnection(profile)) return true;
        return getEditableDividerSideCellType(segment, runtimeCellSide) === 'opening-sash';
    }

    function shouldRenderMullionAccessory(profile, cellSide, dividerOrientation, dividerIndex, layoutCellTypes, segmentId = null, isTLayout = false) {
        if (!dividerOrientation) return true;

        let sideCellType = null;
        if (isTLayout) {
            if (dividerOrientation === 'vertical') {
                sideCellType = cellSide === 'left' ? layoutCellTypes[1] : layoutCellTypes[2];
            } else {
                if (cellSide === 'left') {
                    sideCellType = layoutCellTypes[0];
                } else {
                    if (segmentId === 'left') {
                        sideCellType = layoutCellTypes[1];
                    } else if (segmentId === 'right') {
                        sideCellType = layoutCellTypes[2];
                    } else {
                        sideCellType = layoutCellTypes[1] || layoutCellTypes[2];
                    }
                }
            }
        } else {
            sideCellType = cellSide === 'left'
                ? layoutCellTypes[dividerIndex]
                : layoutCellTypes[dividerIndex + 1];
        }

        if (isFrameToSashRebateGasket(profile) && sideCellType !== 'opening-sash') {
            return false;
        }
        if (
            accessoryRequiresOpeningSashConnection(profile)
            && sideCellType !== 'opening-sash'
        ) {
            return false;
        }
        if (isFixedGlassAnchorGasket(profile) && sideCellType !== 'fixed-glazing') {
            return false;
        }
        return true;
    }

    function resolveAnchoredGlassDepth(cavity, thicknessMm, fallbackCenterZ) {
        if (!cavity) {
            return {
                centerZ: fallbackCenterZ,
                anchorGasket: null,
                movingGasket: null,
                fixedFaceCadX: null,
                movingFaceCadX: null,
                direction: 0,
            };
        }

        const pair = [cavity.leftGasket, cavity.rightGasket];
        const anchorGasket = pair.find(isFixedGlassAnchorGasket) || null;
        const movingGasket = pair.find(isMovingGlazingBeadGasket) || null;

        if (!anchorGasket) {
            return {
                centerZ: (cavity.cavityCenterX - currentMetadata.globalCenterX) * S,
                anchorGasket: null,
                movingGasket,
                fixedFaceCadX: null,
                movingFaceCadX: null,
                direction: 0,
            };
        }

        const anchorBbox = getEffectiveProfileBbox(anchorGasket);
        if (!anchorBbox) {
            return {
                centerZ: (cavity.cavityCenterX - currentMetadata.globalCenterX) * S,
                anchorGasket,
                movingGasket,
                fixedFaceCadX: null,
                movingFaceCadX: null,
                direction: 0,
            };
        }

        const anchorIsLeft = profileCadCenterX(anchorGasket) <= cavity.cavityCenterX;
        const direction = anchorIsLeft ? 1 : -1;

        // Keep this glass face fixed beside 224063. Only the opposite face
        // moves when the glass thickness changes.
        const anchorClearanceMm = 1;
        const anchorContactCadX = anchorIsLeft
            ? anchorBbox.maxX
            : anchorBbox.minX;
        const fixedFaceCadX =
            anchorContactCadX + direction * anchorClearanceMm;
        const movingFaceCadX =
            fixedFaceCadX + direction * thicknessMm;
        const centerCadX =
            (fixedFaceCadX + movingFaceCadX) / 2;

        return {
            centerZ: (centerCadX - currentMetadata.globalCenterX) * S,
            anchorGasket,
            movingGasket,
            fixedFaceCadX,
            movingFaceCadX,
            direction,
        };
    }

    function isPotentialGlazingGasket(profile) {
        const effectiveBbox = getEffectiveProfileBbox(profile);
        if (
            !effectiveBbox
            || !Number.isFinite(effectiveBbox.minX)
            || !Number.isFinite(effectiveBbox.maxX)
            || !Number.isFinite(effectiveBbox.minY)
            || !Number.isFinite(effectiveBbox.maxY)
        ) {
            return false;
        }

        const blockName = String(profile.blockName || '').toLowerCase();
        const layer = String(profile.layer || '').toLowerCase();
        const cadColour = normalizeHexColour(profile.baseCadColor);

        // Do not rely only on materialKey: some real gasket blocks are placed
        // on an aluminium CAD layer and therefore get classified as aluminium.
        const gasketIdentity =
            profile.materialKey === 'epdm'
            || profile.materialKey === 'centralSeal'
            || /^(224|244)/.test(blockName)
            || blockName.includes('dicht')
            || layer.includes('epdm')
            || layer.includes('dichtung');

        const gasketColour =
            cadColour === '#ffbf7f'
            || cadColour === '#ea580c'
            || cadColour === '#38bdf8';

        return profile.role === 'sash' && (gasketIdentity || gasketColour);
    }

    function cadYToInwardDistanceMm(cadY, section = 'top') {
        if (currentMetadata.isVertical) {
            // Match createMiteredSide(): the split bottom profile is mapped
            // from globalMinY, while the top/side profile is mapped from
            // globalMaxY.
            if (section === 'bottom') {
                return cadY - Number(currentMetadata.globalMinY);
            }
            return Number(currentMetadata.globalMaxY) - cadY;
        }
        return cadY - Number(currentMetadata.globalMinY);
    }

    function findAutomaticGlazingCavity(section = null) {
        const gasketProfiles = profilesData
            .filter(profile =>
                isPotentialGlazingGasket(profile)
                && (!section || profile.section === section)
            )
            .sort((a, b) => profileCadCenterX(a) - profileCadCenterX(b));

        const candidates = [];

        for (let leftIndex = 0; leftIndex < gasketProfiles.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < gasketProfiles.length; rightIndex += 1) {
                const leftGasket = gasketProfiles[leftIndex];
                const rightGasket = gasketProfiles[rightIndex];
                const leftBbox = getEffectiveProfileBbox(leftGasket);
                const rightBbox = getEffectiveProfileBbox(rightGasket);

                if (!leftBbox || !rightBbox) {
                    continue;
                }

                const cavityMinX = leftBbox.maxX;
                const cavityMaxX = rightBbox.minX;
                const cavityWidthMm = cavityMaxX - cavityMinX;

                if (!Number.isFinite(cavityWidthMm) || cavityWidthMm < 4 || cavityWidthMm > 80) {
                    continue;
                }

                // Opposing glazing gaskets must occupy the same cross-section
                // height. This rejects unrelated seals that merely happen to be
                // separated along the CAD X/depth axis.
                const overlapMinY = Math.max(
                    leftBbox.minY,
                    rightBbox.minY
                );
                const overlapMaxY = Math.min(
                    leftBbox.maxY,
                    rightBbox.maxY
                );
                const overlapHeightMm = overlapMaxY - overlapMinY;

                if (!Number.isFinite(overlapHeightMm) || overlapHeightMm < 1.5) {
                    continue;
                }

                const smallerGasketHeightMm = Math.min(
                    leftBbox.maxY - leftBbox.minY,
                    rightBbox.maxY - rightBbox.minY
                );
                const overlapRatio = overlapHeightMm / Math.max(0.001, smallerGasketHeightMm);

                if (overlapRatio < 0.25) {
                    continue;
                }

                const cavityCenterX = (cavityMinX + cavityMaxX) / 2;

                // Determine the opening-side tip of EACH gasket separately.
                // Using only the common overlap was too conservative and left
                // a visible gap on profiles where one sealing lip extends
                // farther toward the opening.
                const resolvedSection =
                    section
                    || leftGasket.section
                    || rightGasket.section
                    || 'top';

                const leftEdgeInsetMm = Math.min(
                    cadYToInwardDistanceMm(leftBbox.minY, resolvedSection),
                    cadYToInwardDistanceMm(leftBbox.maxY, resolvedSection)
                );
                const rightEdgeInsetMm = Math.min(
                    cadYToInwardDistanceMm(rightBbox.minY, resolvedSection),
                    cadYToInwardDistanceMm(rightBbox.maxY, resolvedSection)
                );

                // Extend the pane to the outermost gasket lip, then seat it
                // slightly behind the lip so no background line remains visible.
                const openingSideInsetMm = Math.min(leftEdgeInsetMm, rightEdgeInsetMm);
                const gasketSeatMm = Math.min(
                    6,
                    Math.max(2, overlapHeightMm * 0.35)
                );
                const glazingInsetMm = Math.max(0, openingSideInsetMm - gasketSeatMm);

                // Prefer strong Y overlap and realistic insulating-glass depth.
                const targetWidthMm = 28;
                const widthPenalty = Math.abs(cavityWidthMm - targetWidthMm) * 0.35;
                const overlapPenalty = (1 - Math.min(1, overlapRatio)) * 30;

                candidates.push({
                    leftGasket,
                    rightGasket,
                    cavityMinX,
                    cavityMaxX,
                    cavityWidthMm,
                    cavityCenterX,
                    overlapMinY,
                    overlapMaxY,
                    overlapHeightMm,
                    overlapRatio,
                    glazingInsetMm,
                    score: widthPenalty + overlapPenalty,
                });
            }
        }

        candidates.sort((a, b) => a.score - b.score);
        return candidates[0] || null;
    }

    function resolveGlassPlacement(fallbackCenterZ) {
        // Top/left/right use the top cross-section in split vertical profiles.
        // Bottom uses the bottom cross-section. For non-split profiles the same
        // detected cavity is used on every side.
        const defaultCavity = findAutomaticGlazingCavity();
        const topCavity = currentMetadata.hasSplit
            ? (findAutomaticGlazingCavity('top') || defaultCavity)
            : defaultCavity;
        const bottomCavity = currentMetadata.hasSplit
            ? (findAutomaticGlazingCavity('bottom') || topCavity || defaultCavity)
            : defaultCavity;

        const depthCavity = topCavity || bottomCavity || defaultCavity;
        const requestedThicknessMm = Math.min(
            29,
            Math.max(16, Number.parseFloat(glassThicknessInput.value) || 24)
        );

        if (!depthCavity) {
            glassThicknessInput.max = '29';
            glassThicknessInput.value = String(requestedThicknessMm);
            if (glassThicknessLabel) {
                glassThicknessLabel.textContent = `${requestedThicknessMm.toFixed(0)} mm`;
            }

            return {
                centerZ: fallbackCenterZ,
                thicknessMm: requestedThicknessMm,
                leftInsetMm: 100,
                rightInsetMm: 100,
                topInsetMm: 100,
                bottomInsetMm: 100,
                cavity: null,
            };
        }

        // The available bead catalogue defines the supported range.
        // Do not let the legacy cavity-width heuristic reduce the UI maximum.
        const effectiveThicknessMm = Math.min(29, Math.max(16, requestedThicknessMm));

        glassThicknessInput.min = '16';
        glassThicknessInput.max = '29';
        glassThicknessInput.value = String(effectiveThicknessMm);
        if (glassThicknessLabel) {
            glassThicknessLabel.textContent = `${effectiveThicknessMm.toFixed(0)} mm`;
        }

        const topSideInsetMm = Math.min(
            250,
            Math.max(0, (topCavity || depthCavity).glazingInsetMm)
        );
        const bottomInsetMm = Math.min(
            250,
            Math.max(0, (bottomCavity || depthCavity).glazingInsetMm)
        );



        const anchoredDepth = resolveAnchoredGlassDepth(
            depthCavity,
            effectiveThicknessMm,
            fallbackCenterZ
        );

        return {
            centerZ: anchoredDepth.centerZ,
            thicknessMm: effectiveThicknessMm,
            leftInsetMm: topSideInsetMm,
            rightInsetMm: topSideInsetMm,
            topInsetMm: topSideInsetMm,
            bottomInsetMm,
            cavity: depthCavity,
            anchorGasket: anchoredDepth.anchorGasket,
            movingGasket: anchoredDepth.movingGasket,
            fixedFaceCadX: anchoredDepth.fixedFaceCadX,
            movingFaceCadX: anchoredDepth.movingFaceCadX,
            depthDirection: anchoredDepth.direction,
        };
    }

    function clearGeneratedGroup(group, sharedGeometries = null) {
        const shared = sharedGeometries || new Set();

        // Keep cached profile materials; only generated label sprites own theirs.
        geometry.disposeGenerated(group, shared);

        group.clear();
    }

    const dimLineMaterial = new THREE.LineBasicMaterial({
        color: 0x38bdf8
    });

    function createLabelSprite(text, scale = 1) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;

        // Draw capsule background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; // dark slate
        ctx.strokeStyle = '#38bdf8'; // sky blue border
        ctx.lineWidth = 4;

        const x = 32;
        const y = 32;
        const w = 192;
        const h = 64;
        const r = 32; // fully rounded corners

        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw text
        ctx.fillStyle = '#eff6ff'; // off white
        ctx.font = 'bold 28px Outfit, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        const safeScale = Math.max(0.4, Number(scale) || 1);
        sprite.scale.set(0.35 * safeScale, 0.175 * safeScale, 1);
        return sprite;
    }

    function getWindowNumber(_cellId, fallbackIndex = 0) {
        // Window IDs are stable topology identifiers and can legitimately skip
        // after merge/delete operations. Visible numbering is always dense and
        // follows the current rendered cell order instead of exposing those IDs.
        return Math.max(1, Number(fallbackIndex) + 1);
    }

    function createGlassNumberSprite(cellId, fallbackIndex = 0) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 128px Outfit, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(getWindowNumber(cellId, fallbackIndex)), 64, 66);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            color: String(cellId) === String(selectedGlassCellId) ? 0x7dd3fc : 0xffffff,
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.12, 0.12, 1);
        sprite.renderOrder = 20;
        sprite.userData.windowNumberCellId = String(cellId || '');
        glassNumberSprites.set(String(cellId || ''), sprite);
        return sprite;
    }

    function setSelectedGlassCell(cellId) {
        selectedGlassCellId = cellId ? String(cellId) : null;
        glassNumberSprites.forEach((sprite, id) => {
            if (!sprite?.material?.color) return;
            sprite.material.color.setHex(id === selectedGlassCellId ? 0x7dd3fc : 0xffffff);
        });
        if (selectedGlassCellId && hasPoseAssembly(selectedGlassCellId)) {
            activePoseCellId = selectedGlassCellId;
            syncOpenAngleControl(selectedGlassCellId);
        }
    }

    function buildDimensionLines(A, B, activeProfiles = []) {
        const dimensionsGroup = new THREE.Group();
        mainGroup.add(dimensionsGroup);

        const zPos = 0.052;
        const tickSize = 0.04;
        const offset = 0.15;

        function addLineSegment(p1, p2) {
            const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
            const line = new THREE.Line(geom, dimLineMaterial);
            dimensionsGroup.add(line);
        }

        // A/B are one bay's slider dimensions. For an editable multi-window
        // layout the dimension guides must span the complete construction, not
        // just that one bay. Frame placement perpendicular offsets are the
        // actual outside aluminium boundaries (including the asymmetric frame
        // reference offset), so they are the most direct source of truth.
        let minX = -A / 2;
        let maxX = A / 2;
        let minY = -B / 2;
        let maxY = B / 2;

        if (editableTopologyGeometry) {
            const geometryMinX = Number(editableTopologyGeometry.overallMinX);
            const geometryMaxX = Number(editableTopologyGeometry.overallMaxX);
            const geometryMinY = Number(editableTopologyGeometry.overallMinY);
            const geometryMaxY = Number(editableTopologyGeometry.overallMaxY);
            if ([geometryMinX, geometryMaxX].every(Number.isFinite)) {
                minX = geometryMinX;
                maxX = geometryMaxX;
            }
            if ([geometryMinY, geometryMaxY].every(Number.isFinite)) {
                minY = geometryMinY;
                maxY = geometryMaxY;
            }
        }

        const constructionWidth = Math.max(0, maxX - minX);
        const constructionHeight = Math.max(0, maxY - minY);
        const constructionCenterX = (minX + maxX) / 2;
        const constructionCenterY = (minY + maxY) / 2;

        // 1. TOP DIMENSION (Width)
        // const topY = maxY + offset;
        // addLineSegment(new THREE.Vector3(minX, topY, zPos), new THREE.Vector3(maxX, topY, zPos));
        // addLineSegment(new THREE.Vector3(minX, topY - tickSize, zPos), new THREE.Vector3(minX, topY + tickSize, zPos));
        // addLineSegment(new THREE.Vector3(maxX, topY - tickSize, zPos), new THREE.Vector3(maxX, topY + tickSize, zPos));

        // const topLabel = createLabelSprite(`${Math.round(constructionWidth * 1000)} mm`);
        // topLabel.position.set(constructionCenterX, topY, zPos);
        // dimensionsGroup.add(topLabel);

        // 2. BOTTOM DIMENSION (Width)
        const bottomY = minY - offset;
        addLineSegment(new THREE.Vector3(minX, bottomY, zPos), new THREE.Vector3(maxX, bottomY, zPos));
        addLineSegment(new THREE.Vector3(minX, bottomY - tickSize, zPos), new THREE.Vector3(minX, bottomY + tickSize, zPos));
        addLineSegment(new THREE.Vector3(maxX, bottomY - tickSize, zPos), new THREE.Vector3(maxX, bottomY + tickSize, zPos));

        const bottomLabel = createLabelSprite(`${Math.round(constructionWidth * 1000)} mm`);
        bottomLabel.position.set(constructionCenterX, bottomY, zPos);
        dimensionsGroup.add(bottomLabel);

        // 3. LEFT DIMENSION (Height)
        const leftX = minX - offset;
        addLineSegment(new THREE.Vector3(leftX, minY, zPos), new THREE.Vector3(leftX, maxY, zPos));
        addLineSegment(new THREE.Vector3(leftX - tickSize, minY, zPos), new THREE.Vector3(leftX + tickSize, minY, zPos));
        addLineSegment(new THREE.Vector3(leftX - tickSize, maxY, zPos), new THREE.Vector3(leftX + tickSize, maxY, zPos));

        const leftLabel = createLabelSprite(`${Math.round(constructionHeight * 1000)} mm`);
        leftLabel.position.set(leftX, constructionCenterY, zPos);
        dimensionsGroup.add(leftLabel);

        // Individual window dimensions are projected to the OUTSIDE margins
        // of the complete construction. This keeps the model readable: width
        // bars live only above the layout and height bars only to its right,
        // rather than drawing a pair of guides around every cell. Identical
        // spans are deduplicated (for example two windows in the same column).
        if (editableTopologyGeometry?.cells?.length) {
            const localOffset = 0.075;
            const localTick = 0.025;
            const laneGap = 0.06;

            const uniqueItems = (items) => {
                const seen = new Set();
                return items.filter(item => {
                    const key = [item.start, item.end, item.value]
                        .map(value => Number(value).toFixed(6))
                        .join(':');
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
            };

            const assignLanes = (items) => {
                const laneEnds = [];
                return [...items]
                    .sort((a, b) => a.start - b.start || a.end - b.end)
                    .map(item => {
                        let lane = laneEnds.findIndex(end => item.start >= end - 1e-9);
                        if (lane < 0) {
                            lane = laneEnds.length;
                            laneEnds.push(item.end);
                        } else {
                            laneEnds[lane] = item.end;
                        }
                        return { ...item, lane };
                    });
            };

            const widthItems = uniqueItems(editableTopologyGeometry.cells.flatMap(cell => {
                const start = Number(cell.actualX0);
                const end = Number(cell.actualX1);
                if (![start, end].every(Number.isFinite) || end <= start) return [];
                return [{ start, end, value: Math.max(0, end - start) }];
            }));
            assignLanes(widthItems).forEach(item => {
                const y = maxY + localOffset + item.lane * laneGap;
                addLineSegment(new THREE.Vector3(item.start, y, zPos), new THREE.Vector3(item.end, y, zPos));
                addLineSegment(new THREE.Vector3(item.start, y - localTick, zPos), new THREE.Vector3(item.start, y + localTick, zPos));
                addLineSegment(new THREE.Vector3(item.end, y - localTick, zPos), new THREE.Vector3(item.end, y + localTick, zPos));
                const label = createLabelSprite(`${Math.round(item.value * 1000)} mm`, 0.72);
                label.position.set((item.start + item.end) / 2, y, zPos);
                dimensionsGroup.add(label);
            });

            const heightItems = uniqueItems(editableTopologyGeometry.cells.flatMap(cell => {
                const start = Number(cell.actualY0);
                const end = Number(cell.actualY1);
                if (![start, end].every(Number.isFinite) || end <= start) return [];
                return [{ start, end, value: Math.max(0, end - start) }];
            }));
            assignLanes(heightItems).forEach(item => {
                const x = maxX + localOffset + item.lane * laneGap;
                addLineSegment(new THREE.Vector3(x, item.start, zPos), new THREE.Vector3(x, item.end, zPos));
                addLineSegment(new THREE.Vector3(x - localTick, item.start, zPos), new THREE.Vector3(x + localTick, item.start, zPos));
                addLineSegment(new THREE.Vector3(x - localTick, item.end, zPos), new THREE.Vector3(x + localTick, item.end, zPos));
                const label = createLabelSprite(`${Math.round(item.value * 1000)} mm`, 0.72);
                label.position.set(x, (item.start + item.end) / 2, zPos);
                dimensionsGroup.add(label);
            });
        }

        // 4. RIGHT DIMENSION (Height)
        const rightX = maxX + offset;
        // addLineSegment(new THREE.Vector3(rightX, minY, zPos), new THREE.Vector3(rightX, maxY, zPos));
        // addLineSegment(new THREE.Vector3(rightX - tickSize, minY, zPos), new THREE.Vector3(rightX + tickSize, minY, zPos));
        // addLineSegment(new THREE.Vector3(rightX - tickSize, maxY, zPos), new THREE.Vector3(rightX + tickSize, maxY, zPos));

        // const rightLabel = createLabelSprite(`${Math.round(constructionHeight * 1000)} mm`);
        // rightLabel.position.set(rightX, constructionCenterY, zPos);
        // dimensionsGroup.add(rightLabel);

        // 5. SECTION WIDTH / DEPTH DIMENSION (Z axis)
        const depthX = minX - offset;
        const depthY = minY - offset;

        const isDrainageCoverCap = profile =>
            isDrainageCapProfile(profile)
            || String(profile?.baseCadColor || '').toLowerCase() === '#cc9966';

        // Read depth from the profile meshes that were actually instantiated in
        // this configuration. This is more accurate than looking at one CAD
        // section: divider/trans profiles use a different section axis and can
        // have their own depth placement. Handles and glass have no profile
        // selection metadata, so they are intentionally not part of the window
        // system depth. The drainage cap is explicitly excluded as requested.
        const profileByIndex = new Map(
            profilesData.map(profile => [String(profile.index), profile])
        );
        const mainGroupWorldInverse = new THREE.Matrix4();
        const relativeMatrix = new THREE.Matrix4();
        const localBox = new THREE.Box3();
        let sectionZMin = Infinity;
        let sectionZMax = -Infinity;

        mainGroup.updateWorldMatrix(true, true);
        mainGroupWorldInverse.copy(mainGroup.matrixWorld).invert();

        mainGroup.traverse(object => {
            if (!object.isMesh || !object.geometry) return;

            const selection = object.userData?.componentSelection;
            if (!selection) return;

            const sourceProfile = profileByIndex.get(String(selection.profileIndex));
            if (
                selection.componentType === 'drainage-cap'
                || isDrainageCoverCap(sourceProfile)
            ) {
                return;
            }

            if (!object.geometry.boundingBox) {
                object.geometry.computeBoundingBox();
            }
            if (!object.geometry.boundingBox) return;

            relativeMatrix.multiplyMatrices(
                mainGroupWorldInverse,
                object.matrixWorld
            );
            localBox.copy(object.geometry.boundingBox).applyMatrix4(relativeMatrix);
            sectionZMin = Math.min(sectionZMin, localBox.min.z);
            sectionZMax = Math.max(sectionZMax, localBox.max.z);
        });

        // Fallback for incomplete/custom meshes. Use only active profiles and
        // still exclude the drainage cap; this preserves a useful dimension if
        // a custom profile could not produce selectable mesh metadata.
        if (!Number.isFinite(sectionZMin) || !Number.isFinite(sectionZMax)) {
            let fallbackMinX = Infinity;
            let fallbackMaxX = -Infinity;
            activeProfiles
                .filter(profile => !isDrainageCoverCap(profile))
                .forEach(profile => {
                    const bbox = getEffectiveProfileBbox(profile);
                    if (!bbox) return;
                    fallbackMinX = Math.min(fallbackMinX, bbox.minX);
                    fallbackMaxX = Math.max(fallbackMaxX, bbox.maxX);
                });

            if (Number.isFinite(fallbackMinX) && Number.isFinite(fallbackMaxX)) {
                sectionZMin = (fallbackMinX - currentMetadata.globalCenterX) * S;
                sectionZMax = (fallbackMaxX - currentMetadata.globalCenterX) * S;
            }
        }

        if (Number.isFinite(sectionZMin) && Number.isFinite(sectionZMax)) {
            const sectionDepthMm = Math.round((sectionZMax - sectionZMin) / S);

            // main depth line
            addLineSegment(
                new THREE.Vector3(depthX, depthY, sectionZMin),
                new THREE.Vector3(depthX, depthY, sectionZMax)
            );

            // end ticks
            addLineSegment(
                new THREE.Vector3(depthX - tickSize, depthY, sectionZMin),
                new THREE.Vector3(depthX + tickSize, depthY, sectionZMin)
            );
            addLineSegment(
                new THREE.Vector3(depthX - tickSize, depthY, sectionZMax),
                new THREE.Vector3(depthX + tickSize, depthY, sectionZMax)
            );

            // label
            const depthLabel = createLabelSprite(`${sectionDepthMm} mm`);
            depthLabel.position.set(
                depthX,
                depthY - 0.05,
                (sectionZMin + sectionZMax) / 2
            );
            dimensionsGroup.add(depthLabel);
        }

    }

    let lastSectionSampleSignature = '';

    function getSectionSamplePlacement(profile, preferredSection = 'top') {
        const placements = Array.isArray(profile.sectionSamplePlacements)
            ? profile.sectionSamplePlacements
            : [];
        if (placements.length) {
            const placement = placements.find(item => item.section === preferredSection)
                || placements[0];
            return {
                ...profile,
                section: placement.section || preferredSection,
                cadCoordinateTransform:
                    placement.cadCoordinateTransform || profile.cadCoordinateTransform,
            };
        }

        if (
            (sectionSampleMetadata || currentMetadata)?.hasSplit
            && profile.section
            && profile.section !== preferredSection
        ) {
            return null;
        }
        return profile;
    }

    function createStandardSectionSampleGroup(profiles, preferredSection = 'top') {
        const group = new THREE.Group();
        profiles.forEach(profile => {
            const placedProfile = getSectionSamplePlacement(profile, preferredSection);
            if (!placedProfile) return;
            group.add(createSampleExtrusion(placedProfile));
        });
        return group;
    }

    function getConnectionTransformVariants(profile, fieldNames) {
        const variants = [];
        const seen = new Set();
        fieldNames.forEach(fieldName => {
            Object.entries(profile?.[fieldName] || {}).forEach(([side, transform]) => {
                if (!transform) return;
                const signature = JSON.stringify(transform);
                if (seen.has(signature)) return;
                seen.add(signature);
                variants.push({ side, transform });
            });
        });
        return variants;
    }

    function createDividerSectionSampleGroup({
        baseProfiles,
        accessoryProfiles = [],
        bounds,
        sectionRotationDeg = 180,
    }) {
        const group = new THREE.Group();
        if (!bounds) return group;

        baseProfiles.forEach(profile => {
            group.add(createDividerSampleExtrusion({
                ...profile,
                dividerSectionRotationDeg:
                    Number(profile.dividerSectionRotationDeg)
                    || Number(profile.transSectionRotationDeg)
                    || sectionRotationDeg,
            }, bounds));
        });

        accessoryProfiles.forEach(profile => {
            if (
                (sectionSampleMetadata || currentMetadata)?.hasSplit
                && profile.section === 'bottom'
            ) {
                return;
            }
            const transformVariants = getConnectionTransformVariants(profile, [
                'mullionConnectionCadTransforms',
                'mullionAccessoryCadTransforms',
            ]);
            transformVariants.forEach(({ transform }) => {
                group.add(createDividerSampleExtrusion({
                    ...profile,
                    cadCoordinateTransform: transform,
                    cadAlignmentShiftXMm: 0,
                    cadAlignmentShiftYMm: 0,
                    dividerSectionRotationDeg: sectionRotationDeg,
                }, bounds));
            });
        });

        return group;
    }

    function centerSectionSampleGroup(group) {
        group.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(group);
        if (bounds.isEmpty()) return null;
        const center = bounds.getCenter(new THREE.Vector3());
        group.children.forEach(child => {
            child.position.x -= center.x;
            child.position.y -= center.y;
        });
        group.updateMatrixWorld(true);
        return new THREE.Box3().setFromObject(group);
    }

    function packSectionSampleGroups(groups) {
        const packed = groups
            .map(item => ({
                ...item,
                bounds: centerSectionSampleGroup(item.group),
            }))
            .filter(item => item.bounds && !item.bounds.isEmpty());
        if (!packed.length) return;

        const gap = 0.055;
        const columns = Math.min(2, packed.length);
        const rows = Math.ceil(packed.length / columns);
        const columnWidths = new Array(columns).fill(0);
        const rowHeights = new Array(rows).fill(0);

        packed.forEach((item, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            const size = item.bounds.getSize(new THREE.Vector3());
            columnWidths[column] = Math.max(columnWidths[column], size.x);
            rowHeights[row] = Math.max(rowHeights[row], size.y);
        });

        const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0)
            + gap * Math.max(0, columns - 1);
        const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0)
            + gap * Math.max(0, rows - 1);

        const columnCenters = [];
        let cursorX = -totalWidth / 2;
        columnWidths.forEach(width => {
            columnCenters.push(cursorX + width / 2);
            cursorX += width + gap;
        });

        const rowCenters = [];
        let cursorY = totalHeight / 2;
        rowHeights.forEach(height => {
            rowCenters.push(cursorY - height / 2);
            cursorY -= height + gap;
        });

        packed.forEach((item, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            item.group.position.set(columnCenters[column], rowCenters[row], 0);
            sectionGroup.add(item.group);
        });
    }

    function rebuildSectionSamplesIfNeeded(activeProfiles) {
        if (isARMode || captureMode) {
            return;
        }

        const {
            aluminiumFinishMode,
            outsideFinishSelection,
            insideFinishSelection,
        } = getFinishState();

        const sectionProfiles = sectionSampleProfilesData.length
            ? sectionSampleProfilesData.filter(profile => isProfileEnabled(profile))
            : activeProfiles;

        const mountedTransformSignature = sectionProfiles.map(profile => [
            profile.index,
            Object.keys(profile.mullionConnectionCadTransforms || {}).join(','),
            Object.keys(profile.mullionAccessoryCadTransforms || {}).join(','),
            profile.frameAccessoryCadTransform ? 'frame-mounted' : '',
        ].join(':')).join(';');

        const signature = [
            profileInput.value,
            aluminiumFinishMode,
            outsideFinishSelection.type,
            outsideFinishSelection.color,
            insideFinishSelection.type,
            insideFinishSelection.color,
            getActiveGlazingBeadCode(),
            getActiveGasketCode(),
            getWindowLayoutState().layoutSignature || getWindowLayoutState().layoutId || 'single',
            sectionProfiles.map(profile => profile.index).join(','),
            mountedTransformSignature,
        ].join('|');

        if (signature === lastSectionSampleSignature) {
            return;
        }

        clearGeneratedGroup(sectionGroup);
        lastSectionSampleSignature = signature;

        const frameProfiles = [];
        const sashProfiles = [];
        const dividerProfiles = sectionProfiles.filter(profile => profile.role === 'divider');
        const transProfiles = sectionProfiles.filter(profile => profile.role === 'trans');
        const transGasketProfiles = sectionProfiles.filter(profile => profile.role === 'trans-gasket');

        sectionProfiles.forEach(profile => {
            const profileGroup = getProfileGroup(profile);

            if (profile.frameAccessoryCadTransform) {
                frameProfiles.push({
                    ...profile,
                    cadCoordinateTransform: profile.frameAccessoryCadTransform,
                    cadAlignmentShiftXMm: 0,
                    cadAlignmentShiftYMm: 0,
                });
            } else if (profileGroup === 'frame') {
                frameProfiles.push(profile);
            }

            if (profileGroup === 'sash' || profileGroup === 'bead') {
                sashProfiles.push(profile);
            }
        });

        const dividerAccessoryProfiles = sectionProfiles.filter(profile => (
            Object.keys(profile.mullionConnectionCadTransforms || {}).length
            || Object.keys(profile.mullionAccessoryCadTransforms || {}).length
        ));

        const sampleGroups = [];
        if (frameProfiles.length) {
            sampleGroups.push({
                kind: 'frame',
                group: createStandardSectionSampleGroup(frameProfiles),
            });
        }
        if (sashProfiles.length) {
            sampleGroups.push({
                kind: 'sash',
                group: createStandardSectionSampleGroup(sashProfiles),
            });
        }
        if (dividerProfiles.length) {
            sampleGroups.push({
                kind: 'divider',
                group: createDividerSectionSampleGroup({
                    baseProfiles: dividerProfiles,
                    accessoryProfiles: dividerAccessoryProfiles,
                    bounds: getDividerSourceBounds(dividerProfiles),
                    sectionRotationDeg:
                        Number((sectionSampleMetadata || currentMetadata).dividerConnection?.sectionRotationDeg) || 180,
                }),
            });
        }
        if (transProfiles.length) {
            const transBounds = getTransSourceBounds(transProfiles);
            const transSectionRotationDeg =
                Number((sectionSampleMetadata || currentMetadata).transConnection?.sectionRotationDeg)
                || Number(transProfiles[0]?.transSectionRotationDeg)
                || 180;
            const transSampleProfiles = [
                ...transProfiles,
                ...transGasketProfiles.map(profile => ({
                    ...profile,
                    cadCoordinateTransform:
                        profile.transConnectionCadTransform
                        || profile.cadCoordinateTransform,
                    cadAlignmentShiftXMm: 0,
                    cadAlignmentShiftYMm: 0,
                })),
            ];
            sampleGroups.push({
                kind: 'trans',
                group: createDividerSectionSampleGroup({
                    baseProfiles: transSampleProfiles,
                    bounds: transBounds,
                    sectionRotationDeg: transSectionRotationDeg,
                }),
            });
        }

        packSectionSampleGroups(sampleGroups);
        sectionGroup.lookAt(camera.position);
    }



    function buildWindow() {
        if (!currentMetadata) return;
        const t_start = performance.now();

        componentSelection.reset();

        // Generated geometries are unique and must be disposed. Materials are
        // shared/cached, so disposing them here causes shader recompilation and
        // severe slider lag.
        geometry.disposeGenerated(mainGroup);
        mainGroup.clear();
        pivotOscilo.clear();
        pivotBatant.clear();
        pivotOscilo.position.set(0, 0, 0);
        pivotOscilo.rotation.set(0, 0, 0);
        pivotBatant.position.set(0, 0, 0);
        pivotBatant.rotation.set(0, 0, 0);
        sashPoseAssemblies = [];
        handleHitMeshes = [];
        glassHitMeshes = [];
        glassNumberSprites.clear();
        explodableObjects = [];
        resetExplodeAnchors();
        const t_clear = performance.now();

        let A = parseFloat(document.getElementById('widthA').value);
        let B = parseFloat(document.getElementById('heightB').value);
        const fabricationGlassPieces = [];

        const frameGroup = new THREE.Group();
        const sashGroup = new THREE.Group();
        const dividerGroup = new THREE.Group();

        // Visibility toggles are presentation-only. Keep a separate profile set
        // for layout measurements so hiding a structural component (notably the
        // mullion group) cannot change cell/frame positions or overall sizing.
        const layoutProfiles = profilesData.filter(profile => isProfileEnabled(profile));
        const activeProfiles = layoutProfiles.filter(profile => {
            const toggle = document.getElementById(`toggle_${profile.index}`);
            const componentEnabled = toggle ? toggle.checked : true;
            return componentEnabled;
        });

        const isProfileVisibleOnHost = (profile, hostGroup) => {
            const toggle = document.getElementById(`toggle_${profile.index}`);
            const profileChecked = toggle ? toggle.checked : true;
            const sourceGroup = getProfileGroup(profile);
            return isComponentProfileVisibleOnHost({
                sourceGroup,
                hostGroup,
                sourceGroupVisible: isProfileGroupVisible(sourceGroup),
                hostGroupVisible: isProfileGroupVisible(hostGroup),
                profileChecked,
            });
        };

        // Connection CAD reuses some profile geometry on a different physical
        // host than the profile's original B2 assembly. Keep those occurrences
        // controlled by the host they are mounted on, not by the source group
        // that happened to provide the reusable SVG section.
        const frameHostProfiles = layoutProfiles.filter(profile =>
            isProfileVisibleOnHost(profile, 'frame')
        );
        const dividerHostProfiles = layoutProfiles.filter(profile =>
            isProfileVisibleOnHost(profile, 'divider')
        );

        // Fixed glazing beads keep their own dedicated bead visibility. 224063
        // is different: its fixed-light occurrence belongs to either the frame
        // or the mullion, so it follows that physical host.
        const fixedGlazingProfiles = layoutProfiles.filter(profile => {
            if (getProfileGroup(profile) === 'bead') {
                const toggle = document.getElementById(`toggle_${profile.index}`);
                return toggle ? toggle.checked : true;
            }
            if (!isFixedGlassAnchorGasket(profile)) return false;
            return isProfileVisibleOnHost(profile, 'frame')
                || isProfileVisibleOnHost(profile, 'divider');
        });

        const layoutDividerProfiles = layoutProfiles.filter(profile => profile.role === 'divider');
        const activeDividerProfiles = activeProfiles.filter(profile => profile.role === 'divider');
        const activeTransProfiles = activeProfiles.filter(profile => profile.role === 'trans');
        const activeTransGasketProfiles = activeProfiles.filter(
            profile => profile.role === 'trans-gasket'
        );
        const layoutState = getWindowLayoutState();
        const isEditableTopology = layoutState.isDynamicWindowState === true;

        // Keep the profile dimensions used by the layout editor separate:
        // - outer-frame visible face: 57 mm (CAD X span)
        // - mullion visible face: 88 mm
        // - outer-frame profile depth / machining span: 65 mm (CAD inward Y)
        // The grid reference is the mullion centreline, therefore an exposed
        // frame contributes 57 - 88/2 = 13 mm beyond a cell grid line.
        const editableFrameFaceSpan = isEditableTopology
            ? getFrameFaceSpanM(layoutProfiles)
            : 0;
        const editableFrameInwardSpan = isEditableTopology
            ? getFrameJointInwardSpanM(layoutProfiles)
            : 0;
        const editableDividerFaceSpan = isEditableTopology
            ? getDividerFaceSpanM(layoutDividerProfiles)
            : 0;
        editableTopologyGeometry = isEditableTopology
            ? getEditableWindowTopologyGeometry({
                width: A,
                height: B,
                topology: layoutState.topology,
                dividerConnectionVariants: currentMetadata.dividerConnectionVariants,
                transConnection: currentMetadata.transConnection,
                connectionScale: S,
                frameReplacementSpan: editableFrameInwardSpan,
                frameFaceSpan: editableFrameFaceSpan,
                frameInwardSpan: editableFrameInwardSpan,
                dividerFaceSpan: editableDividerFaceSpan,
            })
            : null;
        if (editableTopologyGeometry) {
            A = Number(editableTopologyGeometry.overallWidth) || A;
            B = Number(editableTopologyGeometry.overallHeight) || B;
        }
        const isTopFixedBottomSashSash = !isEditableTopology && (
            layoutState.layoutId === 'top-fixed-bottom-sash-sash'
            || layoutState.layoutKind === 't-grid'
        );
        const dividerOrientation = layoutDividerProfiles.length
            ? (
                isEditableTopology
                    ? (editableTopologyGeometry?.dividerSegments?.length ? 'grid' : null)
                    : layoutState.dividerOrientation
            )
            : null;
        const dividerBounds = getDividerSourceBounds(layoutDividerProfiles);
        const dividerFaceSpan = isEditableTopology
            ? editableDividerFaceSpan
            : Math.min(
                dividerOrientation === 'vertical'
                    ? A * 0.3
                    : (dividerOrientation === 'horizontal' ? B * 0.3 : Math.min(A, B) * 0.3),
                getDividerFaceSpanM(layoutDividerProfiles)
            );
        // Editable topology always uses the same frame/grid reference relation,
        // even when the last fixed mullion is replaced by a floating trans. If
        // this drops to zero after enabling trans, the top/bottom outer-frame
        // miters lose the CAD-derived reference extension and the whole outside
        // frame visibly shrinks.
        const frameJointInwardSpan = isEditableTopology
            ? (editableFrameInwardSpan || getFrameJointInwardSpanM(layoutProfiles))
            : (dividerOrientation ? getFrameJointInwardSpanM(layoutProfiles) : 0);
        const editableFramePlacements = isEditableTopology
            ? (editableTopologyGeometry?.framePlacements || []).map(placement =>
                getEditableReentrantFramePlacement({
                    placement,
                    perimeterJunctions: editableTopologyGeometry?.perimeterJunctions || [],
                    frameInwardSpan: frameJointInwardSpan,
                    dividerFaceSpan,
                })
            )
            : null;

        let sashA = A;
        let sashB = B;
        let sashOriginX = 0;
        let sashOriginY = 0;
        let openingCells = [{
            id: 'opening',
            width: A,
            height: B,
            centerX: 0,
            centerY: 0,
            joinCellSide: null,
        }];
        let openingCell = openingCells[0];
        let fixedCells = [];
        const layoutCellTypes = dividerOrientation
            ? (
                Array.isArray(layoutState.cells) && layoutState.cells.length >= 2
                    ? [...layoutState.cells]
                    : [
                        layoutState.leftCell || 'fixed-glazing',
                        layoutState.rightCell || 'opening-sash',
                    ]
            )
            : (
                Array.isArray(layoutState.cells) && layoutState.cells.length
                    ? [...layoutState.cells]
                    : [layoutState.rightCell || 'opening-sash']
            );
        const leftCellType = layoutCellTypes[0] || 'fixed-glazing';
        const rightCellType = layoutCellTypes.at(-1) || 'opening-sash';
        // Only the T-layout transom needs to remap the authored CAD join
        // left/right faces onto a reversed top/bottom cell order. The ordinary
        // horizontal-transom layout keeps its previously accepted/default
        // divider face orientation unchanged.
        const tTransomConnectionFaceDirection = isTopFixedBottomSashSash
            ? getHorizontalConnectionFaceDirection({
                lowerCellType: 'opening-sash',
                upperCellType: 'fixed-glazing',
                joinLeftCell: currentMetadata.dividerConnection?.leftCell,
                joinRightCell: currentMetadata.dividerConnection?.rightCell,
            })
            : 1;
        let dividerPositions = [];
        let dividerSeats = [];
        let tLayoutGeometry = null;

        if (isEditableTopology) {
            const editableCells = (editableTopologyGeometry?.cells || []).map((cell, index) => {
                const interior = getEditableCellInteriorPlacement(cell);
                return {
                    ...cell,
                    cellIndex: index,
                    // The structural cell remains one exact slider-sized bay.
                    // Its sash/fixed-light assembly follows the independent CAD
                    // connection rectangle so every mullion seat can be met even
                    // when a staircase puts opposite seat requirements in the
                    // same structural row/column.
                    interiorWidth: interior.width,
                    interiorHeight: interior.height,
                    interiorCenterX: interior.centerX,
                    interiorCenterY: interior.centerY,
                    fixedAccessoryWidth: interior.width,
                    fixedAccessoryHeight: interior.height,
                    fixedAccessoryCenterX: interior.centerX,
                    fixedAccessoryCenterY: interior.centerY,
                };
            });
            openingCells = editableCells
                .filter(cell => cell.cellType === 'opening-sash')
                .map(cell => ({
                    ...cell,
                    structuralWidth: cell.width,
                    structuralHeight: cell.height,
                    structuralCenterX: cell.centerX,
                    structuralCenterY: cell.centerY,
                    width: cell.interiorWidth,
                    height: cell.interiorHeight,
                    centerX: cell.interiorCenterX,
                    centerY: cell.interiorCenterY,
                }));
            fixedCells.push(...editableCells.filter(cell => cell.cellType === 'fixed-glazing'));
            openingCell = openingCells[0] || null;
        } else if (isTopFixedBottomSashSash && dividerOrientation) {
            const halfDividerFace = dividerFaceSpan / 2;
            const fixedBoundaryMm = currentMetadata.fixedGlazingConnections
                ?.dividerCellBoundariesMm || {};
            const horizontalOpeningBoundariesMm = currentMetadata.dividerConnection
                ?.openingSashDividerBoundariesMm || {};
            const verticalOpeningBoundariesMm = currentMetadata.tLayoutVerticalDividerConnection
                ?.openingSashDividerBoundariesMm || {};

            const finiteBoundaryM = (value, fallback) => {
                const numeric = Number(value);
                return Number.isFinite(numeric) ? numeric * S : fallback;
            };

            tLayoutGeometry = getTopFixedBottomSashSashLayout({
                width: A,
                height: B,
                topRowFraction: Number(layoutState.topRowFraction) || 0.30,
                horizontalFixedBoundary: finiteBoundaryM(
                    fixedBoundaryMm.left,
                    -halfDividerFace
                ),
                horizontalSashBoundary: finiteBoundaryM(
                    horizontalOpeningBoundariesMm.right,
                    halfDividerFace
                ),
                verticalLeftSashBoundary: finiteBoundaryM(
                    verticalOpeningBoundariesMm.left,
                    -halfDividerFace
                ),
                verticalRightSashBoundary: finiteBoundaryM(
                    verticalOpeningBoundariesMm.right,
                    halfDividerFace
                ),
            });
            openingCells = [...tLayoutGeometry.openingCells];
            fixedCells.push(...tLayoutGeometry.fixedCells);
            openingCell = openingCells[0] || null;
        } else if (dividerOrientation === 'vertical' || dividerOrientation === 'horizontal') {
            const axisLength = dividerOrientation === 'vertical' ? A : B;
            const halfDividerFace = dividerFaceSpan / 2;
            const fixedBoundaryMm = currentMetadata.fixedGlazingConnections
                ?.dividerCellBoundariesMm || {};

            const openingBoundaryMm = Number(
                currentMetadata.dividerConnection
                    ?.openingSashDividerBoundaryFromCenterMm
            );
            const openingBoundarySide = currentMetadata.dividerConnection
                ?.openingSashCellSide || null;
            const openingBoundariesMm = currentMetadata.dividerConnection
                ?.openingSashDividerBoundariesMm || {};
            const minCellSpan = 0.05;

            const resolveLocalBoundary = (joinCellSide, cellType) => {
                const defaultBoundary = joinCellSide === 'left'
                    ? -halfDividerFace
                    : halfDividerFace;

                if (cellType === 'fixed-glazing') {
                    const cadBoundaryMm = Number(fixedBoundaryMm[joinCellSide]);
                    if (Number.isFinite(cadBoundaryMm)) {
                        return cadBoundaryMm * S;
                    }
                }
                if (cellType === 'opening-sash') {
                    const perSideBoundaryMm = Number(openingBoundariesMm[joinCellSide]);
                    if (Number.isFinite(perSideBoundaryMm)) {
                        return perSideBoundaryMm * S;
                    }
                    if (
                        openingBoundarySide === joinCellSide
                        && Number.isFinite(openingBoundaryMm)
                    ) {
                        return openingBoundaryMm * S;
                    }
                }
                return defaultBoundary;
            };

            dividerSeats = [];
            for (let index = 0; index < layoutCellTypes.length - 1; index += 1) {
                dividerSeats.push({
                    left: resolveLocalBoundary('left', layoutCellTypes[index]),
                    right: resolveLocalBoundary('right', layoutCellTypes[index + 1]),
                });
            }

            const linearLayout = getLinearDividerLayout({
                axisLength,
                cellTypes: layoutCellTypes,
                dividerSeats,
                minCellSpan,
            });
            dividerPositions = [...linearLayout.dividerPositions];

            const axisCells = linearLayout.cells.map(cellLayout => {
                const { index, cellType, span, center } = cellLayout;
                const dividerJoinSideByBoundary = dividerOrientation === 'vertical'
                    ? {
                        ...(index > 0 ? { left: 'right' } : {}),
                        ...(index < layoutCellTypes.length - 1 ? { right: 'left' } : {}),
                    }
                    : {
                        ...(index > 0 ? { bottom: 'right' } : {}),
                        ...(index < layoutCellTypes.length - 1 ? { top: 'left' } : {}),
                    };
                const connectionSpan = Number.isFinite(cellLayout.connectionSpan)
                    ? cellLayout.connectionSpan
                    : span;
                const connectionCenter = Number.isFinite(cellLayout.connectionCenter)
                    ? cellLayout.connectionCenter
                    : center;
                const cell = {
                    id: `${cellType === 'opening-sash' ? 'opening' : 'fixed'}-${index}`,
                    cellIndex: index,
                    cellType,
                    width: dividerOrientation === 'vertical' ? span : A,
                    height: dividerOrientation === 'horizontal' ? span : B,
                    centerX: dividerOrientation === 'vertical' ? center : 0,
                    centerY: dividerOrientation === 'horizontal' ? center : 0,
                    fixedAccessoryWidth: dividerOrientation === 'vertical' ? connectionSpan : A,
                    fixedAccessoryHeight: dividerOrientation === 'horizontal' ? connectionSpan : B,
                    fixedAccessoryCenterX: dividerOrientation === 'vertical' ? connectionCenter : 0,
                    fixedAccessoryCenterY: dividerOrientation === 'horizontal' ? connectionCenter : 0,
                    dividerBoundaryX: dividerOrientation === 'vertical'
                        ? (index < dividerPositions.length
                            ? dividerPositions[index] + dividerSeats[index].left
                            : null)
                        : null,
                    dividerBoundaryY: dividerOrientation === 'horizontal'
                        ? (index < dividerPositions.length
                            ? dividerPositions[index] + dividerSeats[index].left
                            : null)
                        : null,
                    dividerJoinSideByBoundary: Object.freeze(dividerJoinSideByBoundary),
                    joinCellSide: layoutCellTypes.length === 2
                        ? (index === 0 ? 'left' : 'right')
                        : null,
                };
                return cell;
            });

            console.log("3-WINDOW DEBUG: " + JSON.stringify({
                layoutId: layoutState.layoutId,
                cells: layoutCellTypes,
                fixedBoundaryMm,
                dividerSeats,
                dividerPositions,
                axisCells: axisCells.map(c => ({
                    index: c.cellIndex,
                    cellType: c.cellType,
                    width: c.width,
                    centerX: c.centerX,
                    fixedAccessoryWidth: c.fixedAccessoryWidth,
                    fixedAccessoryCenterX: c.fixedAccessoryCenterX
                }))
            }));

            openingCells = axisCells.filter(cell => cell.cellType === 'opening-sash');
            fixedCells.push(...axisCells.filter(cell => cell.cellType === 'fixed-glazing'));
            openingCell = openingCells[0] || null;
        } else {
            // Single window (no divider). Keep the render-cell id identical to
            // the logical window-state id so glass clicks work even before the
            // first topology edit turns the layout into a dynamic state.
            const logicalSingleCell = layoutState.windowState?.windows?.[0] || null;
            const singleCellId = logicalSingleCell?.id || 'w1';
            const cellType = layoutCellTypes[0] || 'opening-sash';
            if (cellType === 'opening-sash') {
                openingCells = [{
                    id: singleCellId,
                    cellIndex: 0,
                    cellType: 'opening-sash',
                    width: A,
                    height: B,
                    centerX: 0,
                    centerY: 0,
                    handleSide: logicalSingleCell?.handleSide || layoutState.cellHandleSides?.[0] || null,
                }];
                fixedCells = [];
                openingCell = openingCells[0];
            } else {
                openingCells = [];
                fixedCells = [{
                    id: singleCellId,
                    cellIndex: 0,
                    cellType: 'fixed-glazing',
                    width: A,
                    height: B,
                    centerX: 0,
                    centerY: 0,
                }];
                openingCell = null;
            }
        }

        [...openingCells, ...fixedCells].forEach(setExplodeCellAnchor);
        buildExplodeDividerChainAnchors();
        buildExplodeTransAnchors();

        if (openingCell) {
            sashA = openingCell.width;
            sashB = openingCell.height;
            sashOriginX = openingCell.centerX;
            sashOriginY = openingCell.centerY;
        }

        // Colour-filter controls only need synchronization after explicit
        // component/filter changes, not during every glass slider frame.

        const t_samples_start = performance.now();
        rebuildSectionSamplesIfNeeded(activeProfiles);
        const t_samples_end = performance.now();

        const showTop = document.getElementById('side_top')?.checked !== false;
        const showBottom = document.getElementById('side_bottom')?.checked !== false;
        const showLeft = document.getElementById('side_left')?.checked !== false;
        const showRight = document.getElementById('side_right')?.checked !== false;

        const sides = [];
        if (showBottom) sides.push('bottom');
        if (showTop) sides.push('top');
        if (showLeft) sides.push('left');
        if (showRight) sides.push('right');

        // Miter-extrude structural and accessory profiles. The verified vertical
        // connection keeps fixed glazing on the left and the opening sash on the right.
        let sashMinX = Infinity, sashMaxX = -Infinity;
        profilesData.forEach(profile => {
            if (profile.role === 'sash' && String(profile.layer || '').toLowerCase().includes('al')) {
                const bbox = getEffectiveProfileBbox(profile);
                if (!bbox) return;
                if (bbox.minX < sashMinX) sashMinX = bbox.minX;
                if (bbox.maxX > sashMaxX) sashMaxX = bbox.maxX;
            }
        });
        if (sashMinX === Infinity) {
            sashMinX = currentMetadata.globalMinX;
            sashMaxX = currentMetadata.globalMaxX;
        }
        const sashCenterX = ((sashMinX + sashMaxX) / 2 - currentMetadata.globalCenterX) * S;
        const dividerDepthOffset = dividerOrientation && currentMetadata.dividerConnection
            ? (Number(currentMetadata.dividerConnection.depthCenterFromAssemblyCenterMm) || 0) * S
            : 0;

        const t_meshes_start = performance.now();
        function shouldPlaceProfileOnSide(profile, side) {
            if (!canPlaceProfileOnSide(profile, side)) return false;

            if (currentMetadata.isVertical && currentMetadata.hasSplit) {
                const placementSection = profile.placementSection || profile.section;
                if (placementSection === 'bottom') {
                    return side === 'bottom';
                }
                if (placementSection === 'top') {
                    return side === 'top' || side === 'left' || side === 'right';
                }
            }

            return true;
        }

        const sashGroupsByCell = new Map();
        openingCells.forEach((cell, index) => {
            sashGroupsByCell.set(
                cell.id,
                index === 0 ? sashGroup : new THREE.Group()
            );
        });

        function getFrameBoundaryCellType(side, placement) {
            if (placement?.cellType) return placement.cellType;
            if (isTopFixedBottomSashSash) {
                if (side === 'top') return 'fixed-glazing';
                if (side === 'bottom') return 'opening-sash';
            }
            if (dividerOrientation === 'vertical') {
                if (side === 'left') return layoutCellTypes[0] || leftCellType;
                if (side === 'right') return layoutCellTypes.at(-1) || rightCellType;
            }
            if (dividerOrientation === 'horizontal') {
                if (side === 'bottom') return layoutCellTypes[0] || leftCellType;
                if (side === 'top') return layoutCellTypes.at(-1) || rightCellType;
            }
            return openingCell ? 'opening-sash' : 'fixed-glazing';
        }

        function getOuterFramePlacements(side) {
            if (isEditableTopology) {
                return (editableFramePlacements || [])
                    .filter(placement => placement.side === side);
            }
            if (!isTopFixedBottomSashSash || !tLayoutGeometry) {
                return dividerOrientation
                    ? getFrameSidePlacements({
                        orientation: dividerOrientation,
                        width: A,
                        height: B,
                        side,
                        dividerPositions,
                        cellTypes: layoutCellTypes,
                    })
                    : [{
                        id: side,
                        width: A,
                        height: B,
                        originX: 0,
                        originY: 0,
                        windowCell: 'outer-boundary',
                    }];
            }

            if (side === 'left' || side === 'right') {
                return getFrameSidePlacements({
                    orientation: 'horizontal',
                    width: A,
                    height: B,
                    side,
                    dividerPositions: [tLayoutGeometry.transomCenterY],
                    cellTypes: ['opening-sash', 'fixed-glazing'],
                });
            }
            if (side === 'bottom') {
                return getFrameSidePlacements({
                    orientation: 'vertical',
                    width: A,
                    height: B,
                    side,
                    dividerPositions: [tLayoutGeometry.verticalMullionCenterX],
                    cellTypes: ['opening-sash', 'opening-sash'],
                });
            }
            return [{
                id: side,
                width: A,
                height: B,
                originX: 0,
                originY: 0,
                windowCell: 'outer-boundary',
            }];
        }

        activeProfiles
            .filter(profile =>
                profile.role !== 'divider'
                && profile.role !== 'trans'
                && profile.role !== 'trans-gasket'
            )
            .forEach(profile => {
                const group = getProfileGroup(profile);
                const usesFullOuterBoundary = group === 'frame';
                if (!usesFullOuterBoundary && !openingCells.length) return;

                // A join-authored outer-frame accessory is rendered below from
                // its exact frame-sash CAD transform. Do not also render the
                // legacy B2-aligned copy around the whole perimeter.
                if (usesFullOuterBoundary && profile.frameAccessoryCadTransform) {
                    return;
                }

                sides.forEach(side => {
                    if (!shouldPlaceProfileOnSide(profile, side)) return;

                    const placements = usesFullOuterBoundary
                        ? getOuterFramePlacements(side)
                        : openingCells.map(cell => ({
                            id: `${side}-${cell.id}`,
                            width: cell.width,
                            height: cell.height,
                            originX: cell.centerX,
                            originY: cell.centerY,
                            windowCell: cell.id,
                        }));

                    placements.forEach(placement => {
                        // 245472 is the frame-to-sash rebate gasket. A frame
                        // segment bordering fixed glass uses 224063 from the
                        // frame-window join instead, so do not carry 245472
                        // across the fixed half of a divided window.
                        if (
                            usesFullOuterBoundary
                            && isFrameToSashRebateGasket(profile)
                            && getFrameBoundaryCellType(side, placement) !== 'opening-sash'
                        ) {
                            return;
                        }

                        // 224068 and 200988 are sash-connection accessories,
                        // even when their reusable source profile has role=frame.
                        // Filter each physical frame segment by the cell that is
                        // actually beside it so fixed and merged-fixed windows
                        // can never inherit them from another sash in the layout.
                        if (
                            usesFullOuterBoundary
                            && accessoryRequiresOpeningSashConnection(profile)
                            && getFrameBoundaryCellType(side, placement) !== 'opening-sash'
                        ) {
                            return;
                        }

                        const mesh = createMiteredSide(
                            profile,
                            placement.width,
                            placement.height,
                            side,
                            profile.explodeOffset,
                            placement.originX,
                            placement.originY,
                            (placement.localJointEnds?.length && group === 'frame')
                                ? {
                                    localJointEnd: placement.localJointEnd,
                                    localJointEnds: placement.localJointEnds,
                                    faceSpan: dividerFaceSpan,
                                    frameInwardSpan: frameJointInwardSpan,
                                    endModes: placement.frameJointModes,
                                    centerShifts: placement.frameJointCenterShifts,
                                    reentrantFrameBoundaryOffset: placement.reentrantFrameBoundaryOffset,
                                }
                                : null
                        );
                        mesh.userData.windowCell = placement.windowCell;
                        mesh.userData.frameSegment = placement.id;
                        mesh.userData.frameJoint = placement.jointEnd || null;
                        mesh.userData.frameJointLocalEnd = placement.localJointEnd || null;
                        mesh.userData.frameJointLocalEnds = placement.localJointEnds || [];

                        if (group === 'frame') {
                            frameGroup.add(mesh);
                        } else {
                            const targetSashGroup = sashGroupsByCell.get(placement.windowCell);
                            targetSashGroup?.add(mesh);
                        }
                    });
                });
            });

        // A normal perimeter T keeps the outer frame visually continuous.
        // `halfFrameFillers` now describe the inner 25 mm host band for
        // intersection ownership/BOM purposes only; they are not separate
        // triangular front-view meshes.
        if (isEditableTopology) {
            (editableTopologyGeometry?.halfFrameFillers || []).forEach(filler => {
                if (filler?.renderAsSeparateMesh === false) return;
                const sourcePlacement = (editableFramePlacements || []).find(
                    placement => placement.id === filler.sourceFrameId
                );
                if (!sourcePlacement) return;

                const span = Math.max(0, Number(filler.frameReferenceSpan) || 0);
                if (span <= 1e-9) return;

                activeProfiles
                    .filter(profile => (
                        getProfileGroup(profile) === 'frame'
                        && !profile.frameAccessoryCadTransform
                    ))
                    .forEach(profile => {
                        if (!shouldPlaceProfileOnSide(profile, filler.side)) return;

                        const stockLength = span * 2;
                        const stockWidth = filler.orientation === 'horizontal'
                            ? stockLength
                            : sourcePlacement.width;
                        const stockHeight = filler.orientation === 'vertical'
                            ? stockLength
                            : sourcePlacement.height;
                        const originX = filler.orientation === 'horizontal'
                            ? filler.apexX
                            : sourcePlacement.originX;
                        const originY = filler.orientation === 'vertical'
                            ? filler.apexY
                            : sourcePlacement.originY;
                        const mesh = createMiteredSide(
                            profile,
                            stockWidth,
                            stockHeight,
                            filler.side,
                            profile.explodeOffset,
                            originX,
                            originY,
                            {
                                localJointEnds: ['negative', 'positive'],
                                faceSpan: dividerFaceSpan,
                                frameInwardSpan: frameJointInwardSpan,
                                endModes: {
                                    negative: 'square',
                                    positive: 'square',
                                },
                            }
                        );
                        if (!clipFrameMeshToHalfFrameTriangle(mesh, filler)) {
                            mesh.geometry?.dispose();
                            return;
                        }
                        mesh.userData.halfFrame = true;
                        mesh.userData.halfFrameId = filler.id;
                        mesh.userData.halfFrameSourceFrameId = filler.sourceFrameId;
                        mesh.userData.frameSegment = filler.id;
                        frameGroup.add(mesh);
                    });
            });
        }

        // Trans is a floating sash-to-sash profile. It occupies the shared grid
        // edge but is not a structural divider, so it is parented directly to
        // one sash group and automatically follows that sash's opening pivot.
        if (isEditableTopology && activeTransProfiles.length) {
            const transBounds = getTransSourceBounds(activeTransProfiles);
            const transConnection = currentMetadata.transConnection || {};
            const transDepthOffset = (Number(transConnection.depthCenterFromAssemblyCenterMm) || 0) * S;
            (editableTopologyGeometry?.transSegments || []).forEach(segment => {
                const ownerCell = openingCells.find(cell => cell.id === segment.ownerCellId)
                    || openingCells.find(cell => cell.id === segment.positiveCellId)
                    || null;
                const targetSashGroup = ownerCell ? sashGroupsByCell.get(ownerCell.id) : null;
                if (!ownerCell || !targetSashGroup || !transBounds) return;

                activeTransProfiles.forEach(profile => {
                    const placedProfile = {
                        ...profile,
                        dividerSectionRotationDeg:
                            Number(transConnection.sectionRotationDeg)
                            || Number(profile.transSectionRotationDeg)
                            || 180,
                    };
                    const mesh = createDividerSegment(
                        placedProfile,
                        // temporary fix to make the trans mullion smaller
                        ownerCell.height - 0.06,
                        'vertical',
                        transBounds,
                        transDepthOffset,
                        0,
                        segment.perpendicularOffset,
                        ownerCell.centerY,
                        1,
                        {
                            negativeEndMode: 'square',
                            positiveEndMode: 'square',
                            negativeFrameInwardSpan: 0,
                            positiveFrameInwardSpan: 0,
                        }
                    );
                    mesh.userData.trans = true;
                    if (mesh.userData.componentSelection) {
                        mesh.userData.componentSelection.source = 'trans';
                    }
                    mesh.userData.transSegmentId = segment.id;
                    mesh.userData.transOwnerCellId = ownerCell.id;
                    mesh.userData.windowCell = ownerCell.id;
                    targetSashGroup.add(mesh);
                });

                // The floating trans carries its own 245472 rebate gasket from
                // the exact sash-trans-sash CAD join. Render it with the same
                // length, square ends, depth bridge and sash parent as the
                // aluminium trans so opening the owner sash moves both pieces
                // as one physical assembly.
                activeTransGasketProfiles.forEach(profile => {
                    if (!profile.transConnectionCadTransform) return;
                    const placedProfile = {
                        ...profile,
                        cadCoordinateTransform: profile.transConnectionCadTransform,
                        cadAlignmentShiftXMm: 0,
                        cadAlignmentShiftYMm: 0,
                        dividerSectionRotationDeg:
                            Number(transConnection.sectionRotationDeg)
                            || Number(profile.transSectionRotationDeg)
                            || 180,
                    };
                    const mesh = createDividerSegment(
                        placedProfile,
                        // temporary fix to make the trans gasket smaller (matching the trans mullion)
                        ownerCell.height - 0.11,
                        'vertical',
                        transBounds,
                        transDepthOffset,
                        0,
                        segment.perpendicularOffset,
                        ownerCell.centerY,
                        1,
                        {
                            negativeEndMode: 'square',
                            positiveEndMode: 'square',
                            negativeFrameInwardSpan: 0,
                            positiveFrameInwardSpan: 0,
                        }
                    );
                    mesh.userData.trans = true;
                    mesh.userData.transGasket = true;
                    mesh.userData.connectionProfileId =
                        profile.transConnectionProfileId || null;
                    mesh.userData.transSegmentId = segment.id;
                    mesh.userData.transOwnerCellId = ownerCell.id;
                    mesh.userData.windowCell = ownerCell.id;
                    if (mesh.userData.componentSelection) {
                        mesh.userData.componentSelection.source = 'trans';
                    }
                    targetSashGroup.add(mesh);
                });
            });
        }

        // Exact accessory INSERTs from frame-sash-window.dwg are components of
        // the outer frame. They use the same perimeter segmentation and the
        // same divider-end miter cuts as the aluminium frame, while their
        // cross-sectional seat comes only from CAD. On divided layouts the
        // accessory is emitted only on frame segments bordering an opening sash.
        frameHostProfiles
            .filter(profile => Boolean(profile.frameAccessoryCadTransform))
            .forEach(profile => {
                sides.forEach(side => {
                    if (!shouldPlaceProfileOnSide(profile, side)) return;

                    // Supplemental connection accessories can carry separate
                    // top and bottom source sections. The top source is the
                    // reusable section for top/left/right, while the bottom
                    // source contains the CAD/source orientation required by
                    // the bottom frame. Previously the bottom source was
                    // filtered out entirely, so the exact frame-sash 200988
                    // path could never emit a bottom-frame component.
                    const placementSection = profile.placementSection || profile.section;
                    if (placementSection === 'bottom' && side !== 'bottom') return;
                    if (placementSection === 'top' && side === 'bottom') return;

                    const placedProfile = {
                        ...profile,
                        cadCoordinateTransform: profile.frameAccessoryCadTransform,
                        cadAlignmentShiftXMm: 0,
                        cadAlignmentShiftYMm: 0,
                    };
                    getOuterFramePlacements(side).forEach(placement => {
                        if (getFrameBoundaryCellType(side, placement) !== 'opening-sash') {
                            return;
                        }

                        const mesh = createMiteredSide(
                            placedProfile,
                            placement.width,
                            placement.height,
                            side,
                            profile.explodeOffset,
                            placement.originX,
                            placement.originY,
                            placement.jointEnd === 'divider'
                                ? {
                                    localJointEnd: placement.localJointEnd,
                                    localJointEnds: placement.localJointEnds,
                                    faceSpan: dividerFaceSpan,
                                    frameInwardSpan: frameJointInwardSpan,
                                    endModes: placement.frameJointModes,
                                    centerShifts: placement.frameJointCenterShifts,
                                    reentrantFrameBoundaryOffset: placement.reentrantFrameBoundaryOffset,
                                }
                                : null
                        );
                        mesh.userData.windowCell = placement.windowCell;
                        mesh.userData.frameSegment = placement.id;
                        mesh.userData.frameAccessory = true;
                        mesh.userData.connectionBoundary = 'frame-opening-sash';
                        mesh.userData.connectionProfileId = profile.frameAccessoryProfileId;
                        mesh.userData.accessoryHostProfileId = profile.frameAccessoryHostProfileId;
                        frameGroup.add(mesh);
                    });
                });
            });

        function getEditableDividerVariantKey(segment) {
            return getDividerConnectionVariantKey({
                orientation: segment.orientation,
                templateId: segment.templateId,
                reversed: segment.reversed,
            });
        }

        function getEditableDividerVariantMetadata(segment) {
            return currentMetadata.dividerConnectionVariants?.[
                getEditableDividerVariantKey(segment)
            ] || null;
        }

        function getEditableProfileVariant(profile, segment) {
            const variant = profile.dividerConnectionVariants?.[
                getEditableDividerVariantKey(segment)
            ];
            return variant ? { ...profile, ...variant } : profile;
        }


        if (isEditableTopology && dividerBounds) {
            const editableSegments = editableTopologyGeometry?.dividerSegments || [];
            const placeEditableDividerMesh = (mesh, segment, kind) => {
                mesh.userData.dynamicDivider = true;
                mesh.userData.dynamicDividerKind = kind;
                mesh.userData.dividerSegmentId = segment.id;
                mesh.userData.dividerConnectionTemplateId = segment.templateId;
                mesh.userData.dividerConnectionReversed = Boolean(segment.reversed);
                dividerGroup.add(mesh);
            };

            const getRuntimeCellSideForDividerBranchDirection = (orientation, direction) => {
                if (orientation === 'vertical') {
                    if (direction === 'west') return 'left';
                    if (direction === 'east') return 'right';
                } else if (orientation === 'horizontal') {
                    if (direction === 'south') return 'left';
                    if (direction === 'north') return 'right';
                }
                return null;
            };


            const getDividerSegmentWorldRange = segment => {
                const rawStart = Number.isFinite(Number(segment?.structuralWorldStart))
                    ? Number(segment.structuralWorldStart)
                    : Number(segment?.worldStart);
                const rawEnd = Number.isFinite(Number(segment?.structuralWorldEnd))
                    ? Number(segment.structuralWorldEnd)
                    : Number(segment?.worldEnd);
                if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) {
                    return null;
                }
                return Object.freeze({
                    start: Math.min(rawStart, rawEnd),
                    end: Math.max(rawStart, rawEnd),
                });
            };

            const getHostGasketBranchSplitCoordinates = (
                segment,
                runtimeCellSide,
                explicitRange = null
            ) => {
                if (!segment || !runtimeCellSide) return [];
                const range = explicitRange || getDividerSegmentWorldRange(segment);
                if (!range) return [];
                const rawCoordinates = (editableTopologyGeometry?.physicalIntersections || [])
                    .flatMap(junction => {
                        if (!junction || junction.hostOrientation !== segment.orientation) {
                            return [];
                        }
                        if (junction.type !== 'T' && junction.type !== 'cross') {
                            return [];
                        }
                        const activeDirections = Array.isArray(junction.activeDirections)
                            ? junction.activeDirections
                            : [];
                        const hostArms = activeDirections
                            .map(direction => junction.arms?.[direction])
                            .filter(arm => (
                                arm?.kind === 'divider'
                                && arm.orientation === segment.orientation
                                && arm.segmentId === segment.id
                            ));
                        if (!hostArms.length) return [];
                        return activeDirections
                            .map(direction => junction.arms?.[direction])
                            .filter(arm => (
                                arm?.kind === 'divider'
                                && arm.orientation !== segment.orientation
                                && getRuntimeCellSideForDividerBranchDirection(
                                    segment.orientation,
                                    arm.direction
                                ) === runtimeCellSide
                            ))
                            .map(() => (
                                segment.orientation === 'vertical'
                                    ? Number(junction.y)
                                    : Number(junction.x)
                            ));
                    })
                    .filter(value => (
                        Number.isFinite(value)
                        && value > range.start + 1e-9
                        && value < range.end - 1e-9
                    ))
                    .sort((a, b) => a - b);
                return rawCoordinates.filter((value, index) => (
                    index === 0 || Math.abs(value - rawCoordinates[index - 1]) > 1e-9
                ));
            };

            const getDividerGasketMiterSign = (segmentOrientation, runtimeCellSide) => {
                if (segmentOrientation === 'horizontal') {
                    return runtimeCellSide === 'left' ? 1 : -1;
                }
                return runtimeCellSide === 'left' ? -1 : 1;
            };

            const applyDividerGasketMiterSide = (
                joint,
                runtimeCellSide,
                segmentOrientation = 'vertical'
            ) => {
                const localGasketMiterSign = getDividerGasketMiterSign(
                    segmentOrientation,
                    runtimeCellSide
                );
                const resolvedJoint = { ...(joint || {}) };
                if (
                    resolvedJoint.negativeRectangularEndNotch
                    || resolvedJoint.negativeLocalGasketMiter
                ) {
                    resolvedJoint.negativeLocalGasketMiterSign = localGasketMiterSign;
                }
                if (
                    resolvedJoint.positiveRectangularEndNotch
                    || resolvedJoint.positiveLocalGasketMiter
                ) {
                    resolvedJoint.positiveLocalGasketMiterSign = localGasketMiterSign;
                }
                return resolvedJoint;
            };

            const getDividerHostEndpointBranchSides = (segment, atStart) => {
                const junction = (editableTopologyGeometry?.physicalIntersections || [])
                    .find(candidate => candidate?.endpoints?.some(endpoint => (
                        endpoint?.dividerId === segment?.id
                        && Boolean(endpoint?.atStart) === Boolean(atStart)
                    ))) || null;
                if (
                    !junction
                    || (junction.type !== 'T' && junction.type !== 'cross')
                    || junction.hostOrientation !== segment?.orientation
                ) {
                    return new Set();
                }

                const sides = new Set();
                (junction.activeDirections || [])
                    .map(direction => junction.arms?.[direction])
                    .filter(arm => (
                        arm?.kind === 'divider'
                        && arm.orientation !== segment.orientation
                    ))
                    .forEach(arm => {
                        const side = getRuntimeCellSideForDividerBranchDirection(
                            segment.orientation,
                            arm.direction
                        );
                        if (side) sides.add(side);
                    });
                return sides;
            };

            const applyHostEndpointGasketContinuity = (
                segment,
                joint,
                runtimeCellSide
            ) => {
                const resolvedJoint = { ...(joint || {}) };
                const applyEndRule = (atStart, endPrefix) => {
                    const branchSides = getDividerHostEndpointBranchSides(segment, atStart);
                    if (!branchSides.size) return;
                    const isBranchFacingSide = branchSides.has(runtimeCellSide);
                    if (isBranchFacingSide) {
                        // This is the actual half-mullion under the incoming
                        // branch. Keep the normal 15 mm end clearance, so the
                        // two host segments leave the intended no-gasket zone.
                        return;
                    }

                    // The opposite half of the host mullion is physically
                    // continuous through the T. Do not apply the generic
                    // 15 mm-per-end shortening at this internal endpoint or the
                    // two host segments create the visible 30 mm gasket hole.
                    resolvedJoint[`${endPrefix}GasketTrimOverride`] = 0;
                    resolvedJoint[`${endPrefix}LocalGasketMiter`] = false;
                    delete resolvedJoint[`${endPrefix}LocalGasketMiterSign`];
                };

                applyEndRule(true, 'negative');
                applyEndRule(false, 'positive');
                return resolvedJoint;
            };

            const getSplitHostGasketPlacements = (segment, basePlacement, runtimeCellSide) => {
                const localGasketMiterSign = getDividerGasketMiterSign(
                    segment?.orientation,
                    runtimeCellSide
                );
                const baseLength = Math.max(0, Number(basePlacement?.length) || 0);
                const baseCenter = Number(basePlacement?.longitudinalOffset) || 0;
                if (baseLength <= 1e-9) {
                    return [{
                        ...basePlacement,
                        joint: applyHostEndpointGasketContinuity(
                            segment,
                            applyDividerGasketMiterSide(
                                basePlacement?.joint,
                                runtimeCellSide,
                                segment?.orientation
                            ),
                            runtimeCellSide
                        ),
                    }];
                }
                // Split the ACTUAL rendered placement, not the raw structural
                // segment range. The rendered mullion may include the frame-grid
                // extension at its outer ends; dropping that extension was the
                // other reason the gasket became visibly too short.
                const range = {
                    start: baseCenter - baseLength / 2,
                    end: baseCenter + baseLength / 2,
                };
                const splitCoordinates = getHostGasketBranchSplitCoordinates(
                    segment,
                    runtimeCellSide,
                    range
                );
                if (!splitCoordinates.length) {
                    return [{
                        ...basePlacement,
                        joint: applyHostEndpointGasketContinuity(
                            segment,
                            applyDividerGasketMiterSide(
                                basePlacement?.joint,
                                runtimeCellSide,
                                segment?.orientation
                            ),
                            runtimeCellSide
                        ),
                    }];
                }
                const points = [range.start, ...splitCoordinates, range.end];
                const placements = [];
                for (let index = 0; index < points.length - 1; index += 1) {
                    const start = points[index];
                    const end = points[index + 1];
                    const length = Math.max(0, end - start);
                    if (length <= 1e-6) continue;
                    const joint = {
                        ...(basePlacement?.joint || {}),
                    };
                    if (index > 0) {
                        joint.negativeEndMode = 'square';
                        joint.negativeFrameInwardSpan = 0;
                        joint.negativeArrowFaceBias = 0;
                        joint.negativeLocalGasketMiter = true;
                        joint.negativeLocalGasketMiterSign = localGasketMiterSign;
                        delete joint.negativeRectangularEndNotch;
                    }
                    if (index < points.length - 2) {
                        joint.positiveEndMode = 'square';
                        joint.positiveFrameInwardSpan = 0;
                        joint.positiveArrowFaceBias = 0;
                        joint.positiveLocalGasketMiter = true;
                        // Both longitudinal ends of one gasket use the same
                        // local face edge, but the gasket on the opposite side of
                        // the mullion must mirror that edge. runtimeCellSide is
                        // already normalized for reversed connection templates.
                        joint.positiveLocalGasketMiterSign = localGasketMiterSign;
                        delete joint.positiveRectangularEndNotch;
                    }
                    placements.push({
                        length,
                        longitudinalOffset: (start + end) / 2,
                        joint: applyHostEndpointGasketContinuity(
                            segment,
                            applyDividerGasketMiterSide(
                                joint,
                                runtimeCellSide,
                                segment?.orientation
                            ),
                            runtimeCellSide
                        ),
                    });
                }
                return placements.length
                    ? placements
                    : [{
                        ...basePlacement,
                        joint: applyHostEndpointGasketContinuity(
                            segment,
                            applyDividerGasketMiterSide(
                                basePlacement?.joint,
                                runtimeCellSide,
                                segment?.orientation
                            ),
                            runtimeCellSide
                        ),
                    }];
            };

            editableSegments.forEach(segment => {
                const variantMetadata = getEditableDividerVariantMetadata(segment);
                const connectionMetadata = variantMetadata?.dividerConnection || {};
                const depthOffset = (
                    Number(connectionMetadata.depthCenterFromAssemblyCenterMm) || 0
                ) * S;
                const authoredFaceDirection = segment.orientation === 'horizontal' ? -1 : 1;
                // The mixed CAD connection is authored fixed-left / sash-right.
                // A dynamic sash-left / fixed-right adjacency is the same
                // physical join mirrored through the mullion centreline, so
                // divider-mounted INSERTs (224063, 245472, accessories) must be
                // mirrored together with the structural section.
                const faceDirection = segment.reversed
                    ? -authoredFaceDirection
                    : authoredFaceDirection;
                const segmentPlacement = getEditableDividerSegmentPlacement({
                    segment,
                    junctions: editableTopologyGeometry?.physicalIntersections
                        || editableTopologyGeometry?.junctions
                        || [],
                    dividerFaceSpan,
                    frameJointInwardSpan,
                });
                const segmentDividerProfiles = activeDividerProfiles.map(profile =>
                    getEditableProfileVariant(profile, segment)
                );
                const segmentDividerBounds = getDividerSourceBounds(segmentDividerProfiles)
                    || dividerBounds;

                segmentDividerProfiles.forEach(variantProfile => {
                    const placedProfile = {
                        ...variantProfile,
                        dividerSectionRotationDeg:
                            Number(connectionMetadata.sectionRotationDeg)
                            || Number(variantProfile.dividerSectionRotationDeg)
                            || 180,
                    };
                    if (segmentPlacement.length <= 1e-6) return;
                    placeEditableDividerMesh(
                        createDividerSegment(
                            placedProfile,
                            segmentPlacement.length,
                            segment.orientation,
                            segmentDividerBounds,
                            depthOffset,
                            frameJointInwardSpan,
                            segment.perpendicularOffset,
                            segmentPlacement.longitudinalOffset,
                            faceDirection,
                            segmentPlacement.joint
                        ),
                        segment,
                        'structural'
                    );
                });

                dividerHostProfiles
                    .forEach(profile => {
                        if (isFixedGlassAnchorGasket(profile) && !isProfileVisibleOnHost(profile, 'divider')) {
                            return;
                        }
                        const variantProfile = getEditableProfileVariant(profile, segment);
                        const connectionTransforms = Object.entries(
                            variantProfile.mullionConnectionCadTransforms || {}
                        );
                        if (
                            !connectionTransforms.length
                            && variantProfile.mullionConnectionCadTransform
                        ) {
                            connectionTransforms.push([
                                variantProfile.mullionConnectionCellSide || 'unknown',
                                variantProfile.mullionConnectionCadTransform,
                            ]);
                        }

                        const renderedConnectionSides = new Set();
                        connectionTransforms.forEach(([cellSide, cadTransform]) => {
                            if (!cadTransform) return;
                            const runtimeCellSide = segment.reversed
                                ? (cellSide === 'left' ? 'right' : (cellSide === 'right' ? 'left' : cellSide))
                                : cellSide;
                            const placedProfile = {
                                ...variantProfile,
                                cadCoordinateTransform: cadTransform,
                                cadAlignmentShiftXMm: 0,
                                cadAlignmentShiftYMm: 0,
                                dividerSectionRotationDeg:
                                    Number(connectionMetadata.sectionRotationDeg)
                                    || Number(variantProfile.dividerSectionRotationDeg)
                                    || 180,
                            };
                            const splitPlacements = getSplitHostGasketPlacements(
                                segment,
                                segmentPlacement,
                                runtimeCellSide
                            );
                            splitPlacements.forEach(placement => {
                                const mesh = createDividerSegment(
                                    placedProfile,
                                    placement.length,
                                    segment.orientation,
                                    segmentDividerBounds,
                                    depthOffset,
                                    frameJointInwardSpan,
                                    segment.perpendicularOffset,
                                    placement.longitudinalOffset,
                                    faceDirection,
                                    placement.joint
                                );
                                renderedConnectionSides.add(runtimeCellSide);
                                mesh.userData.mullionConnectionGasket = true;
                                mesh.userData.connectionBoundary = `mullion-${runtimeCellSide}`;
                                mesh.userData.connectionProfileId =
                                    variantProfile.mullionConnectionProfileId || null;
                                placeEditableDividerMesh(mesh, segment, 'connection-gasket');
                            });
                        });

                        // Fixed-facing 224063 must be a real divider-mounted
                        // component too.  Rendering it as part of the fixed-cell
                        // perimeter gives it the cell rectangle's generic miter
                        // ends, so at a merged-L/re-entrant junction it stops
                        // before the structural mullion.  Use the direct CAD
                        // mullion transform and the exact same segmentPlacement
                        // + joint geometry as the aluminium mullion (and as the
                        // already-correct sash-facing connection gasket).
                        if (isFixedGlassAnchorGasket(variantProfile)) {
                            Object.entries(
                                variantProfile.fixedGlazingMullionCadTransforms || {}
                            ).forEach(([cellSide, cadTransform]) => {
                                if (!cadTransform) return;
                                const runtimeCellSide = segment.reversed
                                    ? (cellSide === 'left'
                                        ? 'right'
                                        : (cellSide === 'right' ? 'left' : cellSide))
                                    : cellSide;
                                if (renderedConnectionSides.has(runtimeCellSide)) return;
                                if (
                                    getEditableDividerSideCellType(
                                        segment,
                                        runtimeCellSide
                                    ) !== 'fixed-glazing'
                                ) {
                                    return;
                                }

                                const placedProfile = {
                                    ...variantProfile,
                                    cadCoordinateTransform: cadTransform,
                                    cadAlignmentShiftXMm: 0,
                                    cadAlignmentShiftYMm: 0,
                                    dividerSectionRotationDeg:
                                        Number(connectionMetadata.sectionRotationDeg)
                                        || Number(variantProfile.dividerSectionRotationDeg)
                                        || 180,
                                };
                                const splitPlacements = getSplitHostGasketPlacements(
                                    segment,
                                    segmentPlacement,
                                    runtimeCellSide
                                );
                                splitPlacements.forEach(placement => {
                                    const mesh = createDividerSegment(
                                        placedProfile,
                                        placement.length,
                                        segment.orientation,
                                        segmentDividerBounds,
                                        depthOffset,
                                        frameJointInwardSpan,
                                        segment.perpendicularOffset,
                                        placement.longitudinalOffset,
                                        faceDirection,
                                        placement.joint
                                    );
                                    renderedConnectionSides.add(runtimeCellSide);
                                    mesh.userData.mullionConnectionGasket = true;
                                    mesh.userData.fixedGlazingAccessory = true;
                                    mesh.userData.connectionBoundary = `mullion-${runtimeCellSide}`;
                                    mesh.userData.connectionProfileId = '224063';
                                    placeEditableDividerMesh(
                                        mesh,
                                        segment,
                                        'fixed-connection-gasket'
                                    );
                                });
                            });
                        }

                        Object.entries(variantProfile.mullionAccessoryCadTransforms || {})
                            .forEach(([cellSide, cadTransform]) => {
                                if (!cadTransform) return;
                                const runtimeCellSide = segment.reversed
                                    ? (cellSide === 'left' ? 'right' : (cellSide === 'right' ? 'left' : cellSide))
                                    : cellSide;
                                if (!shouldRenderEditableMullionAccessory(
                                    variantProfile,
                                    segment,
                                    runtimeCellSide
                                )) {
                                    return;
                                }
                                const placedProfile = {
                                    ...variantProfile,
                                    cadCoordinateTransform: cadTransform,
                                    cadAlignmentShiftXMm: 0,
                                    cadAlignmentShiftYMm: 0,
                                    dividerSectionRotationDeg:
                                        Number(connectionMetadata.sectionRotationDeg)
                                        || Number(variantProfile.dividerSectionRotationDeg)
                                        || 180,
                                };
                                const mesh = createDividerSegment(
                                    placedProfile,
                                    segmentPlacement.length,
                                    segment.orientation,
                                    segmentDividerBounds,
                                    depthOffset,
                                    frameJointInwardSpan,
                                    segment.perpendicularOffset,
                                    segmentPlacement.longitudinalOffset,
                                    faceDirection,
                                    segmentPlacement.joint
                                );
                                mesh.userData.mullionAccessory = true;
                                mesh.userData.connectionBoundary = `mullion-${runtimeCellSide}`;
                                mesh.userData.connectionProfileId =
                                    variantProfile.mullionAccessoryProfileId || null;
                                mesh.userData.accessoryHostProfileId =
                                    variantProfile.mullionAccessoryHostProfileId || null;
                                placeEditableDividerMesh(mesh, segment, 'accessory');
                            });
                    });
            });

            // A merged L can leave one V-shaped opening where the removed
            // divider used to continue through the now-merged window. Fill it
            // with the actual selected mullion assembly, extruded parallel to
            // the surviving mullion, and clip that assembly to the exact V
            // opening. This keeps the real aluminium/gasket/profile appearance
            // instead of drawing a generic solid-colour triangle.
            (editableTopologyGeometry?.reentrantFillers || []).forEach(filler => {
                if (filler?.renderAsSeparateMesh === false) return;
                const sourceSegment = editableSegments.find(
                    segment => segment.id === filler.sourceDividerId
                );
                if (!sourceSegment) return;

                const variantMetadata = getEditableDividerVariantMetadata(sourceSegment);
                const connectionMetadata = variantMetadata?.dividerConnection || {};
                const depthOffset = (
                    Number(connectionMetadata.depthCenterFromAssemblyCenterMm) || 0
                ) * S;
                const fillerProfiles = activeDividerProfiles.map(profile =>
                    getEditableProfileVariant(profile, sourceSegment)
                );
                const fillerBounds = getDividerSourceBounds(fillerProfiles) || dividerBounds;
                const fillerMetrics = getDividerCrossSectionMetrics(fillerBounds);
                const fillerFaceSpan = fillerMetrics.faceSpanM || dividerFaceSpan;
                if (fillerFaceSpan <= 1e-6) return;

                // The V mouth is one full mullion face wide. Build enough real
                // mullion stock to cover it, centred on the V apex, then clip
                // the result to the triangular opening. For a missing top arm
                // this creates a HORIZONTAL extrusion, not a vertical stub.
                const renderLength = filler?.fillerKind === 'rectangular-host'
                    ? Math.max(RECTANGULAR_DIVIDER_SETBACK_M * 2, Number(filler.length) || 0)
                    : fillerFaceSpan;
                const longitudinalOffset = filler.orientation === 'horizontal'
                    ? filler.apexX
                    : filler.apexY;
                const perpendicularOffset = filler.orientation === 'horizontal'
                    ? filler.apexY
                    : filler.apexX;
                const authoredFaceDirection = filler.orientation === 'horizontal' ? -1 : 1;
                const faceDirection = sourceSegment.reversed
                    ? -authoredFaceDirection
                    : authoredFaceDirection;
                const squareJoint = {
                    negativeEndMode: 'square',
                    positiveEndMode: 'square',
                    negativeFrameInwardSpan: frameJointInwardSpan,
                    positiveFrameInwardSpan: frameJointInwardSpan,
                };
                const fillerSegment = {
                    ...sourceSegment,
                    id: filler.id,
                    orientation: filler.orientation,
                    perpendicularOffset,
                };

                const createClippedFillerMesh = (
                    placedProfile,
                    { includeFaceBoundary = true } = {}
                ) => {
                    // Structural half-mullion stock ends exactly at the two
                    // aluminium shoulders. 224063 is different: its section
                    // sits outside that aluminium face, so after deliberately
                    // leaving the triangle base open it must have enough stock
                    // beyond both shoulders for the two 45-degree V planes to
                    // make the final cut. If we keep the structural stock length
                    // here, the source extrusion itself becomes the limiting
                    // boundary and produces the square/cut-off gasket end.
                    //
                    // Doubling the temporary stock is intentionally harmless:
                    // the two diagonal half-space clips still define the visible
                    // gasket ends. Only the un-clipped source stock is longer.
                    const fillerStockLength = includeFaceBoundary
                        ? renderLength
                        : renderLength + fillerFaceSpan;
                    const mesh = createDividerSegment(
                        placedProfile,
                        fillerStockLength,
                        filler.orientation,
                        fillerBounds,
                        depthOffset,
                        frameJointInwardSpan,
                        perpendicularOffset,
                        longitudinalOffset,
                        faceDirection,
                        squareJoint
                    );
                    if (!clipDividerMeshToReentrantFillerTriangle(
                        mesh,
                        filler,
                        fillerFaceSpan,
                        { includeFaceBoundary }
                    )) {
                        mesh.geometry?.dispose();
                        return null;
                    }
                    mesh.userData.reentrantFiller = true;
                    mesh.userData.reentrantFillerDirection = filler.direction;
                    mesh.userData.reentrantFillerSourceDividerId = filler.sourceDividerId;
                    return mesh;
                };

                fillerProfiles.forEach(variantProfile => {
                    const placedProfile = {
                        ...variantProfile,
                        dividerSectionRotationDeg:
                            Number(connectionMetadata.sectionRotationDeg)
                            || Number(variantProfile.dividerSectionRotationDeg)
                            || 180,
                    };
                    const mesh = createClippedFillerMesh(placedProfile);
                    if (!mesh) return;
                    mesh.userData.reentrantFillerProfileSection = true;
                    placeEditableDividerMesh(mesh, fillerSegment, 'reentrant-filler');
                });

                // The filler is a literal slice of the surviving mullion, so
                // it must carry the same join-authored components as that
                // mullion. The structural profile above comes from the
                // standalone divider assembly; 224063/245472 connection
                // gaskets and optional mullion accessories such as 200988 /
                // 224068 are separate active profiles whose exact cross-section
                // seats come from the connection DWG. Recreate those same
                // transformed profiles on the filler, then clip them with the
                // identical V mask. This keeps the accessory seated on the
                // horizontally extruded mullion section instead of adding a
                // detached or differently-oriented accessory copy.
                // The half-mullion retains only the face pointing into the
                // missing arm. Runtime divider sides are always keyed as
                // left=negative cell / right=positive cell, independent of the
                // physical orientation of the member.
                const fillerRuntimeCellSide = (() => {
                    if (filler.orientation === 'horizontal') {
                        if (filler.direction === 'south') return 'left';
                        if (filler.direction === 'north') return 'right';
                    } else if (filler.orientation === 'vertical') {
                        if (filler.direction === 'west') return 'left';
                        if (filler.direction === 'east') return 'right';
                    }
                    return null;
                })();

                dividerHostProfiles.forEach(profile => {
                    if (isFixedGlassAnchorGasket(profile) && !isProfileVisibleOnHost(profile, 'divider')) {
                        return;
                    }
                    const variantProfile = getEditableProfileVariant(profile, sourceSegment);
                    const sectionRotationDeg =
                        Number(connectionMetadata.sectionRotationDeg)
                        || Number(variantProfile.dividerSectionRotationDeg)
                        || 180;

                    const connectionTransforms = Object.entries(
                        variantProfile.mullionConnectionCadTransforms || {}
                    );
                    if (
                        !connectionTransforms.length
                        && variantProfile.mullionConnectionCadTransform
                    ) {
                        connectionTransforms.push([
                            variantProfile.mullionConnectionCellSide || 'unknown',
                            variantProfile.mullionConnectionCadTransform,
                        ]);
                    }

                    const renderedConnectionSides = new Set();
                    connectionTransforms.forEach(([cellSide, cadTransform]) => {
                        if (!cadTransform) return;
                        const runtimeCellSide = sourceSegment.reversed
                            ? (cellSide === 'left'
                                ? 'right'
                                : (cellSide === 'right' ? 'left' : cellSide))
                            : cellSide;
                        const placedProfile = {
                            ...variantProfile,
                            cadCoordinateTransform: cadTransform,
                            cadAlignmentShiftXMm: 0,
                            cadAlignmentShiftYMm: 0,
                            dividerSectionRotationDeg: sectionRotationDeg,
                        };
                        // 224063 sits just outside the aluminium mullion
                        // face. Clipping it to the half-mullion triangle's base
                        // makes it visibly stop at the aluminium end. Preserve
                        // the two diagonal V shoulders, but leave the fixed-glass
                        // face open for this gasket.
                        const mesh = createClippedFillerMesh(placedProfile, {
                            includeFaceBoundary: !isFixedGlassAnchorGasket(variantProfile),
                        });
                        if (!mesh) return;
                        renderedConnectionSides.add(runtimeCellSide);
                        mesh.userData.reentrantFillerConnectionGasket = true;
                        mesh.userData.mullionConnectionGasket = true;
                        mesh.userData.connectionBoundary = `mullion-${runtimeCellSide}`;
                        mesh.userData.connectionProfileId =
                            variantProfile.mullionConnectionProfileId || null;
                        placeEditableDividerMesh(
                            mesh,
                            fillerSegment,
                            'reentrant-filler-connection-gasket'
                        );
                    });

                    // Fixed/fixed joins do not expose 224063 through the mixed
                    // `mullionConnectionCadTransform` fields. Their two exact
                    // gasket seats live in `fixedGlazingDividerCadTransforms`.
                    // A merged-L half-mullion is a literal clipped continuation
                    // of the surviving mullion, so copy the exact fixed-side
                    // gasket for the retained face when the mixed path above did
                    // not already provide it. This is what is required when the
                    // upper L cell is fixed as well as the merged lower cell.
                    if (
                        isFixedGlassAnchorGasket(variantProfile)
                        && fillerRuntimeCellSide
                        && !renderedConnectionSides.has(fillerRuntimeCellSide)
                        && getEditableDividerSideCellType(
                            sourceSegment,
                            fillerRuntimeCellSide
                        ) === 'fixed-glazing'
                    ) {
                        // This mesh is a divider extrusion, so use the
                        // divider-native direct 224063 INSERT rather than the
                        // fixed-cell perimeter transform used by createMiteredSide().
                        const fixedCadTransform =
                            variantProfile.fixedGlazingMullionCadTransforms?.[
                            fillerRuntimeCellSide
                            ] || null;
                        if (fixedCadTransform) {
                            const placedProfile = {
                                ...variantProfile,
                                cadCoordinateTransform: fixedCadTransform,
                                cadAlignmentShiftXMm: 0,
                                cadAlignmentShiftYMm: 0,
                                dividerSectionRotationDeg: sectionRotationDeg,
                            };
                            // 224063 sits outside the aluminium half-face.
                            // Keep the filler's two V shoulders, but do not clip
                            // it at the aluminium face boundary or the complete
                            // gasket disappears when this join is fixed/fixed.
                            const mesh = createClippedFillerMesh(placedProfile, {
                                includeFaceBoundary: false,
                            });
                            if (mesh) {
                                mesh.userData.reentrantFillerConnectionGasket = true;
                                mesh.userData.mullionConnectionGasket = true;
                                mesh.userData.fixedGlazingAccessory = true;
                                mesh.userData.connectionBoundary =
                                    `mullion-${fillerRuntimeCellSide}`;
                                mesh.userData.connectionProfileId = '224063';
                                placeEditableDividerMesh(
                                    mesh,
                                    fillerSegment,
                                    'reentrant-filler-fixed-gasket'
                                );
                            }
                        }
                    }

                    Object.entries(variantProfile.mullionAccessoryCadTransforms || {})
                        .forEach(([cellSide, cadTransform]) => {
                            if (!cadTransform) return;
                            const runtimeCellSide = sourceSegment.reversed
                                ? (cellSide === 'left'
                                    ? 'right'
                                    : (cellSide === 'right' ? 'left' : cellSide))
                                : cellSide;
                            if (!shouldRenderEditableMullionAccessory(
                                variantProfile,
                                sourceSegment,
                                runtimeCellSide
                            )) {
                                return;
                            }
                            const placedProfile = {
                                ...variantProfile,
                                cadCoordinateTransform: cadTransform,
                                cadAlignmentShiftXMm: 0,
                                cadAlignmentShiftYMm: 0,
                                dividerSectionRotationDeg: sectionRotationDeg,
                            };
                            const mesh = createClippedFillerMesh(placedProfile);
                            if (!mesh) return;
                            mesh.userData.reentrantFillerAccessory = true;
                            mesh.userData.mullionAccessory = true;
                            mesh.userData.connectionBoundary = `mullion-${runtimeCellSide}`;
                            mesh.userData.connectionProfileId =
                                variantProfile.mullionAccessoryProfileId || null;
                            mesh.userData.accessoryHostProfileId =
                                variantProfile.mullionAccessoryHostProfileId || null;
                            placeEditableDividerMesh(
                                mesh,
                                fillerSegment,
                                'reentrant-filler-accessory'
                            );
                        });
                });
            });
        } else if (isTopFixedBottomSashSash && dividerBounds && tLayoutGeometry) {
            const verticalDividerConnection = currentMetadata.tLayoutVerticalDividerConnection || {};
            const verticalDividerDepthOffset = (
                Number(verticalDividerConnection.depthCenterFromAssemblyCenterMm) || 0
            ) * S;
            const placeTDividerMesh = (mesh, kind, connectionSide = null) => {
                mesh.userData.tLayoutDivider = kind;
                mesh.userData.connectionBoundary = connectionSide
                    ? `${kind}-${connectionSide}`
                    : null;
                dividerGroup.add(mesh);
            };

            const tJointFaceSpan = Math.max(0, dividerFaceSpan);
            const tJointHalfFace = tJointFaceSpan / 2;
            const splitX = Number(tLayoutGeometry.verticalMullionCenterX) || 0;

            // The split transom is one assembled section: structural profile,
            // gaskets and other divider-mounted components must all be cut by
            // the same two joint planes. Keep the segment/joint definition in
            // one place and reuse it for every component instead of deriving a
            // second gasket-specific centre trim.
            const tTransomSegments = [
                {
                    id: 'left',
                    length: Math.max(0, splitX + A / 2),
                    centerX: (-A / 2 + splitX) / 2,
                    joint: {
                        negativeEndMode: 'arrow',
                        positiveEndMode: 'socket',
                        socketInwardSign: 1,
                        socketInwardOffset: tJointHalfFace,
                        negativeFrameInwardSpan: frameJointInwardSpan,
                        positiveFrameInwardSpan: tJointFaceSpan,
                    },
                },
                {
                    id: 'right',
                    length: Math.max(0, A / 2 - splitX),
                    centerX: (splitX + A / 2) / 2,
                    joint: {
                        negativeEndMode: 'socket',
                        positiveEndMode: 'arrow',
                        socketInwardSign: 1,
                        socketInwardOffset: tJointHalfFace,
                        negativeFrameInwardSpan: tJointFaceSpan,
                        positiveFrameInwardSpan: frameJointInwardSpan,
                    },
                },
            ];
            // The lower vertical mullion is also an assembly: its mounted
            // gaskets must use the same nominal span and the same two cut
            // planes as the structural profile. The extra half-face at the top
            // is not a gasket-specific extension; it is the structural span
            // required for the V head that enters the transom socket.
            const tLowerMullionSegment = {
                length: Math.max(
                    0,
                    tLayoutGeometry.lowerStructuralHeight + tJointHalfFace
                ),
                centerY:
                    tLayoutGeometry.lowerStructuralCenterY + tJointHalfFace / 2,
                joint: {
                    negativeEndMode: 'arrow',
                    positiveEndMode: 'arrow',
                    negativeFrameInwardSpan: frameJointInwardSpan,
                    positiveFrameInwardSpan: tJointFaceSpan,
                },
            };

            activeDividerProfiles.forEach(profile => {

                // The T transom is a real two-piece joint, not one continuous
                // extrusion. Its two halves still touch on the fixed/top half
                // of the profile, while their lower inner faces open at 45° to
                // receive the V-shaped head of the lower vertical mullion.
                tTransomSegments.forEach(segment => {
                    if (segment.length <= 1e-6) return;
                    const mesh = createDividerSegment(
                        profile,
                        segment.length,
                        'horizontal',
                        dividerBounds,
                        dividerDepthOffset,
                        frameJointInwardSpan,
                        tLayoutGeometry.transomCenterY,
                        segment.centerX,
                        -1,
                        segment.joint
                    );
                    mesh.userData.tLayoutStructuralSegment = segment.id;
                    placeTDividerMesh(mesh, 'transom');
                });

                // Lower mullion: keep the accepted bottom-frame V joint, but
                // extend the nominal top end to the top face of the transom.
                // With a transom-sized positive-end span, its V apex lands on
                // the transom centre plane and the shoulders land on the lower
                // transom face, exactly inside the two-piece socket above.
                const verticalProfile = {
                    ...profile,
                    dividerSectionRotationDeg:
                        Number(verticalDividerConnection.sectionRotationDeg) || 180,
                };
                placeTDividerMesh(
                    createDividerSegment(
                        verticalProfile,
                        tLowerMullionSegment.length,
                        'vertical',
                        dividerBounds,
                        verticalDividerDepthOffset,
                        frameJointInwardSpan,
                        tLayoutGeometry.verticalMullionCenterX,
                        tLowerMullionSegment.centerY,
                        1,
                        tLowerMullionSegment.joint
                    ),
                    'lower-mullion'
                );
            });

            dividerHostProfiles
                .filter(profile =>
                    (
                        isFixedGlassAnchorGasket(profile)
                        && isProfileGroupVisible('divider')
                    )
                    || isFrameToSashRebateGasket(profile)
                )
                .forEach(profile => {
                    // Mixed fixed/transom/sash direct INSERTs for the horizontal run.
                    const horizontalConnectionTransforms = Object.entries(
                        profile.mullionConnectionCadTransforms || {}
                    );
                    if (
                        !horizontalConnectionTransforms.length
                        && profile.mullionConnectionCadTransform
                    ) {
                        horizontalConnectionTransforms.push([
                            profile.mullionConnectionCellSide || 'unknown',
                            profile.mullionConnectionCadTransform,
                        ]);
                    }
                    horizontalConnectionTransforms
                        .forEach(([cellSide, cadTransform]) => {
                            const placedProfile = {
                                ...profile,
                                cadCoordinateTransform: cadTransform,
                                cadAlignmentShiftXMm: 0,
                                cadAlignmentShiftYMm: 0,
                                dividerSectionRotationDeg:
                                    Number(currentMetadata.dividerConnection?.sectionRotationDeg) || 180,
                            };
                            const connectionCellType =
                                currentMetadata.dividerConnection?.[`${cellSide}Cell`] || null;
                            const splitAtLowerMullion =
                                connectionCellType === 'opening-sash'
                                && isFrameToSashRebateGasket(profile);

                            if (splitAtLowerMullion) {
                                // Treat the sash-side gasket as a component of the
                                // horizontal transom assembly. It uses the exact
                                // same segment lengths and 45-degree socket planes
                                // as the structural mullion profile, so changing the
                                // structural joint automatically changes the gasket
                                // cut as well. Only the gasket's CAD cross-section
                                // remains its own.
                                tTransomSegments.forEach(segment => {
                                    if (segment.length <= 1e-6) return;
                                    if (!shouldRenderMullionAccessory(profile, cellSide, dividerOrientation, 0, layoutCellTypes, segment.id, true)) {
                                        return;
                                    }
                                    const mesh = createDividerSegment(
                                        placedProfile,
                                        segment.length,
                                        'horizontal',
                                        dividerBounds,
                                        dividerDepthOffset,
                                        frameJointInwardSpan,
                                        tLayoutGeometry.transomCenterY,
                                        segment.centerX,
                                        tTransomConnectionFaceDirection,
                                        segment.joint
                                    );
                                    mesh.userData.mullionConnectionGasket = true;
                                    mesh.userData.connectionProfileId =
                                        profile.mullionConnectionProfileId;
                                    mesh.userData.tLayoutGasketSegment = segment.id;
                                    placeTDividerMesh(mesh, 'transom', cellSide);
                                });
                                return;
                            }

                            const mesh = createDividerSegment(
                                placedProfile,
                                A,
                                'horizontal',
                                dividerBounds,
                                dividerDepthOffset,
                                frameJointInwardSpan,
                                tLayoutGeometry.transomCenterY,
                                0,
                                tTransomConnectionFaceDirection
                            );
                            mesh.userData.mullionConnectionGasket = true;
                            mesh.userData.connectionProfileId = profile.mullionConnectionProfileId;
                            placeTDividerMesh(mesh, 'transom', cellSide);
                        });

                    // Exact two-sided 245472 INSERTs from mullion-sash-sash for
                    // the lower vertical mullion. No mixed-join mirroring.
                    Object.entries(profile.tLayoutVerticalMullionConnectionCadTransforms || {})
                        .forEach(([cellSide, cadTransform]) => {
                            if (!shouldRenderMullionAccessory(profile, cellSide, 'vertical', 0, layoutCellTypes, null, true)) {
                                return;
                            }
                            const placedProfile = {
                                ...profile,
                                cadCoordinateTransform: cadTransform,
                                cadAlignmentShiftXMm: 0,
                                cadAlignmentShiftYMm: 0,
                                dividerSectionRotationDeg:
                                    Number(verticalDividerConnection.sectionRotationDeg) || 180,
                            };
                            const mesh = createDividerSegment(
                                placedProfile,
                                tLowerMullionSegment.length,
                                'vertical',
                                dividerBounds,
                                verticalDividerDepthOffset,
                                frameJointInwardSpan,
                                tLayoutGeometry.verticalMullionCenterX,
                                tLowerMullionSegment.centerY,
                                1,
                                tLowerMullionSegment.joint
                            );
                            mesh.userData.mullionConnectionGasket = true;
                            mesh.userData.connectionProfileId =
                                profile.tLayoutVerticalMullionConnectionProfileId;
                            placeTDividerMesh(mesh, 'lower-mullion', cellSide);
                        });
                });

            // Optional join-authored accessories (currently 200988) are true
            // components of the T divider assembly. The horizontal copies use
            // the same two transom segments/socket cuts as the aluminium and
            // gaskets; the lower vertical copies use the same V-headed segment
            // as the mullion. No accessory-specific length is hardcoded.
            dividerHostProfiles
                .filter(profile =>
                    profile.section !== 'bottom'
                    && (
                        Object.keys(profile.mullionAccessoryCadTransforms || {}).length
                        || Object.keys(
                            profile.tLayoutVerticalMullionAccessoryCadTransforms || {}
                        ).length
                    )
                )
                .forEach(profile => {
                    Object.entries(profile.mullionAccessoryCadTransforms || {})
                        .forEach(([cellSide, cadTransform]) => {
                            const placedProfile = {
                                ...profile,
                                cadCoordinateTransform: cadTransform,
                                cadAlignmentShiftXMm: 0,
                                cadAlignmentShiftYMm: 0,
                                dividerSectionRotationDeg:
                                    Number(currentMetadata.dividerConnection?.sectionRotationDeg) || 180,
                            };
                            tTransomSegments.forEach(segment => {
                                if (segment.length <= 1e-6) return;
                                if (!shouldRenderMullionAccessory(profile, cellSide, dividerOrientation, 0, layoutCellTypes, segment.id, true)) {
                                    return;
                                }
                                const mesh = createDividerSegment(
                                    placedProfile,
                                    segment.length,
                                    'horizontal',
                                    dividerBounds,
                                    dividerDepthOffset,
                                    frameJointInwardSpan,
                                    tLayoutGeometry.transomCenterY,
                                    segment.centerX,
                                    tTransomConnectionFaceDirection,
                                    segment.joint
                                );
                                mesh.userData.mullionAccessory = true;
                                mesh.userData.connectionProfileId =
                                    profile.mullionAccessoryProfileId;
                                mesh.userData.accessoryHostProfileId =
                                    profile.mullionAccessoryHostProfileId;
                                mesh.userData.tLayoutAccessorySegment = segment.id;
                                placeTDividerMesh(mesh, 'transom', cellSide);
                            });
                        });

                    Object.entries(
                        profile.tLayoutVerticalMullionAccessoryCadTransforms || {}
                    ).forEach(([cellSide, cadTransform]) => {
                        if (!shouldRenderMullionAccessory(profile, cellSide, 'vertical', 0, layoutCellTypes, null, true)) {
                            return;
                        }
                        const placedProfile = {
                            ...profile,
                            cadCoordinateTransform: cadTransform,
                            cadAlignmentShiftXMm: 0,
                            cadAlignmentShiftYMm: 0,
                            dividerSectionRotationDeg:
                                Number(verticalDividerConnection.sectionRotationDeg) || 180,
                        };
                        const mesh = createDividerSegment(
                            placedProfile,
                            tLowerMullionSegment.length,
                            'vertical',
                            dividerBounds,
                            verticalDividerDepthOffset,
                            frameJointInwardSpan,
                            tLayoutGeometry.verticalMullionCenterX,
                            tLowerMullionSegment.centerY,
                            1,
                            tLowerMullionSegment.joint
                        );
                        mesh.userData.mullionAccessory = true;
                        mesh.userData.connectionProfileId =
                            profile.tLayoutVerticalMullionAccessoryProfileId;
                        mesh.userData.accessoryHostProfileId =
                            profile.mullionAccessoryHostProfileId;
                        placeTDividerMesh(mesh, 'lower-mullion', cellSide);
                    });
                });
        } else if (dividerOrientation && dividerBounds) {
            const dividerLength = dividerOrientation === 'vertical' ? B : A;
            const activeDividerPositions = dividerPositions.length ? dividerPositions : [0];
            const placeDividerMesh = (mesh, dividerPosition, dividerIndex) => {
                mesh.userData.dividerIndex = dividerIndex;
                mesh.userData.dividerPosition = dividerPosition;
                dividerGroup.add(mesh);
            };
            activeDividerProfiles.forEach(profile => {
                activeDividerPositions.forEach((dividerPosition, dividerIndex) => {
                    placeDividerMesh(
                        createDividerSegment(
                            profile,
                            dividerLength,
                            dividerOrientation,
                            dividerBounds,
                            dividerDepthOffset,
                            frameJointInwardSpan,
                            dividerPosition
                        ),
                        dividerPosition,
                        dividerIndex
                    );
                });
            });

            // Direct mixed-join gaskets are physically mounted on the mullion,
            // not on the neighbouring fixed/sash cell perimeter. Render them in
            // the same join coordinate system and with the same longitudinal V
            // cut as the divider itself. Only the top legacy section is needed
            // as the extrusion template for either a mullion or a transom run.
            if (dividerOrientation) {
                dividerHostProfiles
                    .filter(profile =>
                        (
                            profile.mullionConnectionCadTransform
                            || Object.keys(profile.mullionConnectionCadTransforms || {}).length
                        )
                        && (
                            (
                                isFixedGlassAnchorGasket(profile)
                                && isProfileGroupVisible('divider')
                            )
                            || isFrameToSashRebateGasket(profile)
                        )
                    )
                    .forEach(profile => {
                        const connectionTransforms = Object.entries(
                            profile.mullionConnectionCadTransforms || {}
                        );
                        if (!connectionTransforms.length && profile.mullionConnectionCadTransform) {
                            connectionTransforms.push([
                                profile.mullionConnectionCellSide || 'unknown',
                                profile.mullionConnectionCadTransform,
                            ]);
                        }

                        connectionTransforms.forEach(([cellSide, cadTransform]) => {
                            const placedProfile = {
                                ...profile,
                                cadCoordinateTransform: cadTransform,
                                cadAlignmentShiftXMm: 0,
                                cadAlignmentShiftYMm: 0,
                                dividerSectionRotationDeg:
                                    Number(currentMetadata.dividerConnection?.sectionRotationDeg) || 180,
                            };
                            activeDividerPositions.forEach((dividerPosition, dividerIndex) => {
                                if (!shouldRenderMullionAccessory(profile, cellSide, dividerOrientation, dividerIndex, layoutCellTypes, null, isTopFixedBottomSashSash)) {
                                    return;
                                }
                                const mesh = createDividerSegment(
                                    placedProfile,
                                    dividerLength,
                                    dividerOrientation,
                                    dividerBounds,
                                    dividerDepthOffset,
                                    frameJointInwardSpan,
                                    dividerPosition
                                );
                                mesh.userData.mullionConnectionGasket = true;
                                mesh.userData.connectionBoundary = `mullion-${cellSide}`;
                                mesh.userData.connectionProfileId = profile.mullionConnectionProfileId;
                                placeDividerMesh(mesh, dividerPosition, dividerIndex);
                            });
                        });
                    });
            }
        }


        // Optional accessory INSERTs authored in the active mullion join use
        // the same longitudinal divider extrusion/joint as the structural
        // profile. Their cross-sectional location comes only from CAD.
        if (!isEditableTopology && dividerOrientation && dividerBounds && !isTopFixedBottomSashSash) {
            const dividerLength = dividerOrientation === 'vertical' ? B : A;
            const activeDividerPositions = dividerPositions.length ? dividerPositions : [0];
            dividerHostProfiles
                .filter(profile =>
                    Object.keys(profile.mullionAccessoryCadTransforms || {}).length
                )
                .forEach(profile => {
                    Object.entries(profile.mullionAccessoryCadTransforms || {})
                        .forEach(([cellSide, cadTransform]) => {
                            const placedProfile = {
                                ...profile,
                                cadCoordinateTransform: cadTransform,
                                cadAlignmentShiftXMm: 0,
                                cadAlignmentShiftYMm: 0,
                                dividerSectionRotationDeg:
                                    Number(currentMetadata.dividerConnection?.sectionRotationDeg) || 180,
                            };
                            activeDividerPositions.forEach((dividerPosition, dividerIndex) => {
                                if (!shouldRenderMullionAccessory(profile, cellSide, dividerOrientation, dividerIndex, layoutCellTypes, null, isTopFixedBottomSashSash)) {
                                    return;
                                }
                                const mesh = createDividerSegment(
                                    placedProfile,
                                    dividerLength,
                                    dividerOrientation,
                                    dividerBounds,
                                    dividerDepthOffset,
                                    frameJointInwardSpan,
                                    dividerPosition
                                );
                                mesh.userData.dividerIndex = dividerIndex;
                                mesh.userData.dividerPosition = dividerPosition;
                                mesh.userData.mullionAccessory = true;
                                mesh.userData.connectionBoundary = `mullion-${cellSide}`;
                                mesh.userData.connectionProfileId =
                                    profile.mullionAccessoryProfileId;
                                mesh.userData.accessoryHostProfileId =
                                    profile.mullionAccessoryHostProfileId;
                                dividerGroup.add(mesh);
                            });
                        });
                });
        }

        // In the mixed fixed | mullion | sash connection, the mullion carries
        // its own frame-side rebate gasket on the sash-facing side.  This is
        // separate from the 245472 gasket already attached to the sash itself.
        // Place the frame-role 245472_s_5 from the exact INSERT in
        // window-mullion-sash-window.dwg, using the opening cell boundary as
        // the local side on which createMiteredSide() operates.
        if (!isEditableTopology && dividerOrientation && openingCell && !isTopFixedBottomSashSash) {
            dividerHostProfiles
                .filter(profile =>
                    isFrameToSashRebateGasket(profile)
                    && !profile.mullionConnectionCadTransform
                    && !Object.keys(profile.mullionConnectionCadTransforms || {}).length
                    && profile.mullionSashCadTransform
                    && shouldPlaceProfileOnSide(
                        profile,
                        dividerOrientation === 'horizontal'
                            ? (profile.mullionSashCellSide === 'left' ? 'top' : 'bottom')
                            : (profile.mullionSashCellSide === 'left' ? 'right' : 'left')
                    )
                )
                .forEach(profile => {
                    const openingSide = dividerOrientation === 'horizontal'
                        ? (profile.mullionSashCellSide === 'left' ? 'top' : 'bottom')
                        : (profile.mullionSashCellSide === 'left' ? 'right' : 'left');
                    const placedProfile = {
                        ...profile,
                        cadCoordinateTransform: profile.mullionSashCadTransform,
                        cadAlignmentShiftXMm: 0,
                        cadAlignmentShiftYMm: 0,
                    };
                    const mesh = createMiteredSide(
                        placedProfile,
                        openingCell.width,
                        openingCell.height,
                        openingSide,
                        profile.explodeOffset,
                        openingCell.centerX,
                        openingCell.centerY
                    );
                    mesh.userData.windowCell = openingCell.id;
                    mesh.userData.mullionSashRebateGasket = true;
                    mesh.userData.fixedGlazingConnectionBoundary = null;
                    mesh.userData.connectionBoundary = `mullion-${profile.mullionSashCellSide}`;
                    frameGroup.add(mesh);
                });
        }

        // Fixed glazing keeps the existing accessory geometry and glass-thickness
        // switching, but its glazing-bead assembly is no longer positioned from
        // the opening-sash B2 occurrence. The outer-boundary bead position comes
        // from frame-fixed; the divider-facing bead position comes from the active
        // mullion join. Both are bridged through the structural profile that is
        // already correctly placed in the runtime assembly.
        function applyFixedGlazingFollowerThicknessShift(profile, transform) {
            if (!transform || !isMovingGlazingBeadGasket(profile)) return transform;

            // In the normal B2 path 224378 follows the selected glazing bead via
            // getProfileCadXShiftMm(). A fixed-glazing CAD placement replaces the
            // profile's runtime coordinate transform, so that dynamic source-X
            // shift would otherwise be bypassed. Reapply only the thickness-
            // dependent part in source coordinates before the fixed CAD transform.
            const staticAssemblyShiftMm = Number(profile?.cadAlignmentShiftXMm) || 0;
            const totalProfileShiftMm = Number(getProfileCadXShiftMm(profile)) || 0;
            const dynamicSourceXShiftMm = totalProfileShiftMm - staticAssemblyShiftMm;
            if (Math.abs(dynamicSourceXShiftMm) < 1e-9) return transform;

            return translateCadTransformSource(
                transform,
                dynamicSourceXShiftMm,
                0
            );
        }

        function getFixedGlazingAccessoryPlacement(profile, fixedCell, side) {
            let transform = profile.fixedGlazingFrameCadTransform || null;
            let connectionBoundary = transform ? 'outer-frame' : null;

            if (dividerOrientation) {
                const dividerSide = fixedCell.dividerJoinSideByBoundary?.[side] || null;
                const dividerTransform = dividerSide
                    ? profile.fixedGlazingDividerCadTransforms?.[dividerSide]
                    : null;
                const dividerMountedTransforms = profile.mullionConnectionCadTransforms || {};
                if (
                    dividerSide
                    && (
                        dividerMountedTransforms[dividerSide]
                        || (
                            profile.mullionConnectionCadTransform
                            && profile.mullionConnectionCellSide === dividerSide
                        )
                    )
                ) {
                    // This physical gasket is rendered as part of dividerGroup
                    // from the direct join INSERT. Do not render a second copy
                    // as a fixed-cell perimeter side.
                    return { profile: null, connectionBoundary: null };
                }
                if (dividerTransform) {
                    transform = dividerTransform;
                    connectionBoundary = `divider-${dividerSide}`;
                }
            }

            transform = applyFixedGlazingFollowerThicknessShift(profile, transform);

            if (!transform) {
                // Never fall back to the old B2 sash position for 224063 in a
                // fixed-glazing cell. Until the relevant join metadata contains
                // the direct 224063 INSERT, omit it rather than rendering the
                // known-wrong sash-relative gasket.
                if (isFixedGlassAnchorGasket(profile)) {
                    return { profile: null, connectionBoundary: null };
                }
                return { profile, connectionBoundary: null };
            }

            return {
                profile: {
                    ...profile,
                    cadCoordinateTransform: transform,
                    cadAlignmentShiftXMm: 0,
                    cadAlignmentShiftYMm: 0,
                },
                connectionBoundary,
            };
        }

        function getEditableFixedBoundarySegments(fixedCell, side) {
            const matching = (editableTopologyGeometry?.dividerSegments || []).filter(segment => {
                if (side === 'left') {
                    return segment.orientation === 'vertical'
                        && segment.positiveCellId === fixedCell.id;
                }
                if (side === 'right') {
                    return segment.orientation === 'vertical'
                        && segment.negativeCellId === fixedCell.id;
                }
                if (side === 'bottom') {
                    return segment.orientation === 'horizontal'
                        && segment.positiveCellId === fixedCell.id;
                }
                return segment.orientation === 'horizontal'
                    && segment.negativeCellId === fixedCell.id;
            });
            return matching;
        }

        function getEditableFixedFramePlacements(fixedCell, side) {
            return (editableFramePlacements || []).filter(placement => {
                if (placement.side !== side) return false;
                return placement.windowCell === fixedCell.id
                    || placement.cellId === fixedCell.id;
            });
        }

        function getEditableFixedSidePlacementRect({ side, spanLength, spanCenter, sx, sy, cx, cy }) {
            if (side === 'top' || side === 'bottom') {
                return {
                    width: spanLength,
                    height: sy,
                    originX: spanCenter,
                    originY: cy,
                };
            }
            return {
                width: sx,
                height: spanLength,
                originX: cx,
                originY: spanCenter,
            };
        }

        function getEditableFixedOuterPlacedProfile(profile) {
            let transform = applyFixedGlazingFollowerThicknessShift(
                profile,
                profile.fixedGlazingFrameCadTransform || null
            );
            if (!transform && isFixedGlassAnchorGasket(profile)) return null;
            return transform
                ? {
                    ...profile,
                    cadCoordinateTransform: transform,
                    cadAlignmentShiftXMm: 0,
                    cadAlignmentShiftYMm: 0,
                }
                : profile;
        }

        function renderEditableFixedGlazingAccessory(profile, fixedCell, side) {
            const halfDivider = dividerFaceSpan / 2;
            let sx = fixedCell.fixedAccessoryWidth ?? fixedCell.width;
            let sy = fixedCell.fixedAccessoryHeight ?? fixedCell.height;
            let cx = fixedCell.fixedAccessoryCenterX ?? fixedCell.centerX;
            let cy = fixedCell.fixedAccessoryCenterY ?? fixedCell.centerY;

            if (fixedCell.topologyEdges?.bottom) {
                sy -= halfDivider;
                cy += halfDivider / 2;
            }
            if (fixedCell.topologyEdges?.top) {
                sy -= halfDivider;
                cy -= halfDivider / 2;
            }
            if (fixedCell.topologyEdges?.left) {
                sx -= halfDivider;
                cx += halfDivider / 2;
            }
            if (fixedCell.topologyEdges?.right) {
                sx -= halfDivider;
                cx -= halfDivider / 2;
            }

            const dividerSegmentsForSide = getEditableFixedBoundarySegments(fixedCell, side);

            // Glazing beads form the perimeter of the complete fixed-light
            // opening. Their extrusion span must therefore remain the full
            // fixed-cell width/height even when that side contains only a short
            // frame or mullion grid segment. The partial-segment rendering below
            // is only needed by the frame-mounted 224063 gasket.
            if (getProfileGroup(profile) === 'bead') {
                if (!dividerSegmentsForSide.length) {
                    const placedProfile = getEditableFixedOuterPlacedProfile(profile);
                    if (!placedProfile) return;
                    const mesh = createMiteredSide(
                        placedProfile,
                        sx,
                        sy,
                        side,
                        profile.explodeOffset,
                        cx,
                        cy
                    );
                    mesh.userData.windowCell = fixedCell.id;
                    mesh.userData.fixedGlazingAccessory = true;
                    mesh.userData.fixedGlazingBead = true;
                    mesh.userData.fixedGlazingConnectionBoundary = 'outer-frame';
                    frameGroup.add(mesh);
                    return;
                }

                dividerSegmentsForSide.forEach(segment => {
                    const variantProfile = getEditableProfileVariant(profile, segment);
                    const dividerSide = segment.negativeCellId === fixedCell.id ? 'left' : 'right';
                    const authoredDividerSide = segment.reversed
                        ? (dividerSide === 'left' ? 'right' : 'left')
                        : dividerSide;
                    const mountedTransforms = variantProfile.mullionConnectionCadTransforms || {};
                    if (
                        mountedTransforms[authoredDividerSide]
                        || (
                            variantProfile.mullionConnectionCadTransform
                            && variantProfile.mullionConnectionCellSide === authoredDividerSide
                        )
                    ) {
                        return;
                    }

                    let transform = getEditableFixedGlazingDividerCadTransform({
                        profile,
                        divider: segment,
                        runtimeDividerSide: dividerSide,
                    });
                    transform = applyFixedGlazingFollowerThicknessShift(variantProfile, transform);
                    const placedProfile = transform
                        ? {
                            ...variantProfile,
                            cadCoordinateTransform: transform,
                            cadAlignmentShiftXMm: 0,
                            cadAlignmentShiftYMm: 0,
                        }
                        : variantProfile;
                    const mesh = createMiteredSide(
                        placedProfile,
                        sx,
                        sy,
                        side,
                        profile.explodeOffset,
                        cx,
                        cy
                    );
                    mesh.userData.windowCell = fixedCell.id;
                    mesh.userData.fixedGlazingAccessory = true;
                    mesh.userData.fixedGlazingBead = true;
                    mesh.userData.fixedGlazingConnectionBoundary =
                        `divider-${segment.id}-${dividerSide}`;
                    frameGroup.add(mesh);
                });
                return;
            }

            const framePlacementsForSide = getEditableFixedFramePlacements(fixedCell, side);

            const renderFullFixedSide = (placedProfile, connectionBoundary) => {
                if (!placedProfile) return;
                if (isFixedGlassAnchorGasket(profile)) {
                    const hostGroup = String(connectionBoundary || '').startsWith('divider-')
                        ? 'divider'
                        : 'frame';
                    if (!isProfileVisibleOnHost(profile, hostGroup)) return;
                }
                const mesh = createMiteredSide(
                    placedProfile,
                    sx,
                    sy,
                    side,
                    profile.explodeOffset,
                    cx,
                    cy
                );
                mesh.userData.windowCell = fixedCell.id;
                mesh.userData.fixedGlazingAccessory = true;
                mesh.userData.fixedGlazingBead = false;
                mesh.userData.fixedGlazingConnectionBoundary = connectionBoundary;
                frameGroup.add(mesh);
            };

            const getDividerPlacedProfile = segment => {
                const variantProfile = getEditableProfileVariant(profile, segment);
                const dividerSide = segment.negativeCellId === fixedCell.id ? 'left' : 'right';
                const authoredDividerSide = segment.reversed
                    ? (dividerSide === 'left' ? 'right' : 'left')
                    : dividerSide;
                const mountedTransforms = variantProfile.mullionConnectionCadTransforms || {};
                const fixedMountedTransforms =
                    variantProfile.fixedGlazingMullionCadTransforms || {};
                const isMountedDirectly = Boolean(
                    mountedTransforms[authoredDividerSide]
                    || (
                        variantProfile.mullionConnectionCadTransform
                        && variantProfile.mullionConnectionCellSide === authoredDividerSide
                    )
                    || (
                        isFixedGlassAnchorGasket(variantProfile)
                        && fixedMountedTransforms[authoredDividerSide]
                    )
                );
                if (isMountedDirectly) {
                    // The direct 224063 join INSERT is emitted with the divider
                    // segment itself, so this fixed-light pass must not duplicate it.
                    return { placedProfile: null, dividerSide, mountedDirectly: true };
                }

                let transform = getEditableFixedGlazingDividerCadTransform({
                    profile,
                    divider: segment,
                    runtimeDividerSide: dividerSide,
                });
                transform = applyFixedGlazingFollowerThicknessShift(variantProfile, transform);
                if (!transform && isFixedGlassAnchorGasket(profile)) {
                    return { placedProfile: null, dividerSide, mountedDirectly: false };
                }
                return {
                    placedProfile: transform
                        ? {
                            ...variantProfile,
                            cadCoordinateTransform: transform,
                            cadAlignmentShiftXMm: 0,
                            cadAlignmentShiftYMm: 0,
                        }
                        : variantProfile,
                    dividerSide,
                    mountedDirectly: false,
                };
            };

            // Ordinary fixed-light frame sides must keep the complete fixed-cell
            // span. Splitting 224063 by every frame placement made the gasket
            // visibly short on otherwise normal fixed windows. Segmentation is
            // only required when one logical side is physically shared by an
            // outer-frame piece and a mullion piece (the merged/re-entrant case).
            if (!dividerSegmentsForSide.length) {
                renderFullFixedSide(
                    getEditableFixedOuterPlacedProfile(profile),
                    'outer-frame'
                );
                return;
            }

            const hasMixedFrameAndDividerBoundary = framePlacementsForSide.length > 0;
            if (!hasMixedFrameAndDividerBoundary) {
                // A single divider-owned side can still use the full fixed-cell
                // perimeter dimensions when its 224063 is not already emitted
                // as a direct mullion INSERT. Multi-segment divider boundaries
                // remain segmented so each join keeps its own CAD seat.
                if (dividerSegmentsForSide.length === 1) {
                    const segment = dividerSegmentsForSide[0];
                    const placement = getDividerPlacedProfile(segment);
                    if (placement.mountedDirectly) return;
                    renderFullFixedSide(
                        placement.placedProfile,
                        `divider-${segment.id}-${placement.dividerSide}`
                    );
                    return;
                }

                dividerSegmentsForSide.forEach(segment => {
                    const placement = getDividerPlacedProfile(segment);
                    if (!placement.placedProfile) return;
                    if (isFixedGlassAnchorGasket(profile) && !isProfileVisibleOnHost(profile, 'divider')) {
                        return;
                    }
                    const rect = getEditableFixedSidePlacementRect({
                        side,
                        spanLength: segment.length,
                        spanCenter: segment.longitudinalOffset,
                        sx,
                        sy,
                        cx,
                        cy,
                    });
                    const mesh = createMiteredSide(
                        placement.placedProfile,
                        rect.width,
                        rect.height,
                        side,
                        profile.explodeOffset,
                        rect.originX,
                        rect.originY
                    );
                    mesh.userData.windowCell = fixedCell.id;
                    mesh.userData.fixedGlazingAccessory = true;
                    mesh.userData.fixedGlazingBead = false;
                    mesh.userData.fixedGlazingConnectionBoundary =
                        `divider-${segment.id}-${placement.dividerSide}`;
                    frameGroup.add(mesh);
                });
                return;
            }

            // Mixed merged/re-entrant side: render only the exposed outer-frame
            // portions here. The divider-owned 224063 copies are either emitted
            // directly from the join CAD or, when unavailable, rendered below
            // with the exact divider-side transform. Together they cover the
            // full logical fixed-light edge without stretching one CAD seat over
            // two different host profiles.
            framePlacementsForSide.forEach(placement => {
                const placedProfile = getEditableFixedOuterPlacedProfile(profile);
                if (!placedProfile) return;
                if (isFixedGlassAnchorGasket(profile) && !isProfileVisibleOnHost(profile, 'frame')) {
                    return;
                }
                const rect = getEditableFixedSidePlacementRect({
                    side,
                    spanLength: side === 'top' || side === 'bottom'
                        ? placement.width
                        : placement.height,
                    spanCenter: side === 'top' || side === 'bottom'
                        ? placement.originX
                        : placement.originY,
                    sx,
                    sy,
                    cx,
                    cy,
                });
                const mesh = createMiteredSide(
                    placedProfile,
                    rect.width,
                    rect.height,
                    side,
                    profile.explodeOffset,
                    rect.originX,
                    rect.originY,
                    placement.localJointEnds?.length
                        ? {
                            localJointEnd: placement.localJointEnd,
                            localJointEnds: placement.localJointEnds,
                            faceSpan: dividerFaceSpan,
                            frameInwardSpan: frameJointInwardSpan,
                            endModes: placement.frameJointModes,
                            centerShifts: placement.frameJointCenterShifts,
                            reentrantFrameBoundaryOffset: placement.reentrantFrameBoundaryOffset,
                        }
                        : null
                );
                mesh.userData.windowCell = fixedCell.id;
                mesh.userData.fixedGlazingAccessory = true;
                mesh.userData.fixedGlazingBead = false;
                mesh.userData.fixedGlazingConnectionBoundary = 'outer-frame';
                frameGroup.add(mesh);
            });

            dividerSegmentsForSide.forEach(segment => {
                const placement = getDividerPlacedProfile(segment);
                if (!placement.placedProfile) return;
                if (isFixedGlassAnchorGasket(profile) && !isProfileVisibleOnHost(profile, 'divider')) {
                    return;
                }
                const rect = getEditableFixedSidePlacementRect({
                    side,
                    spanLength: segment.length,
                    spanCenter: segment.longitudinalOffset,
                    sx,
                    sy,
                    cx,
                    cy,
                });
                const mesh = createMiteredSide(
                    placement.placedProfile,
                    rect.width,
                    rect.height,
                    side,
                    profile.explodeOffset,
                    rect.originX,
                    rect.originY
                );
                mesh.userData.windowCell = fixedCell.id;
                mesh.userData.fixedGlazingAccessory = true;
                mesh.userData.fixedGlazingBead = false;
                mesh.userData.fixedGlazingConnectionBoundary =
                    `divider-${segment.id}-${placement.dividerSide}`;
                frameGroup.add(mesh);
            });

        }

        if (fixedCells.length) {
            fixedGlazingProfiles
                .filter(profile => {
                    return getProfileGroup(profile) === 'bead'
                        || isFixedGlassAnchorGasket(profile);
                })
                .forEach(profile => {
                    fixedCells.forEach((fixedCell, fixedCellIndex) => {
                        sides.forEach(side => {
                            if (!shouldPlaceProfileOnSide(profile, side)) return;
                            if (isEditableTopology) {
                                renderEditableFixedGlazingAccessory(profile, fixedCell, side);
                                return;
                            }

                            const placement = getFixedGlazingAccessoryPlacement(
                                profile,
                                fixedCell,
                                side
                            );
                            if (!placement.profile) return;
                            if (isFixedGlassAnchorGasket(profile)) {
                                const hostGroup = String(placement.connectionBoundary || '').startsWith('divider-')
                                    ? 'divider'
                                    : 'frame';
                                if (!isProfileVisibleOnHost(profile, hostGroup)) return;
                            }

                            const mesh = createMiteredSide(
                                placement.profile,
                                fixedCell.fixedAccessoryWidth ?? fixedCell.width,
                                fixedCell.fixedAccessoryHeight ?? fixedCell.height,
                                side,
                                profile.explodeOffset,
                                fixedCell.fixedAccessoryCenterX ?? fixedCell.centerX,
                                fixedCell.fixedAccessoryCenterY ?? fixedCell.centerY
                            );
                            mesh.userData.windowCell = fixedCell.id;
                            mesh.userData.fixedGlazingAccessory = true;
                            mesh.userData.fixedGlazingBead = getProfileGroup(profile) === 'bead';
                            mesh.userData.fixedGlazingConnectionBoundary = placement.connectionBoundary;
                            frameGroup.add(mesh);
                        });
                    });
                });
        }
        const t_meshes_end = performance.now();

        mainGroup.add(frameGroup);
        mainGroup.add(dividerGroup);

        // Glass: place the opening pane in the selected sash cell. Divider
        // layouts also receive a second, stationary fixed pane on the other side.
        const glassPlacement = resolveGlassPlacement(sashCenterX);
        const leftInset = glassPlacement.leftInsetMm * S;
        const rightInset = glassPlacement.rightInsetMm * S;
        const topInset = glassPlacement.topInsetMm * S;
        const bottomInset = glassPlacement.bottomInsetMm * S;

        function createGlassPane({
            width,
            height,
            centerX,
            centerY,
            isFixed = false,
            cellId = null,
            glazingCavity = null,
            numberIndex = 0,
        }) {
            const paneWidth = Math.max(0.05, width);
            const paneHeight = Math.max(0.05, height);
            const pane = geometry.panel(
                paneWidth, paneHeight, glassPlacement.thicknessMm * S, glassMat
            );
            fabricationGlassPieces.push(Object.freeze({
                width: paneWidth,
                height: paneHeight,
                centerX,
                centerY,
                isFixed: Boolean(isFixed),
                cellId,
            }));
            pane.position.set(centerX, centerY, glassPlacement.centerZ);
            // Transparent glass should not cast the same fully opaque shadow as
            // aluminium/PVC components. Three.js shadow maps treat a transparent
            // MeshStandardMaterial as an opaque depth caster, so leaving castShadow
            // enabled makes the pane darken the ground as strongly as the frame.
            // Keep receiving shadows for depth cues, but let only the solid window
            // components cast workshop/scene shadows.
            pane.castShadow = false;
            pane.receiveShadow = !captureMode;
            pane.userData.glazingCavity = glazingCavity;
            pane.userData.windowCell = cellId || (isFixed ? 'fixed' : 'opening');
            pane.userData.windowGlassCellId = cellId || null;
            pane.userData.explodeLayer = 'glass';
            pane.userData.explodeAssemblyKey = `glass:${cellId || (isFixed ? 'fixed' : 'opening')}`;
            pane.userData.explodeLayout = {
                axis: null,
                fallbackSign: 1,
                requestedDistance: Number(EXPLODE_LAYER_BASE_DISTANCE.glass) || 0,
                requestedZ: isFixed ? 0.35 : 0.5,
            };
            if (cellId) {
                glassHitMeshes.push(pane);
                const numberSprite = createGlassNumberSprite(cellId, numberIndex);
                numberSprite.position.set(0, 0, glassPlacement.thicknessMm * S * 0.6 + 0.006);
                pane.add(numberSprite);
            }
            registerExplode(pane, 0, 0, isFixed ? 0.35 : 0.5);
            return pane;
        }

        if (openingCells.length) {
            const glazingCavity = glassPlacement.cavity
                ? {
                    leftGasketIndex: glassPlacement.cavity.leftGasket.index,
                    rightGasketIndex: glassPlacement.cavity.rightGasket.index,
                    cavityWidthMm: glassPlacement.cavity.cavityWidthMm,
                    overlapHeightMm: glassPlacement.cavity.overlapHeightMm,
                    leftInsetMm: glassPlacement.leftInsetMm,
                    rightInsetMm: glassPlacement.rightInsetMm,
                    topInsetMm: glassPlacement.topInsetMm,
                    bottomInsetMm: glassPlacement.bottomInsetMm,
                    anchorGasketIndex: glassPlacement.anchorGasket?.index ?? null,
                    movingGasketIndex: glassPlacement.movingGasket?.index ?? null,
                    fixedFaceCadX: glassPlacement.fixedFaceCadX,
                    movingFaceCadX: glassPlacement.movingFaceCadX,
                    depthDirection: glassPlacement.depthDirection,
                }
                : null;
            const isMultiOpening = openingCells.length > 1;
            const selectedHandleSide = getSelectedHandleSide();
            const selectedHandleSideChanged = !isMultiOpening
                && lastBuiltHandleSide !== null
                && lastBuiltHandleSide !== selectedHandleSide;
            if (selectedHandleSideChanged) {
                handleHoldUntil = performance.now() + 50;
            }
            const previousPrimaryHandleRotationZ = handleLeverGroup?.rotation?.z;
            handleLeverGroup = null;

            openingCells.forEach((cell, cellIndex) => {
                const targetSashGroup = sashGroupsByCell.get(cell.id);
                if (!targetSashGroup) return;

                const openingGlassW = Math.max(0.05, cell.width - leftInset - rightInset);
                const openingGlassH = Math.max(0.05, cell.height - topInset - bottomInset);
                const openingGlassCenterX = cell.centerX + (leftInset - rightInset) / 2;
                const openingGlassCenterY = cell.centerY + (bottomInset - topInset) / 2;
                targetSashGroup.add(createGlassPane({
                    width: openingGlassW,
                    height: openingGlassH,
                    centerX: openingGlassCenterX,
                    centerY: openingGlassCenterY,
                    cellId: cell.id,
                    glazingCavity,
                    numberIndex: cell.cellIndex ?? cellIndex,
                }));

                // In a sash/sash mullion layout both handles sit toward the
                // mullion and both hinges sit on the outer frame. Other layouts
                // keep the user's existing global handle-side selection.
                const ownedTransSegment = isEditableTopology
                    ? (editableTopologyGeometry?.transSegments || []).find(segment => (
                        segment.ownerCellId === cell.id
                    ))
                    : null;
                const transOwnerHandleSide = ownedTransSegment
                    ? getTransOwnerHandleSide(ownedTransSegment)
                    : null;
                // A flying trans is fixed to the meeting edge of its owner sash.
                // That sash must therefore hinge on the outside frame: for the
                // default right-hand owner, the handle is on the left and the
                // sash opens left-to-right. Removing trans restores the normal
                // per-cell/global handle selection.
                const cellHandleSide = transOwnerHandleSide
                    || cell.handleSide
                    || (isMultiOpening && dividerOrientation === 'vertical'
                        ? (cell.joinCellSide === 'left' ? 'right' : 'left')
                        : selectedHandleSide);
                const isLeftHandle = cellHandleSide === 'left';
                const defaultRot = document.getElementById('mBatant').checked
                    ? (isLeftHandle ? Math.PI / 2 : -Math.PI / 2)
                    : (isLeftHandle ? Math.PI : -Math.PI);
                let leverGroup = null;

                if (!ownedTransSegment) {
                    leverGroup = new THREE.Group();
                    leverGroup.rotation.z = (
                        cellIndex === 0
                        && !isMultiOpening
                        && !selectedHandleSideChanged
                        && Number.isFinite(previousPrimaryHandleRotationZ)
                    )
                        ? previousPrimaryHandleRotationZ
                        : (selectedHandleSideChanged ? 0 : defaultRot);
                    if (cellIndex === 0) handleLeverGroup = leverGroup;

                    const handleBase = new THREE.Group();
                    const plateShape = createRoundedRectShape(0.04, 0.1, 0.027);
                    const plateGeo = geometry.solidProfile(plateShape, {
                        depth: 0.005,
                        bevelEnabled: false,
                        curveSegments: 20
                    }, { edgeFinish: 'aluminium.handle' });
                    plateGeo.translate(0, 0, -0.007);
                    const plate = geometry.mesh(plateGeo, handleMat);
                    plate.castShadow = !captureMode;
                    plate.receiveShadow = !captureMode;
                    plate.userData.windowHandleCellId = cell.id;
                    handleHitMeshes.push(plate);
                    handleBase.add(plate);

                    let centerX = 0;
                    let centerY = 0;
                    let radius = 0.01;
                    let segments = 16;
                    const neckGeo = geometry.library.create('primitive.cylinder', {
                        radius,
                        height: 0.014,
                        radialSegments: 72,
                        heightSegments: 1,
                    });
                    neckGeo.rotateX(Math.PI / 2);
                    neckGeo.translate(0, 0, -0.001);
                    const neck = geometry.mesh(neckGeo, handleMat, {
                        mapping: { mode: 'cylindrical', grainAxis: 'z', radius },
                    });
                    neck.position.set(0, 0, 0.006);
                    neck.castShadow = !captureMode;
                    neck.receiveShadow = !captureMode;
                    neck.userData.windowHandleCellId = cell.id;
                    handleHitMeshes.push(neck);
                    handleBase.add(neck);

                    const leverShape = new THREE.Shape();
                    leverShape.moveTo(-0.01, 0.055);
                    centerX = 0;
                    centerY = 0.055;
                    radius = 0.01;
                    segments = 16;
                    for (let i = 1; i <= segments; i++) {
                        const angle = 3 * Math.PI / 2 + (i / segments) * Math.PI;
                        leverShape.lineTo(
                            centerX + Math.sin(angle) * radius,
                            centerY + Math.cos(angle) * radius
                        );
                    }
                    leverShape.lineTo(0.01, -0.055);
                    leverShape.lineTo(-0.01, -0.055);
                    leverShape.lineTo(-0.01, 0.055);
                    const leverGeo = geometry.solidProfile(leverShape, {
                        depth: 0.012,
                        bevelEnabled: false,
                        curveSegments: 24
                    }, { edgeFinish: 'aluminium.handle' });
                    leverGeo.center();
                    leverGeo.translate(0, -0.050, 0.018);
                    const lever = geometry.mesh(leverGeo, handleMat);
                    lever.castShadow = !captureMode;
                    lever.receiveShadow = !captureMode;
                    lever.userData.windowHandleCellId = cell.id;
                    handleHitMeshes.push(lever);
                    leverGroup.add(lever);
                    handleBase.add(leverGroup);

                    const sashInteriorZ = (sashMaxX - currentMetadata.globalCenterX) * S;
                    const handleInwardShift = 0.01;
                    const handleLocalX = isLeftHandle
                        ? -cell.width / 2 + leftInset - 0.04 + handleInwardShift
                        : cell.width / 2 - rightInset + 0.04 - handleInwardShift;
                    const handleX = cell.centerX + handleLocalX;
                    handleBase.position.set(handleX, cell.centerY, sashInteriorZ + 0.0075);
                    handleBase.userData.windowCell = cell.id;
                    handleBase.userData.explodeLayer = 'sash';
                    handleBase.userData.explodeFollower = true;
                    handleBase.userData.explodeAssemblyKey = `sash:${cell.id}:${isLeftHandle ? 'left' : 'right'}`;
                    registerOutwardAxisExplode(
                        handleBase,
                        'x',
                        0.26,
                        0.9,
                        isLeftHandle ? -1 : 1
                    );
                    targetSashGroup.add(handleBase);
                } else {
                    if (cellIndex === 0) handleLeverGroup = null;
                }

                const hingeX = cell.centerX + (
                    isLeftHandle ? (cell.width / 2 - 0.04) : (-cell.width / 2 + 0.04)
                );
                const hingeY = cell.centerY - cell.height / 2 + 0.04;
                const hingeZ = sashCenterX;
                const cellPivotOscilo = cellIndex === 0 ? pivotOscilo : new THREE.Group();
                const cellPivotBatant = cellIndex === 0 ? pivotBatant : new THREE.Group();
                cellPivotOscilo.position.set(0, hingeY, hingeZ);
                cellPivotOscilo.rotation.set(0, 0, 0);
                cellPivotBatant.position.set(hingeX, -hingeY, 0);
                cellPivotBatant.rotation.set(0, 0, 0);
                mainGroup.add(cellPivotOscilo);
                cellPivotOscilo.add(cellPivotBatant);

                const sashWrapper = new THREE.Group();
                sashWrapper.position.set(-hingeX, 0, -hingeZ);
                sashWrapper.add(targetSashGroup);
                cellPivotBatant.add(sashWrapper);

                if (!ownedTransSegment) {
                    sashPoseAssemblies.push({
                        pivotOscilo: cellPivotOscilo,
                        pivotBatant: cellPivotBatant,
                        handleLeverGroup: leverGroup,
                        isLeftHandle,
                        cellId: cell.id,
                    });
                }
            });

            lastBuiltHandleSide = isMultiOpening ? null : selectedHandleSide;
        } else {
            handleLeverGroup = null;
            lastBuiltHandleSide = null;
            mainGroup.add(sashGroup);
        }

        // Opening pose is per sash. Rebuilding the geometry must not collapse
        // all opening sashes back onto one shared angle value.
        const activeSashIds = new Set(
            sashPoseAssemblies.map(assembly => String(assembly.cellId))
        );
        for (const id of [...sashPoseAnglesByCell.keys()]) {
            if (!activeSashIds.has(String(id))) sashPoseAnglesByCell.delete(id);
        }
        sashPoseAssemblies.forEach((assembly, index) => {
            const id = String(assembly.cellId);
            if (!sashPoseAnglesByCell.has(id)) {
                const initialAngle = !poseStateInitialized && sashPoseAssemblies.length === 1 && index === 0
                    ? clampOpeningAngle(document.getElementById('openAngle')?.value)
                    : 0;
                sashPoseAnglesByCell.set(id, initialAngle);
            }
        });
        poseStateInitialized = true;
        if (selectedGlassCellId && activeSashIds.has(String(selectedGlassCellId))) {
            activePoseCellId = String(selectedGlassCellId);
        } else if (!activePoseCellId || !activeSashIds.has(String(activePoseCellId))) {
            activePoseCellId = sashPoseAssemblies[0]?.cellId
                ? String(sashPoseAssemblies[0].cellId)
                : null;
        }
        syncOpenAngleControl(activePoseCellId);

        if (fixedCells.length) {
            fixedCells.forEach((fixedCell, fixedCellIndex) => {
                const panePlacement = getFixedGlassPanePlacement({
                    width: fixedCell.fixedAccessoryWidth ?? fixedCell.width,
                    height: fixedCell.fixedAccessoryHeight ?? fixedCell.height,
                    centerX: fixedCell.fixedAccessoryCenterX ?? fixedCell.centerX,
                    centerY: fixedCell.fixedAccessoryCenterY ?? fixedCell.centerY,
                    outerInset: 0.05,
                });
                frameGroup.add(createGlassPane({
                    width: panePlacement.width,
                    height: panePlacement.height,
                    centerX: panePlacement.centerX,
                    centerY: panePlacement.centerY,
                    isFixed: true,
                    cellId: fixedCell.id,
                    numberIndex: fixedCell.cellIndex ?? (openingCells.length + fixedCellIndex),
                }));
            });
        }

        // Resolve the exploded view only after every profile has been parented
        // into its final closed-window hierarchy. This gives collision packing
        // the real configuration-wide XY bounds instead of the temporary local
        // coordinates used while individual meshes are being created.
        mainGroup.updateWorldMatrix(true, true);
        finalizeExplodedLayout();

        const t_pics_start = performance.now();
        // Update side-by-side component pictures
        updateComponentPictures();
        const t_pics_end = performance.now();

        const t_house_start = performance.now();
        // Build House Environment
        buildHouse(A, B);
        alignWindowLayoutAboveGround();
        applyExplodedWindowForwardOffset(explodeProgress);
        const t_house_end = performance.now();

        const t_dims_start = performance.now();
        // Build Dimension Lines
        buildDimensionLines(A, B, activeProfiles);
        const t_dims_end = performance.now();

        // Manufacturing data deliberately follows the logical window assembly,
        // not the renderer's temporary socket/arrow meshes. The Summary BOM can
        // therefore turn frame/divider topology into realistic workshop cuts
        // (for example a continuous frame with a square-ended mullion attached).
        lastFabricationSnapshot = Object.freeze({
            width: A,
            height: B,
            layoutState,
            openingCells: Object.freeze(openingCells.map(cell => Object.freeze({
                id: cell.id,
                width: Number(cell.width) || 0,
                height: Number(cell.height) || 0,
                centerX: Number(cell.centerX) || 0,
                centerY: Number(cell.centerY) || 0,
            }))),
            fixedCells: Object.freeze(fixedCells.map(cell => Object.freeze({
                id: cell.id,
                width: Number(cell.width) || 0,
                height: Number(cell.height) || 0,
                centerX: Number(cell.centerX) || 0,
                centerY: Number(cell.centerY) || 0,
                fixedAccessoryWidth: Number(cell.fixedAccessoryWidth ?? cell.width) || 0,
                fixedAccessoryHeight: Number(cell.fixedAccessoryHeight ?? cell.height) || 0,
                fixedAccessoryCenterX: Number(cell.fixedAccessoryCenterX ?? cell.centerX) || 0,
                fixedAccessoryCenterY: Number(cell.fixedAccessoryCenterY ?? cell.centerY) || 0,
            }))),
            glassPieces: Object.freeze([...fabricationGlassPieces]),
        });
        onFabricationSnapshot(lastFabricationSnapshot);

        const t_end = performance.now();
        console.log("PERF:", JSON.stringify({
            total: t_end - t_start,
            clear: t_clear - t_start,
            samples: t_samples_end - t_samples_start,
            meshes: t_meshes_end - t_meshes_start,
            pics: t_pics_end - t_pics_start,
            house: t_house_end - t_house_start,
            dims: t_dims_end - t_dims_start
        }));
    }

    function applySashPose(assembly, value, isBatant, { instantHandle = false } = {}) {
        const isLeftHandle = assembly.isLeftHandle;
        const clamped = clampOpeningAngle(value);
        if (isBatant) {
            const valueRad = Math.min(clamped, 80) * (Math.PI / 180);
            assembly.pivotBatant.rotation.y = isLeftHandle ? valueRad : -valueRad;
            assembly.pivotOscilo.rotation.x = 0;
        } else {
            assembly.pivotBatant.rotation.y = 0;
            const valueRad = Math.min(clamped, 15) * (Math.PI / 180);
            assembly.pivotOscilo.rotation.x = valueRad;
        }

        const targetRotationZ = isBatant
            ? (isLeftHandle ? Math.PI / 2 : -Math.PI / 2)
            : (isLeftHandle ? Math.PI : -Math.PI);
        if (assembly.handleLeverGroup) {
            if (instantHandle) {
                assembly.handleLeverGroup.rotation.z = targetRotationZ;
            } else if (performance.now() < handleHoldUntil && sashPoseAssemblies.length === 1) {
                assembly.handleLeverGroup.rotation.z = 0;
            } else {
                assembly.handleLeverGroup.rotation.z = THREE.MathUtils.lerp(
                    assembly.handleLeverGroup.rotation.z,
                    targetRotationZ,
                    0.10
                );
            }
        }
    }

    function applyCurrentPoseInstantly() {
        handleAngleAnimation = null;
        const isBatant = document.getElementById('mBatant').checked;
        const activeId = getActivePoseCellId();
        if (activeId) {
            // Preserve the existing external opening-angle control, but scope it
            // to the currently selected/active sash instead of all sashes.
            const input = document.getElementById('openAngle');
            if (input) setPoseAngle(activeId, input.value);
        }

        sashPoseAssemblies.forEach(assembly => {
            applySashPose(assembly, getPoseAngle(assembly.cellId), isBatant, { instantHandle: true });
        });
        syncOpenAngleControl(activeId);

        const targetExplode = isExploded ? 1 : 0;
        explodeProgress = targetExplode;
        applyExplodeTransforms(targetExplode);
        mainGroup.updateWorldMatrix(true, true);
    }

    function updatePoseAnimation() {
        const openAngleInput = document.getElementById('openAngle');
        const isBatant = document.getElementById('mBatant').checked;
        const maxAngle = getOpeningAngleLimit();

        if (handleAngleAnimation) {
            const animationCellId = String(handleAngleAnimation.cellId);
            if (!hasPoseAssembly(animationCellId)) {
                handleAngleAnimation = null;
            } else if (Math.abs(handleAngleAnimation.maxAngle - maxAngle) > 0.001) {
                // Changing turn/tilt mode changes the legal range. Keep the
                // animated sash independent and clamp only that sash.
                setPoseAngle(animationCellId, getPoseAngle(animationCellId));
                handleAngleAnimation = null;
            } else {
                const elapsed = performance.now() - handleAngleAnimation.startedAt;
                const progress = Math.min(1, elapsed / handleAngleAnimation.durationMs);
                const eased = easeHandleMotion(progress);
                let value = THREE.MathUtils.lerp(
                    handleAngleAnimation.from,
                    handleAngleAnimation.to,
                    eased
                );
                if (progress >= 1) {
                    value = handleAngleAnimation.to;
                }
                setPoseAngle(animationCellId, value);

                if (getActivePoseCellId() === animationCellId && openAngleInput) {
                    openAngleInput.value = String(Math.round(value));
                }
                if (progress >= 1) {
                    handleAngleAnimation = null;
                }
            }
        }

        sashPoseAssemblies.forEach(assembly => {
            const value = setPoseAngle(assembly.cellId, getPoseAngle(assembly.cellId));
            applySashPose(assembly, value, isBatant);
        });

        const activeId = getActivePoseCellId();
        if (activeId) {
            const activeValue = getPoseAngle(activeId);
            const valAngleEl = document.getElementById('valAngle');
            if (valAngleEl) valAngleEl.innerText = `${Math.round(activeValue)}°`;
            if (!handleAngleAnimation && openAngleInput) {
                openAngleInput.value = String(Math.round(activeValue));
            }
        } else {
            const valAngleEl = document.getElementById('valAngle');
            if (valAngleEl) valAngleEl.innerText = '0°';
        }

        explodeProgress = THREE.MathUtils.lerp(
            explodeProgress,
            isExploded ? 1 : 0,
            0.08
        );
        applyExplodeTransforms(explodeProgress);
    }

    function setProfileData(
        metadata,
        profiles,
        nextSectionSampleMetadata = metadata,
        nextSectionSampleProfiles = profiles
    ) {
        currentMetadata = metadata;
        profilesData = profiles;
        sectionSampleMetadata = nextSectionSampleMetadata;
        sectionSampleProfilesData = Array.isArray(nextSectionSampleProfiles)
            ? nextSectionSampleProfiles
            : [];
        invalidateSectionSamples();
    }

    function invalidateSectionSamples() {
        lastSectionSampleSignature = '';
    }

    function setExploded(value) {
        isExploded = Boolean(value);
    }

    function getIsExploded() {
        return isExploded;
    }

    return {
        placementRoot,
        mainGroup,
        sectionGroup,
        buildWindow,
        applyCurrentPoseInstantly,
        updatePoseAnimation,
        clearTemplateGeometryCache,
        invalidateSectionSamples,
        setProfileData,
        setExploded,
        getIsExploded,
        getEditableTopologyGeometry: () => editableTopologyGeometry,
        setSelectedGlassCell,
        getFabricationSnapshot: () => lastFabricationSnapshot,
    };
}
