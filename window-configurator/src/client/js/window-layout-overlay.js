import * as THREE from 'three';
import {
    FIXED_WINDOW_TYPE,
    SASH_WINDOW_TYPE,
} from './window-layout-state.js';
import { getWindowLocale, windowT } from './i18n.js';

const ADD_WINDOW_OUTER_OFFSET_M = 0.075;
const ADD_WINDOW_DOWNWARD_OFFSET_PX = 22;
const FRONT_OFFSET_M = 0.16;

function stopPointerPropagation(element) {
    ['pointerdown', 'pointerup', 'click', 'dblclick'].forEach(type => {
        element.addEventListener(type, event => event.stopPropagation());
    });
}

function projectLocalPoint({ point, camera, mainGroup, container }) {
    if (!camera || !mainGroup || !container) return null;
    camera.updateMatrixWorld();
    mainGroup.updateWorldMatrix(true, false);
    const world = point.clone();
    mainGroup.localToWorld(world);
    const projected = world.project(camera);
    if (projected.z < -1 || projected.z > 1) return null;
    const rect = container.getBoundingClientRect();
    return {
        x: (projected.x * 0.5 + 0.5) * rect.width,
        y: (-projected.y * 0.5 + 0.5) * rect.height,
    };
}


export function createWindowLayoutOverlay({
    container,
    camera,
    mainGroup,
    getWindowLayoutState,
    getWidth,
    getHeight,
    getSelectedHandleSide = () => 'right',
    onAddWindow = async () => { },
    onMergeWindows = async () => { },
    onSetTransWindows = async () => { },
    enabled = true,
    getEditableTopologyGeometry = () => null,
} = {}) {
    if (!container || typeof document === 'undefined') {
        return { update() { }, destroy() { }, closeWheel() { } };
    }

    const root = document.createElement('div');
    root.className = 'window-layout-overlay';
    root.setAttribute('aria-label', windowT(getWindowLocale(), 'layout.overlayAria'));
    container.appendChild(root);

    let renderedSignature = null;
    let controls = [];
    let wheel = null;
    let wheelAnchorDefinition = null;

    function closeWheel() {
        wheel?.remove();
        wheel = null;
        wheelAnchorDefinition = null;
    }

    function getCell(state, id) {
        return state?.windowState?.windows?.find(cell => cell.id === id) || null;
    }

    function openTypeWheel(anchorDefinition, onSelect) {
        closeWheel();
        const menu = document.createElement('div');
        menu.className = 'window-type-wheel';
        const locale = getWindowLocale();
        menu.innerHTML = `
            <button type="button" class="window-type-wheel-option is-fixed" data-window-type="${FIXED_WINDOW_TYPE}" title="${windowT(locale, 'layout.fixedTitle')}">
                <span class="window-type-wheel-icon">F</span>
                <span>${windowT(locale, 'layout.fixed')}</span>
            </button>
            <button type="button" class="window-type-wheel-option is-sash" data-window-type="${SASH_WINDOW_TYPE}" title="${windowT(locale, 'layout.sashTitle')}">
                <span class="window-type-wheel-icon window-type-wheel-sash-icon"></span>
                <span>${windowT(locale, 'layout.sash')}</span>
            </button>
            <button type="button" class="window-type-wheel-close" aria-label="${windowT(locale, 'layout.close')}">×</button>
        `;
        stopPointerPropagation(menu);
        menu.querySelectorAll('[data-window-type]').forEach(button => {
            button.addEventListener('click', async () => {
                const type = button.dataset.windowType;
                closeWheel();
                await onSelect(type);
            });
        });
        menu.querySelector('.window-type-wheel-close')?.addEventListener('click', closeWheel);
        root.appendChild(menu);
        wheel = menu;
        wheelAnchorDefinition = anchorDefinition;
        updateWheelPosition();
    }

    function createControl(definition) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `window-layout-node window-layout-node-${definition.kind}`;
        button.dataset.controlId = definition.id;
        const locale = getWindowLocale();
        button.title = definition.kind === 'add'
            ? windowT(locale, 'layout.add', {
                direction: windowT(locale, `layout.direction.${definition.direction}`),
            })
            : definition.kind === 'trans'
                ? windowT(locale, definition.active ? 'layout.transRemove' : 'layout.transAdd')
                : windowT(locale, 'layout.merge');
        button.setAttribute('aria-label', button.title);
        button.textContent = definition.kind === 'add'
            ? '+'
            : (definition.kind === 'trans' ? (definition.active ? 'M' : 'DV') : '↔');
        stopPointerPropagation(button);
        button.addEventListener('click', async () => {
            const state = getWindowLayoutState?.();
            if (definition.kind === 'trans') {
                closeWheel();
                await onSetTransWindows(
                    definition.cellAId,
                    definition.cellBId,
                    !definition.active,
                    definition.ownerCellId || null
                );
                return;
            }
            if (definition.kind === 'add') {
                openTypeWheel(definition, type => onAddWindow(
                    definition.cellId,
                    definition.direction,
                    type,
                    type === SASH_WINDOW_TYPE ? getSelectedHandleSide() : null,
                    { start: definition.start, end: definition.end }
                ));
                return;
            }

            const a = getCell(state, definition.cellAId);
            const b = getCell(state, definition.cellBId);
            if (a?.type && a.type === b?.type) {
                closeWheel();
                await onMergeWindows(
                    definition.cellAId,
                    definition.cellBId,
                    a.type,
                    a.type === SASH_WINDOW_TYPE ? (a.handleSide || b.handleSide || getSelectedHandleSide()) : null
                );
                return;
            }
            openTypeWheel(definition, type => onMergeWindows(
                definition.cellAId,
                definition.cellBId,
                type,
                type === SASH_WINDOW_TYPE ? getSelectedHandleSide() : null
            ));
        });
        root.appendChild(button);
        controls.push({ definition, button });
    }

    function rebuildControls(state) {
        closeWheel();
        controls.forEach(({ button }) => button.remove());
        controls = [];
        const topology = state?.topology;
        if (!topology) return;
        (topology.addCandidates || []).forEach(candidate => createControl({
            kind: 'add',
            ...candidate,
        }));
        (topology.mergeCandidates || []).forEach(candidate => createControl({
            kind: 'merge',
            ...candidate,
        }));
        (topology.transCandidates || []).forEach(candidate => createControl({
            kind: 'trans',
            ...candidate,
        }));
    }

    function getOuterEdgeBounds() {
        if (mainGroup) {
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

            if (foundFrame && !bounds.isEmpty()) {
                return {
                    minX: bounds.min.x,
                    maxX: bounds.max.x,
                    minY: bounds.min.y,
                    maxY: bounds.max.y,
                };
            }
        }

        const geometry = getEditableTopologyGeometry();
        const geometryBounds = {
            minX: Number(geometry?.overallMinX),
            maxX: Number(geometry?.overallMaxX),
            minY: Number(geometry?.overallMinY),
            maxY: Number(geometry?.overallMaxY),
        };
        if (Object.values(geometryBounds).every(Number.isFinite)) {
            return geometryBounds;
        }

        const width = Math.max(0, Number(getWidth?.()) || 0);
        const height = Math.max(0, Number(getHeight?.()) || 0);
        return {
            minX: -width / 2,
            maxX: width / 2,
            minY: -height / 2,
            maxY: height / 2,
        };
    }

    function localOuterEdgeMidpoint(direction, outwardDistance = ADD_WINDOW_OUTER_OFFSET_M) {
        const bounds = getOuterEdgeBounds();
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        const width = Math.max(0, bounds.maxX - bounds.minX);
        const height = Math.max(0, bounds.maxY - bounds.minY);

        if (direction === 'left') {
            return new THREE.Vector3(
                centerX - (width / 2 + outwardDistance),
                centerY,
                FRONT_OFFSET_M
            );
        }
        if (direction === 'right') {
            return new THREE.Vector3(
                centerX + (width / 2 + outwardDistance),
                centerY,
                FRONT_OFFSET_M
            );
        }
        if (direction === 'top') {
            return new THREE.Vector3(
                centerX,
                centerY + (height / 2 + outwardDistance),
                FRONT_OFFSET_M
            );
        }
        return new THREE.Vector3(
            centerX,
            centerY - (height / 2 + outwardDistance),
            FRONT_OFFSET_M
        );
    }

    function localPointForControl(definition) {
        if (definition.kind === 'add') {
            // Always anchor add controls to the midpoint of the complete outer
            // edge. Apply one small fixed offset in the window plane; there is
            // intentionally no button-to-button avoidance/repulsion.
            return localOuterEdgeMidpoint(definition.direction, ADD_WINDOW_OUTER_OFFSET_M);
        }

        if (definition.kind === 'merge' || definition.kind === 'trans') {
            const geometry = getEditableTopologyGeometry();
            const segments = [
                ...(geometry?.dividerSegments || []),
                ...(geometry?.transSegments || []),
            ];
            const segment = segments.find(s =>
                s.coordinate === definition.coordinate
                && s.start === definition.start
                && s.end === definition.end
                && s.orientation === definition.orientation
            );
            if (segment) {
                if (definition.orientation === 'vertical') {
                    return new THREE.Vector3(segment.perpendicularOffset, segment.longitudinalOffset, FRONT_OFFSET_M);
                }
                return new THREE.Vector3(segment.longitudinalOffset, segment.perpendicularOffset, FRONT_OFFSET_M);
            }
        }
        return new THREE.Vector3(0, 0, FRONT_OFFSET_M);
    }

    function screenPointForControl(definition) {
        if (!definition) return null;
        const point = localPointForControl(definition);
        const screen = projectLocalPoint({ point, camera, mainGroup, container });
        if (!screen) return null;

        // A lone merge control stays exactly on the projected divider centre.
        // When the same divider also has a DV/trans control, centre the pair as
        // a group: merge sits 21 px left and DV 21 px right, so the midpoint
        // between their button centres is exactly the mullion/divider centre.
        const hasPairedTrans = controls.some(({ definition: other }) =>
            other?.kind === 'trans'
            && other.coordinate === definition.coordinate
            && other.start === definition.start
            && other.end === definition.end
            && other.orientation === definition.orientation
        );
        const pairOffset = definition.kind === 'trans'
            ? 21
            : (definition.kind === 'merge' && hasPairedTrans ? -21 : 0);
        return {
            x: screen.x + pairOffset,
            y: screen.y + ADD_WINDOW_DOWNWARD_OFFSET_PX,
        };
    }

    function updateWheelPosition() {
        if (!wheel) return;
        const screen = wheelAnchorDefinition ? screenPointForControl(wheelAnchorDefinition) : null;
        if (!screen) {
            wheel.hidden = true;
            return;
        }
        wheel.hidden = false;
        wheel.style.left = `${screen.x}px`;
        wheel.style.top = `${screen.y}px`;
    }

    function update() {
        if (!enabled) {
            root.hidden = true;
            return;
        }
        const state = getWindowLayoutState?.();
        if (!state?.topology) {
            root.hidden = true;
            return;
        }
        root.hidden = false;
        if (renderedSignature !== state.layoutSignature) {
            renderedSignature = state.layoutSignature;
            rebuildControls(state);
        }

        controls.forEach(({ definition, button }) => {
            const screen = screenPointForControl(definition);
            if (!screen) {
                button.hidden = true;
                return;
            }
            button.hidden = false;
            button.style.left = `${screen.x}px`;
            button.style.top = `${screen.y}px`;
        });
        updateWheelPosition();
    }

    function handleLocaleChange() {
        root.setAttribute('aria-label', windowT(getWindowLocale(), 'layout.overlayAria'));
        closeWheel();
        const state = getWindowLayoutState?.();
        if (state?.topology) rebuildControls(state);
    }

    globalThis.window?.addEventListener('window-locale-applied', handleLocaleChange);

    function destroy() {
        globalThis.window?.removeEventListener('window-locale-applied', handleLocaleChange);
        closeWheel();
        root.remove();
        controls = [];
    }

    return { update, destroy, closeWheel };
}
