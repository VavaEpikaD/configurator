import {
    WINDOW_WIDTH_MIN_M,
    WINDOW_WIDTH_MAX_M,
    WINDOW_HEIGHT_MIN_M,
    WINDOW_HEIGHT_MAX_M,
} from './config.js';
import { createComponentSelection } from './component-selection.js';
import { createSceneContext } from './scene.js?v=perf-15';
import { initializeUIControls } from './ui-controls.js?v=4';
import { createWindowBuilder } from './window-builder.js?v=perf-15';
import { createMaterialManager } from './materials.js?v=glass-13';
import { createARController } from './ar-controller.js';
import { createCadReferenceController } from './cad-reference.js';
import { createProfileController } from './profile-controller.js?v=uv-8';
import { createAccessoryController } from './accessory-controller.js';
import { createProfileSelectionController } from './profile-selection-controller.js';
import {
    createWindowLayoutController,
    getWindowLayoutRequest,
} from './window-layout-controller.js?v=2';
import { createLayoutSizingManager } from './layout-sizing-manager.js?v=3';
import { createSegmentedResizeOptimizer } from './segmented-resize-optimizer.js?v=uv-8';
import { requireTenantConfiguratorAccess } from '../shared-ui/src/tenantBootstrap.js?v=1';
import { readShareState } from '../shared-ui/src/shareState.js?v=4';

await requireTenantConfiguratorAccess('window');
// Window CAD initialization is asynchronous and used to race the common shell's
// generic share restore. This runtime owns the initial restore so it can apply
// the payload only after the default profile assembly is fully stable.
window.WINDOW_CONFIGURATOR_SELF_RESTORES_SHARE = true;
window.WINDOW_CONFIGURATOR_INITIAL_SHARE_RESTORED = false;
import { resolveLegacyProfileSelection } from './profile-compatibility.js';
import { createProfileSelectionSignature } from './profile-composition.js';
import { createWindowLayoutOverlay } from './window-layout-overlay.js?v=perf-15';
import {
    DEFAULT_WINDOW_EDGE_EXTENSION_M,
    FIXED_WINDOW_TYPE,
    SASH_WINDOW_TYPE,
    canDeleteWindowFromState,
    getWindowActualSizeInState,
    getWindowUnmergeGuide,
} from './window-layout-state.js';
import { createWindowSummaryController } from './window-summary.js';
import { getWindowLocale, windowT } from './i18n.js';

const pageParams = new URLSearchParams(window.location.search);
const APP_BUILD = document.querySelector('meta[name="app-build"]')?.content || 'unknown';
const isARMode = pageParams.get('ar') === '1';
const captureMode = pageParams.get('capture') === '1';

const requestedCadAssemblyId = pageParams.get('cad_assembly')
    || pageParams.get('cadAssembly');
const requestedProfileSelection = {
    ...resolveLegacyProfileSelection({
        profileSetId: pageParams.get('profile'),
        outerFrameProfileId: pageParams.get('outer_frame')
            || pageParams.get('outer_frame_profile'),
        sashProfileId: pageParams.get('sash_profile'),
    }),
    cadAssemblyId: requestedCadAssemblyId,
};
const requestedProfile = requestedProfileSelection.profileSetId;
const requestedWindowLayoutSelection = getWindowLayoutRequest({
    window_layout: pageParams.get('window_layout') || pageParams.get('layout'),
    window_state: pageParams.get('window_state') || pageParams.get('layout_state'),
    divider_profile: pageParams.get('divider_profile') || pageParams.get('mullion_profile'),
    trans_profile: pageParams.get('trans_profile'),
});
const requestedActiveParts = pageParams.has('parts')
    ? new Set(pageParams.get('parts').split(',').filter(Boolean))
    : null;

const parseBoundedNumber = (value, fallback, min, max) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

let selectedHandleSide = 'right';
let selectedWindowCellId = null;
let layoutSizingManager = null;

if (isARMode) {
    const width = parseBoundedNumber(
        pageParams.get('w'),
        WINDOW_WIDTH_MAX_M,
        WINDOW_WIDTH_MIN_M,
        WINDOW_WIDTH_MAX_M
    );
    const height = parseBoundedNumber(
        pageParams.get('h'),
        1.5,
        WINDOW_HEIGHT_MIN_M,
        WINDOW_HEIGHT_MAX_M
    );
    const mode = pageParams.get('mode') === 'oscilo' ? 'oscilo' : 'batant';
    const maxAngle = mode === 'batant' ? 80 : 15;
    const angle = parseBoundedNumber(pageParams.get('angle'), 0, 0, maxAngle);

    document.getElementById('cadProfile').value = requestedCadAssemblyId || requestedProfile;
    document.getElementById('outerFrameProfile').value = requestedProfileSelection.outerFrameProfileId;
    document.getElementById('sashProfile').value = requestedProfileSelection.sashProfileId;
    document.getElementById('widthA').value = String(width);
    document.getElementById('heightB').value = String(height);
    document.getElementById('mBatant').checked = mode === 'batant';
    document.getElementById('mOscilo').checked = mode === 'oscilo';
    document.getElementById('openAngle').value = String(angle);
    document.getElementById('cExplode').checked = pageParams.get('explode') === '1';
    const glassThickness = parseBoundedNumber(
        pageParams.get('glass_thickness'),
        24,
        16,
        29
    );
    document.getElementById('glassThickness').value = String(glassThickness);
    const handleSide = pageParams.get('handle_side') === 'left' ? 'left' : 'right';
    selectedHandleSide = handleSide;
}


const requestedWidth = Number.parseFloat(pageParams.get('width'));
const requestedHeight = Number.parseFloat(pageParams.get('height'));
const requestedColour = pageParams.get('colour');
const requestedGlassThickness = Number.parseFloat(
    pageParams.get('glass_thickness') || pageParams.get('glassThickness')
);

