import { createWindowBuilder as createBaseWindowBuilder } from './window-builder.js?window-dimensions-base=1';

const DIMENSION_LINE_COLOUR = 0x38bdf8;

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
    // is reapplied after every rebuild, including rebuilds initiated internally
    // by the CAD/profile controller.
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