window.CONFIGURATOR_READY = false;
window.LAST_APPLIED_CONFIGURATION = null;

if (captureMode) {
    document.body.classList.add('capture-mode');
}

const widthInput = document.getElementById('widthA');
const heightInput = document.getElementById('heightB');
const profileInput = document.getElementById('cadProfile');
const outerFrameInput = document.getElementById('outerFrameProfile');
const sashInput = document.getElementById('sashProfile');
const windowLayoutInput = document.getElementById('windowLayout');
const dividerProfileInput = document.getElementById('dividerProfile');
const transProfileInput = document.getElementById('transProfile');
const glassThicknessInput = document.getElementById('glassThickness');
const glassThicknessLabel = document.getElementById('valGlassThickness');
const cadReferenceButton = document.getElementById('cad-reference-button');
const cadReferenceModal = document.getElementById('cad-reference-modal');

const widthControl = document.getElementById('windowWidthControl');
const heightControl = document.getElementById('windowHeightControl');
const widthDecButton = document.getElementById('btnWidthDec');
const widthIncButton = document.getElementById('btnWidthInc');
const heightDecButton = document.getElementById('btnHeightDec');
const heightIncButton = document.getElementById('btnHeightInc');
const widthValueInput = document.getElementById('valWidth');
const heightValueInput = document.getElementById('valHeight');
const selectedWindowPanel = document.getElementById('selected-window-panel');
const selectedWindowNumber = document.getElementById('selectedWindowNumber');
const selectedWindowTypeButton = document.getElementById('selectedWindowType');
const selectedWindowTypeIcon = document.getElementById('selectedWindowTypeIcon');
const selectedWindowTypeLabel = document.getElementById('selectedWindowTypeLabel');
const selectedWindowOpeningActions = document.getElementById('selectedWindowOpeningActions');
const selectedWindowOpenLeft = document.getElementById('selectedWindowOpenLeft');
const selectedWindowOpenRight = document.getElementById('selectedWindowOpenRight');
const selectedWindowUnmerge = document.getElementById('selectedWindowUnmerge');
const selectedWindowDelete = document.getElementById('selectedWindowDelete');
const selectedWindowClose = document.getElementById('selectedWindowClose');
const selectedWindowModifiedBadge = document.getElementById('selectedWindowModifiedBadge');
const baseWidthMax = Number(widthInput?.max) || WINDOW_WIDTH_MAX_M;
const baseHeightMax = Number(heightInput?.max) || WINDOW_HEIGHT_MAX_M;

function setWindowSizeControlsEnabled(enabled) {
    const isEnabled = Boolean(enabled);
    [widthInput, heightInput, widthDecButton, widthIncButton, heightDecButton, heightIncButton, widthValueInput, heightValueInput]
        .filter(Boolean)
        .forEach(control => { control.disabled = !isEnabled; });
    widthControl?.classList.toggle('is-disabled', !isEnabled);
    heightControl?.classList.toggle('is-disabled', !isEnabled);
}

function syncSelectedWindowSizeControls() {
    if (!selectedWindowCellId) {
        setWindowSizeControlsEnabled(false);
        widthInput.max = String(baseWidthMax);
        heightInput.max = String(baseHeightMax);
        return false;
    }
    const stateSize = windowLayoutController?.getWindowState
        ? getWindowActualSizeInState(windowLayoutController.getWindowState(), selectedWindowCellId)
        : null;
    const geometry = windowBuilder?.getEditableTopologyGeometry?.();
    const cell = geometry?.cells?.find(candidate => String(candidate.id) === String(selectedWindowCellId));
    if (!stateSize && !cell) {
        selectedWindowCellId = null;
        setWindowSizeControlsEnabled(false);
        return false;
    }

    // The editable grid state is the sizing source of truth. CAD rendering can
    // include lips/flanges outside the nominal 57/88 mm layout faces and must
    // never feed those raw bounds back into the width/height controls.
    const widthM = Number(stateSize?.widthM ?? cell?.actualWidth);
    const heightM = Number(stateSize?.heightM ?? cell?.actualHeight);
    if (!Number.isFinite(widthM) || !Number.isFinite(heightM)) return false;

    widthInput.max = String(Math.max(baseWidthMax, widthM));
    heightInput.max = String(Math.max(baseHeightMax, heightM));
    widthInput.value = String(widthM);
    heightInput.value = String(heightM);
    if (widthValueInput) {
        widthValueInput.max = String(Math.round(Number(widthInput.max) * 1000));
        widthValueInput.value = String(Math.round(widthM * 1000));
    }
    if (heightValueInput) {
        heightValueInput.max = String(Math.round(Number(heightInput.max) * 1000));
        heightValueInput.value = String(Math.round(heightM * 1000));
    }
    setWindowSizeControlsEnabled(true);
    return true;
}

function syncSelectedWindowModifiedBadge(cellId = selectedWindowCellId) {
    if (!selectedWindowModifiedBadge) return false;
    const modified = Boolean(
        cellId && layoutSizingManager?.isWindowModified?.(cellId)
    );
    selectedWindowModifiedBadge.hidden = !modified;
    return modified;
}

function syncSelectedWindowPanel() {
    if (!selectedWindowPanel) return false;
    const snapshot = windowLayoutController?.getConfigurationSnapshot?.();
    const windows = snapshot?.windowState?.windows || [];
    const index = selectedWindowCellId
        ? windows.findIndex(cell => String(cell.id) === String(selectedWindowCellId))
        : -1;
    const cell = index >= 0 ? windows[index] : null;

    if (!cell) {
        selectedWindowPanel.hidden = true;
        if (selectedWindowModifiedBadge) selectedWindowModifiedBadge.hidden = true;
        return false;
    }

    syncSelectedWindowModifiedBadge(cell.id);
    const locale = getWindowLocale();
    const isSash = cell.type === SASH_WINDOW_TYPE;
    const targetType = isSash ? FIXED_WINDOW_TYPE : SASH_WINDOW_TYPE;
    const isTransOwner = Boolean(
        snapshot?.windowState?.transConnections?.some(connection => connection.ownerCellId === cell.id)
    );
    const handleSide = cell.handleSide || selectedHandleSide || 'right';
    const unmergeGuide = getWindowUnmergeGuide(snapshot.windowState, cell.id);

    selectedWindowPanel.hidden = false;
    if (selectedWindowNumber) selectedWindowNumber.textContent = String(index + 1);

    if (selectedWindowTypeButton) {
        const targetKey = targetType === SASH_WINDOW_TYPE ? 'layout.makeSash' : 'layout.makeFixed';
        selectedWindowTypeButton.title = windowT(locale, targetKey);
        selectedWindowTypeButton.setAttribute('aria-label', windowT(locale, targetKey));
    }
    if (selectedWindowTypeLabel) {
        selectedWindowTypeLabel.textContent = windowT(
            locale,
            targetType === SASH_WINDOW_TYPE ? 'layout.makeSash' : 'layout.makeFixed'
        );
    }
    if (selectedWindowTypeIcon) {
        selectedWindowTypeIcon.classList.toggle('is-sash', targetType === SASH_WINDOW_TYPE);
        selectedWindowTypeIcon.textContent = targetType === FIXED_WINDOW_TYPE ? 'F' : '';
    }

    if (selectedWindowOpeningActions) selectedWindowOpeningActions.hidden = !isSash || isTransOwner;
    selectedWindowOpenLeft?.classList.toggle('is-active', isSash && !isTransOwner && handleSide === 'left');
    selectedWindowOpenRight?.classList.toggle('is-active', isSash && !isTransOwner && handleSide === 'right');
    if (selectedWindowUnmerge) selectedWindowUnmerge.hidden = !unmergeGuide;
    if (selectedWindowDelete) {
        const isLastWindow = windows.length <= 1;
        const wouldSplitStructure = !isLastWindow
            && !canDeleteWindowFromState(snapshot.windowState, cell.id);
        selectedWindowDelete.disabled = isLastWindow || wouldSplitStructure;
        selectedWindowDelete.title = isLastWindow
            ? windowT(locale, 'layout.deleteLastDisabled')
            : wouldSplitStructure
                ? windowT(locale, 'layout.deleteSplitDisabled')
                : windowT(locale, 'layout.deleteWindow');
    }
    return true;
}

function syncSelectedWindowSelectionUI() {
    const hasSelection = syncSelectedWindowSizeControls();
    syncSelectedWindowPanel();
    return hasSelection;
}

function selectWindowCell(cellId) {
    selectedWindowCellId = cellId ? String(cellId) : null;
    windowBuilder?.setSelectedGlassCell?.(selectedWindowCellId);
    syncSelectedWindowSelectionUI();
}

function getOverallWindowDimensions() {
    const managed = layoutSizingManager?.getOverallDimensions?.();
    if (
        Number.isFinite(Number(managed?.widthM))
        && Number.isFinite(Number(managed?.heightM))
    ) {
        return managed;
    }
    const geometry = windowBuilder?.getEditableTopologyGeometry?.();
    const widthM = Number(geometry?.overallWidth);
    const heightM = Number(geometry?.overallHeight);
    return {
        widthM: Number.isFinite(widthM) && widthM > 0 ? widthM : Number(widthInput.value),
        heightM: Number.isFinite(heightM) && heightM > 0 ? heightM : Number(heightInput.value),
    };
}

setWindowSizeControlsEnabled(false);

if (Number.isFinite(requestedWidth)) {
    widthInput.value = String(
        Math.min(WINDOW_WIDTH_MAX_M, Math.max(WINDOW_WIDTH_MIN_M, requestedWidth))
    );
}
if (Number.isFinite(requestedHeight)) {
    heightInput.value = String(
        Math.min(WINDOW_HEIGHT_MAX_M, Math.max(WINDOW_HEIGHT_MIN_M, requestedHeight))
    );
}
if (requestedProfile) {
    profileInput.value = requestedCadAssemblyId || requestedProfile;
}
if (requestedProfileSelection.outerFrameProfileId) {
    outerFrameInput.value = requestedProfileSelection.outerFrameProfileId;
}
if (requestedProfileSelection.sashProfileId) {
    sashInput.value = requestedProfileSelection.sashProfileId;
}
const requestedHandleSide = pageParams.get('handle_side') || pageParams.get('handleSide');
if (requestedHandleSide === 'left' || requestedHandleSide === 'right') {
    selectedHandleSide = requestedHandleSide;
}

if (Number.isFinite(requestedGlassThickness)) {
    glassThicknessInput.value = String(
        Math.min(29, Math.max(16, requestedGlassThickness))
    );
}

function syncModeButtons() {
    const isBatant = document.getElementById('mBatant').checked;
    const btnBatant = document.getElementById('btnModeBatant');
    const btnOscilo = document.getElementById('btnModeOscilo');
    if (btnBatant && btnOscilo) {
        if (isBatant) {
            btnBatant.classList.add('active');
            btnOscilo.classList.remove('active');
        } else {
            btnOscilo.classList.add('active');
            btnBatant.classList.remove('active');
        }
    }

    const openAngleInput = document.getElementById('openAngle');
    if (openAngleInput) {
        const currentVal = parseFloat(openAngleInput.value) || 0;
        if (isBatant) {
            openAngleInput.max = "80";
            openAngleInput.value = String(Math.min(80, Math.max(0, currentVal)));
        } else {
            openAngleInput.max = "15";
            openAngleInput.value = String(Math.min(15, Math.max(0, currentVal)));
        }
    }
}
syncModeButtons();




// SCENE, CAMERA, RENDERER, CONTROLS, GROUND & LIGHTING
const {
    scene,
    camera,
    renderer,
    controls,
    ground,
    gridHelper,
    surfaceSystem,
} = createSceneContext({
    container: document.getElementById('canvas-container'),
    isARMode,
    captureMode,
});

const initialExplodedState =
    (isARMode && pageParams.get('explode') === '1')
    || document.getElementById('cExplode').checked;
let windowBuilder = null;
let profileController = null;
let profileSelectionController = null;
let windowLayoutController = null;
let windowLayoutOverlay = null;
let arController = null;
let windowSummaryController = null;
let segmentedResizeOptimizer = null;
let isWindowSizeBuildInProgress = false;
let deferredFabricationSnapshot = null;
let deferredSummaryTimer = null;
let topologyStableLayoutSourceSignature = null;
let topologyStableLayoutState = null;
const RESIZE_SUMMARY_DEBOUNCE_MS = 180;

function getTopologyStableLayoutSignature(snapshot) {
    const state = snapshot?.windowState;
    if (!state) return snapshot?.layoutId || 'single';

    // Physical resizing changes only gridTracks.sizeM. The topology-facing UI
    // and the detached 10 cm section samples depend on the structure itself,
    // not on those physical dimensions. Keep a separate signature that changes
    // for add/merge/type/trans/profile edits but stays stable while dragging a
    // width/height control.
    return `topology:${JSON.stringify({
        layoutId: snapshot.layoutId,
        dividerProfileId: snapshot.dividerProfileId,
        transProfileId: snapshot.transProfileId,
        windows: state.windows || [],
        mergeGuides: state.mergeGuides || [],
        transConnections: state.transConnections || [],
    })}`;
}

function getTopologyStableLayoutState() {
    const snapshot = windowLayoutController?.getConfigurationSnapshot();
    if (!snapshot) {
        return {
            layoutId: 'single',
            dividerOrientation: null,
            dividerProfileId: null,
        };
    }

    if (
        topologyStableLayoutState
        && topologyStableLayoutSourceSignature === snapshot.layoutSignature
    ) {
        return topologyStableLayoutState;
    }

    topologyStableLayoutSourceSignature = snapshot.layoutSignature;
    topologyStableLayoutState = {
        ...snapshot,
        layoutSignature: getTopologyStableLayoutSignature(snapshot),
    };
    return topologyStableLayoutState;
}

function flushDeferredWindowSummary() {
    if (deferredSummaryTimer !== null) {
        clearTimeout(deferredSummaryTimer);
        deferredSummaryTimer = null;
    }
    if (!deferredFabricationSnapshot || !windowSummaryController) return;
    const snapshot = deferredFabricationSnapshot;
    deferredFabricationSnapshot = null;
    windowSummaryController.update(snapshot);
}

function queueWindowSummaryUpdate(snapshot) {
    if (!snapshot) return;

    if (!isWindowSizeBuildInProgress) {
        deferredFabricationSnapshot = null;
        if (deferredSummaryTimer !== null) {
            clearTimeout(deferredSummaryTimer);
            deferredSummaryTimer = null;
        }
        windowSummaryController?.update(snapshot);
        return;
    }

    deferredFabricationSnapshot = snapshot;
    if (deferredSummaryTimer !== null) clearTimeout(deferredSummaryTimer);
    deferredSummaryTimer = setTimeout(
        flushDeferredWindowSummary,
        RESIZE_SUMMARY_DEBOUNCE_MS
    );
}

const componentSelection = createComponentSelection({
    renderer,
    camera,
    enabled: !isARMode && !captureMode,
    isSelectionEnabled: () =>
        windowBuilder?.getIsExploded() ?? initialExplodedState,
});

// MATERIALS AND ALUMINUM FINISH STATE
const materialManager = createMaterialManager({
    surfaceLibrary: surfaceSystem.materials,
    captureMode,
    pageParams,
    requestedColour,
    getProfilesData: () => profileController?.getProfilesData() ?? [],
    hasCurrentMetadata: () => profileController?.hasCurrentMetadata() ?? false,
    invalidateSectionSamples: () => windowBuilder?.invalidateSectionSamples(),
    renderGroupFilters: () => profileController?.renderGroupFilters(),
    buildWindow: () => windowBuilder?.buildWindow(),
});

const {
    glassMat,
    handleMat,
    resolveDisplayColour,
    makeColourIndicatorBackground,
    setColourIndicatorBackground,
    getMaterialForProfile,
    isDrainageCoverCap,
} = materialManager;

const accessoryController = createAccessoryController({
    pageParams,
    isARMode,
    requestedActiveParts,
    getCurrentProfileSetId: () => profileSelectionController?.getCurrentProfileSetId()
        || profileInput.value,
    getOuterFrameProfileId: () => profileSelectionController?.getOuterFrameProfileId()
        || outerFrameInput.value,
    getSashProfileId: () => profileSelectionController?.getSashProfileId()
        || sashInput.value,
    getProfilesData: () => profileController?.getProfilesData() ?? [],
    getResolvedAccessoryProfileId: groupId => (
        groupId === 'inner-glazing-gasket'
            ? profileController?.getActiveGasketCode()
            : null
    ),
    isProfileGroupVisible: profile =>
        profileController?.isProfileGroupVisible(profile) ?? true,
    buildWindow: () => windowBuilder?.buildWindow(),
    onStateChange: ({ source } = {}) => {
        profileController?.updateColorFilterToggles();
        if (source !== 'cad-assembly' && source !== 'configuration') {
            profileSelectionController?.markCustomCadAssembly();
        }
    },
});

const cadReferenceController = createCadReferenceController({
    captureMode,
    isARMode,
    profileInput,
    getProfileSetId: () => profileSelectionController?.getCurrentProfileSetId()
        || requestedProfile,
    button: cadReferenceButton,
    modal: cadReferenceModal,
    status: document.getElementById('cad-reference-status'),
    content: document.getElementById('cad-reference-content'),
    mainImage: document.getElementById('cad-reference-main-image'),
    thumbnails: document.getElementById('cad-reference-thumbnails'),
    subtitle: document.getElementById('cad-reference-subtitle'),
});

profileController = createProfileController({
    isARMode,
    requestedActiveParts,
    glassThicknessInput,
    renderer,
    scene,
    camera,
    loadingElement: document.getElementById('loading'),
    resolveDisplayColour,
    makeColourIndicatorBackground,
    setColourIndicatorBackground,
    getMaterialForProfile,
    isDrainageCoverCap,
    getWindowBuilder: () => windowBuilder,
    getARController: () => arController,
    refreshCadReferenceAvailability: cadReferenceController.refreshAvailability,
    initializeAccessoryProfiles: accessoryController.initializeProfiles,
    isManagedAccessoryProfile: accessoryController.isManagedAccessoryProfile,
    isAccessoryProfileEnabled: accessoryController.isProfileEnabled,
    setAccessoryProfileEnabled: accessoryController.setAccessoryProfileEnabled,
    setAccessoryProfilesEnabled: accessoryController.setAccessoryProfilesEnabled,
});

profileSelectionController = createProfileSelectionController({
    profileSetInput: profileInput,
    outerFrameInput,
    sashInput,
    initialSelection: requestedProfileSelection,
    loadProfiles: selection => profileController.loadProfileSelection({
        ...selection,
        ...windowLayoutController?.getConfigurationSnapshot(),
    }),
    onCadAssemblyPresetSelected: async ({ accessoryPresetId }) => {
        await windowLayoutController?.setLayout('single', { notify: false });
        layoutSizingManager?.resetModifiedFlags();
        layoutSizingManager?.syncOverallControls();
        accessoryController.setAccessoryPreset(accessoryPresetId, {
            rebuild: false,
            source: 'cad-assembly',
        });
    },
});

windowLayoutController = createWindowLayoutController({
    layoutInput: windowLayoutInput,
    dividerProfileInput,
    transProfileInput,
    initialSelection: requestedWindowLayoutSelection,
    initialWidthM: Number(widthInput.value) || 0.6,
    initialHeightM: Number(heightInput.value) || 0.9,
    onLayoutChange: async (
        layoutSelection,
        {
            reloadDivider = false,
            reloadTrans = false,
            topologyOnly = false,
            sizeOnly = false,
        } = {}
    ) => {
        profileSelectionController?.markCustomCadAssembly();
        if (
            topologyOnly
            && !reloadDivider
            && !reloadTrans
            && profileController.getCurrentMetadata()?.dividerConnectionCatalogReady
            && (
                !(layoutSelection.topology?.transSegments?.length)
                || (
                    profileController.getCurrentMetadata()?.transConnectionReady
                    && profileController.getCurrentMetadata()?.transProfileId === layoutSelection.transProfileId
                )
            )
        ) {
            windowBuilder?.buildWindow();
            if (sizeOnly) syncSelectedWindowSizeControls();
            else syncSelectedWindowSelectionUI();
            layoutSizingManager?.syncOverallControls();
            return;
        }
        await profileController.loadProfileSelection({
            ...profileSelectionController.getConfigurationSnapshot(),
            ...layoutSelection,
        });
        if (sizeOnly) syncSelectedWindowSizeControls();
        else syncSelectedWindowSelectionUI();
        layoutSizingManager?.syncOverallControls();
    },
});

layoutSizingManager = createLayoutSizingManager({
    controller: windowLayoutController,
    edgeExtensionM: DEFAULT_WINDOW_EDGE_EXTENSION_M,
    widthMaxM: WINDOW_WIDTH_MAX_M,
    heightMaxM: WINDOW_HEIGHT_MAX_M,
    onResizeStateChange: active => {
        isWindowSizeBuildInProgress = Boolean(active);
    },
    onAfterChange: () => {
        syncSelectedWindowSizeControls();
        syncSelectedWindowModifiedBadge();
    },
    onPreviewStateChange: state => {
        segmentedResizeOptimizer?.previewState(state);
    },
});

function initializeSelectedWindowPanel() {
    selectedWindowClose?.addEventListener('click', () => selectWindowCell(null));

    selectedWindowTypeButton?.addEventListener('click', async () => {
        if (!selectedWindowCellId) return;
        const snapshot = windowLayoutController.getConfigurationSnapshot();
        const cell = snapshot.windowState?.windows?.find(candidate => String(candidate.id) === String(selectedWindowCellId));
        if (!cell) return;
        const targetType = cell.type === SASH_WINDOW_TYPE ? FIXED_WINDOW_TYPE : SASH_WINDOW_TYPE;
        await windowLayoutController.setWindowType(
            cell.id,
            targetType,
            targetType === SASH_WINDOW_TYPE ? { handleSide: selectedHandleSide } : {}
        );
        syncSelectedWindowSelectionUI();
    });

    selectedWindowOpenLeft?.addEventListener('click', async () => {
        if (!selectedWindowCellId) return;
        await windowLayoutController.setWindowType(selectedWindowCellId, SASH_WINDOW_TYPE, { handleSide: 'left' });
        syncSelectedWindowSelectionUI();
    });

    selectedWindowOpenRight?.addEventListener('click', async () => {
        if (!selectedWindowCellId) return;
        await windowLayoutController.setWindowType(selectedWindowCellId, SASH_WINDOW_TYPE, { handleSide: 'right' });
        syncSelectedWindowSelectionUI();
    });

    selectedWindowUnmerge?.addEventListener('click', async () => {
        if (!selectedWindowCellId) return;
        const selectedId = selectedWindowCellId;
        await windowLayoutController.unmergeWindow(selectedId);
        layoutSizingManager?.resetModifiedFlags();
        layoutSizingManager?.syncOverallControls();
        selectWindowCell(null);
    });

    selectedWindowDelete?.addEventListener('click', async () => {
        if (!selectedWindowCellId || selectedWindowDelete.disabled) return;
        const selectedId = selectedWindowCellId;
        await layoutSizingManager.deleteWindow(selectedId);
        selectWindowCell(null);
    });

    globalThis.window?.addEventListener('window-locale-applied', syncSelectedWindowPanel);
    syncSelectedWindowPanel();
}

initializeSelectedWindowPanel();

const {
    isGlazingBeadProfile,
    getProfileGroup,
    isProfileGroupVisible,
    getProfileShape,
    getProfileCadXShiftMm,
    getProfileCadYShiftMm,
    getProfileCadPointMm,
    getActiveGlazingBeadCode,
    getActiveGasketCode,
    getProfileComponentNumber,
    getEffectiveProfileBbox,
    getGlazingBeadArmShiftMm,
    updateGlazingBeadToggleLabels,
    updateGasketToggleLabels,
    updateComponentPictures,
} = profileController;

windowBuilder = createWindowBuilder({
    geometryLibrary: surfaceSystem.geometry,
    scene,
    camera,
    renderer,
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
    getProfileCadYShiftMm,
    getProfileCadPointMm,
    getActiveGlazingBeadCode,
    getActiveGasketCode,
    getProfileComponentNumber,
    getEffectiveProfileBbox,
    updateComponentPictures: () => {
        if (!isWindowSizeBuildInProgress) updateComponentPictures();
    },
    getFinishState: materialManager.getFinishState,
    getSelectedHandleSide: () => selectedHandleSide,
    onGlassClick: ({ cellId }) => {
        selectWindowCell(cellId);
    },
    onFabricationSnapshot: queueWindowSummaryUpdate,
    isProfileEnabled: accessoryController.isProfileEnabled,
    isProfileGroupVisible,
    canPlaceProfileOnSide: accessoryController.canPlaceProfileOnSide,
    getWindowLayoutState: getTopologyStableLayoutState,
});

const {
    placementRoot,
    mainGroup,
    sectionGroup,
    buildWindow,
    applyCurrentPoseInstantly,
} = windowBuilder;

segmentedResizeOptimizer = createSegmentedResizeOptimizer({
    mainGroup,
    getWindowState: () => windowLayoutController?.getWindowState?.(),
    getIsExploded: () => windowBuilder?.getIsExploded?.() || false,
    edgeExtensionM: DEFAULT_WINDOW_EDGE_EXTENSION_M,
    captureSurfaceUVDeformation: (geometry, basePositions) => surfaceSystem.geometry.captureSurfaceUVDeformation(geometry, basePositions),
});

windowSummaryController = createWindowSummaryController({
    getProfileSelection: () => profileSelectionController?.getConfigurationSnapshot() || {},
    getLayoutSelection: () => windowLayoutController?.getConfigurationSnapshot() || {},
    getActiveGlazingBeadCode,
    getAccessorySelection: () => accessoryController?.getConfigurationSnapshot() || {},
});
flushDeferredWindowSummary();

windowLayoutOverlay = createWindowLayoutOverlay({
    container: document.getElementById('canvas-container'),
    camera,
    mainGroup,
    getWindowLayoutState: getTopologyStableLayoutState,
    getWidth: () => layoutSizingManager?.getOverallDimensions?.().widthM || Number(widthInput?.value) || 1,
    getHeight: () => layoutSizingManager?.getOverallDimensions?.().heightM || Number(heightInput?.value) || 1,
    getSelectedHandleSide: () => selectedHandleSide,
    onAddWindow: async (cellId, direction, type, handleSide, edge = {}) => {
        return layoutSizingManager.addWindow(cellId, direction, type, {
            handleSide,
            start: edge.start,
            end: edge.end,
        });
    },
    onMergeWindows: async (cellAId, cellBId, type, handleSide) => {
        const result = await windowLayoutController.mergeWindows(cellAId, cellBId, type, { handleSide });
        layoutSizingManager?.resetModifiedFlags();
        layoutSizingManager?.syncOverallControls();
        selectWindowCell(null);
        return result;
    },
    onSetTransWindows: (cellAId, cellBId, enabled, ownerCellId) =>
        windowLayoutController.setTransBetweenWindows(cellAId, cellBId, { enabled, ownerCellId }),
    enabled: !isARMode && !captureMode,
    getEditableTopologyGeometry: () => windowBuilder?.getEditableTopologyGeometry?.(),
});

arController = createARController({
    appBuild: APP_BUILD,
    isARMode,
    renderer,
    camera,
    placementRoot,
    mainGroup,
    applyCurrentPoseInstantly,
    materialManager,
    getProfilesReady: profileController.getProfilesReady,
    getProfilesData: profileController.getProfilesData,
    getSelectedHandleSide: () => selectedHandleSide,
    appendAccessoryUrlParams: accessoryController.appendUrlParams,
    appendProfileSelectionUrlParams: profileSelectionController.appendUrlParams,
    appendWindowLayoutUrlParams: windowLayoutController.appendUrlParams,
});

window.applyConfiguration = async function applyConfiguration(configuration) {
    selectWindowCell(null);
    window.CONFIGURATOR_READY = false;
    window.LAST_APPLIED_CONFIGURATION = null;

    if (typeof configuration.widthM === 'number' && Number.isFinite(configuration.widthM)) {
        widthInput.value = String(
            Math.min(WINDOW_WIDTH_MAX_M, Math.max(WINDOW_WIDTH_MIN_M, configuration.widthM))
        );
    }
    if (typeof configuration.heightM === 'number' && Number.isFinite(configuration.heightM)) {
        heightInput.value = String(
            Math.min(WINDOW_HEIGHT_MAX_M, Math.max(WINDOW_HEIGHT_MIN_M, configuration.heightM))
        );
    }
    if (
        typeof configuration.glassThicknessMm === 'number'
        && Number.isFinite(configuration.glassThicknessMm)
    ) {
        glassThicknessInput.value = String(
            Math.min(29, Math.max(16, configuration.glassThicknessMm))
        );
    }
    if (configuration.openingMode === 'batant' || configuration.openingMode === 'oscilo') {
        document.getElementById('mBatant').checked = configuration.openingMode === 'batant';
        document.getElementById('mOscilo').checked = configuration.openingMode === 'oscilo';
        syncModeButtons();
    }
    if (Number.isFinite(Number(configuration.openAngle))) {
        const angleInput = document.getElementById('openAngle');
        const max = document.getElementById('mBatant').checked ? 80 : 15;
        angleInput.value = String(Math.min(max, Math.max(0, Number(configuration.openAngle))));
    }
    if (configuration.handleSide === 'left' || configuration.handleSide === 'right') {
        selectedHandleSide = configuration.handleSide;
    }
    if (typeof configuration.exploded === 'boolean') {
        document.getElementById('cExplode').checked = configuration.exploded;
    }
    if (typeof configuration.showHouse === 'boolean') {
        document.getElementById('cShowHouse').checked = configuration.showHouse;
    }
    if (configuration.frameSides && typeof configuration.frameSides === 'object') {
        ['top', 'bottom', 'left', 'right'].forEach((side) => {
            if (typeof configuration.frameSides[side] === 'boolean') {
                document.getElementById(`side_${side}`).checked = configuration.frameSides[side];
            }
        });
    }
    if (typeof configuration.sectionView === 'boolean') {
        document.getElementById('toggleSectionViewBtn')?.classList.toggle('active', configuration.sectionView);
        sectionGroup.visible = configuration.sectionView;
    }

    materialManager.applyConfiguration(configuration);

    // CAD preset selection intentionally resets the interactive editor to one
    // sash. Apply it first, then restore the requested topology so a shared
    // two-sash/multi-cell layout cannot be overwritten during state loading.
    const selectedProfiles = await profileSelectionController.applyConfiguration(
        configuration,
        { reload: false }
    );
    const selectedLayout = await windowLayoutController.applyConfiguration(
        configuration,
        { notify: false }
    );
    layoutSizingManager?.resetModifiedFlags();
    layoutSizingManager?.syncOverallControls();
    const combinedProfileSelection = {
        ...selectedProfiles,
        ...selectedLayout,
    };
    combinedProfileSelection.selectionSignature = createProfileSelectionSignature(
        combinedProfileSelection
    );
    accessoryController.applyConfiguration(configuration, {
        rebuild: false,
        source: 'configuration',
    });
    const mustReloadProfile = !profileController.hasCurrentMetadata()
        || profileController.getCurrentSelectionSignature()
            !== combinedProfileSelection.selectionSignature;

    if (mustReloadProfile) {
        await profileController.loadProfileSelection(combinedProfileSelection);
    } else {
        await profileController.refreshProfileMaterials();
    }

    const selectedProfileSet = profileSelectionController.getConfigurationSnapshot();
    const expectedAccessoryPresetId = String(selectedProfileSet.profileVariantCode || '')
        .trim()
        .toLowerCase();
    if (
        selectedProfileSet.cadAssemblyId !== 'custom'
        && (
            !accessoryController.matchesPreset(expectedAccessoryPresetId)
            || selectedLayout.layoutId !== 'single'
        )
    ) {
        profileSelectionController.markCustomCadAssembly();
    }

    const overallDimensions = getOverallWindowDimensions();
    const applied = {
        requestToken: String(configuration.requestToken || ''),
        widthM: overallDimensions.widthM,
        heightM: overallDimensions.heightM,
        ...materialManager.getConfigurationSnapshot(),
        ...accessoryController.getConfigurationSnapshot(),
        ...profileSelectionController.getConfigurationSnapshot(),
        ...windowLayoutController.getConfigurationSnapshot(),
        glassThicknessMm: Number(glassThicknessInput.value),
        glazingBeadCode: getActiveGlazingBeadCode(),
        glazingGasket224378ShiftMm: getGlazingBeadArmShiftMm('top'),
        glassAnchorGasket: '224063',
        movingGlassSideGasket: '224378',
        openingMode: document.getElementById('mBatant').checked ? 'batant' : 'oscilo',
        openAngle: Number(document.getElementById('openAngle').value) || 0,
        handleSide: selectedHandleSide,
        exploded: Boolean(document.getElementById('cExplode').checked),
        showHouse: Boolean(document.getElementById('cShowHouse').checked),
        frameSides: {
            top: Boolean(document.getElementById('side_top').checked),
            bottom: Boolean(document.getElementById('side_bottom').checked),
            left: Boolean(document.getElementById('side_left').checked),
            right: Boolean(document.getElementById('side_right').checked),
        },
        sectionView: Boolean(document.getElementById('toggleSectionViewBtn')?.classList.contains('active')),
    };

    windowBuilder.setExploded(Boolean(applied.exploded));
    window.LAST_APPLIED_CONFIGURATION = applied;
    window.CONFIGURATOR_READY = true;
    return applied;
};

let initialWindowConfiguration = null;

function cloneWindowConfiguration(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    if (typeof structuredClone === 'function') return structuredClone(snapshot);
    return JSON.parse(JSON.stringify(snapshot));
}

async function resetWindowConfiguration() {
    const snapshot = cloneWindowConfiguration(initialWindowConfiguration);
    if (!snapshot) return false;
    await window.applyConfiguration(snapshot);
    return true;
}

function captureWindowConfiguration() {
    const overallDimensions = getOverallWindowDimensions();
    return {
        widthM: overallDimensions.widthM,
        heightM: overallDimensions.heightM,
        ...materialManager.getConfigurationSnapshot(),
        ...accessoryController.getConfigurationSnapshot(),
        ...profileSelectionController.getConfigurationSnapshot(),
        ...windowLayoutController.getConfigurationSnapshot(),
        glassThicknessMm: Number(glassThicknessInput.value),
        glazingBeadCode: getActiveGlazingBeadCode(),
        glazingGasket224378ShiftMm: getGlazingBeadArmShiftMm('top'),
        glassAnchorGasket: '224063',
        movingGlassSideGasket: '224378',
        openingMode: document.getElementById('mBatant').checked ? 'batant' : 'oscilo',
        openAngle: Number(document.getElementById('openAngle').value) || 0,
        handleSide: selectedHandleSide,
        exploded: Boolean(document.getElementById('cExplode').checked),
        showHouse: Boolean(document.getElementById('cShowHouse').checked),
        frameSides: {
            top: Boolean(document.getElementById('side_top').checked),
            bottom: Boolean(document.getElementById('side_bottom').checked),
            left: Boolean(document.getElementById('side_left').checked),
            right: Boolean(document.getElementById('side_right').checked),
        },
        sectionView: Boolean(document.getElementById('toggleSectionViewBtn')?.classList.contains('active')),
    };
}

window.WINDOW_CONFIGURATOR_API = {
    captureState: captureWindowConfiguration,
    restoreState: (snapshot) => window.applyConfiguration(snapshot),
    resetConfiguration: resetWindowConfiguration,
    getEstimatedTotalEur: () => windowSummaryController?.getResult()?.totals?.total ?? null,
};

// ANIMATION & LOOP
function renderFrame(_time, xrFrame) {
    if (!isARMode && document.hidden) return;
    windowBuilder.updatePoseAnimation();

    if (isARMode) {
        arController.updateARPlacement(xrFrame);
    } else if (!captureMode) {
        controls.update();
    }
    const rendered = surfaceSystem.render(camera, { onDemand: !isARMode && !captureMode, now: _time });
    if (rendered && !isARMode && !captureMode) windowLayoutOverlay?.update();
}


initializeUIControls({
    widthInput,
    heightInput,
    glassThicknessInput,
    glassThicknessLabel,
    cadReferenceButton,
    cadReferenceModal,
    sectionGroup,
    camera,
    renderer,
    componentSelection,
    buildWindow,
    onWindowSizePreview: ({ widthM, heightM }) => {
        if (!selectedWindowCellId) return;
        layoutSizingManager?.previewWindow(selectedWindowCellId, { widthM, heightM });
    },
    onWindowSizeChange: async ({ widthM, heightM }) => {
        if (!selectedWindowCellId) return;

        const currentSize = getWindowActualSizeInState(
            windowLayoutController.getWindowState(),
            selectedWindowCellId
        );
        const nextSize = {};
        if (
            Number.isFinite(widthM)
            && (!currentSize || Math.abs(Number(currentSize.widthM) - widthM) > 1e-7)
        ) {
            nextSize.widthM = widthM;
        }
        if (
            Number.isFinite(heightM)
            && (!currentSize || Math.abs(Number(currentSize.heightM) - heightM) > 1e-7)
        ) {
            nextSize.heightM = heightM;
        }
        if (!Object.keys(nextSize).length) return;

        try {
            await layoutSizingManager.resizeWindow(selectedWindowCellId, nextSize);
        } catch (error) {
            console.error('Unable to resize selected window:', error);
        }
    },
    syncModeButtons,
    setExploded: (value) => {
        windowBuilder.setExploded(value);
    },
    setSelectedHandleSide: (value) => {
        selectedHandleSide = value;
    },
    getActiveGlazingBeadCode,
    getActiveGasketCode,
    updateGlazingBeadToggleLabels,
    updateGasketToggleLabels,
    updateComponentPictures,
    openCadReferenceModal: cadReferenceController.openModal,
    closeCadReferenceModal: cadReferenceController.closeModal,
    setSelectedARPlatform: arController.setSelectedARPlatform,
    openQRModal: arController.openQRModal,
    closeQRModal: arController.closeQRModal,
    downloadLatestARAsset: arController.downloadLatestARAsset,
    checkLatestStaticModel: arController.checkLatestStaticModel,
    startAR: arController.startAR,
});

profileSelectionController.initializeControls();
windowLayoutController.initializeControls();
materialManager.initializeControls();
accessoryController.initializeControls({
    presetInput: document.getElementById('accessoryPreset'),
    presetDescription: document.getElementById('accessoryPresetDescription'),
    container: document.getElementById('accessoryOptions'),
});

// Keep the model-specific default snapshot next to the configurator API. The
// common shell can now use one global New Configuration lifecycle for every
// configurator and only ask this module to restore its own default state.
initialWindowConfiguration = cloneWindowConfiguration(captureWindowConfiguration());
glassThicknessInput?.addEventListener('input', () => {
    accessoryController.syncControls('inner-glazing-gasket');
});

// Load the selected profile. In QR AR mode the selection comes from URL parameters.
await profileController.loadProfileSelection({
    ...profileSelectionController.getConfigurationSnapshot(),
    ...windowLayoutController.getConfigurationSnapshot(),
});
const selection = profileSelectionController.getConfigurationSnapshot();
const expectedAccessoryPresetId = String(selection.profileVariantCode || '')
    .trim()
    .toLowerCase();
if (
    selection.cadAssemblyId !== 'custom'
    && (
        !accessoryController.matchesPreset(expectedAccessoryPresetId)
        || windowLayoutController.getLayoutId() !== 'single'
    )
) {
    profileSelectionController.markCustomCadAssembly();
}

try {
    const initialSharedState = await readShareState({ productType: 'window' });
    if (initialSharedState && typeof initialSharedState === 'object') {
        await window.applyConfiguration(initialSharedState);
    }
} catch (error) {
    console.error('Unable to apply the initial shared Window configuration:', error);
} finally {
    window.WINDOW_CONFIGURATOR_INITIAL_SHARE_RESTORED = true;
}
renderer.setAnimationLoop(renderFrame);
