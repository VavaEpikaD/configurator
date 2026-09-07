import {
    getBaseAluminiumProfiles,
    isProfileGeometryAvailable,
} from './profile-catalog.js';
import {
    DEFAULT_TRANS_PROFILE_ID,
    DEFAULT_NEW_WINDOW_WIDTH_M,
    DEFAULT_NEW_WINDOW_HEIGHT_M,
    DEFAULT_WINDOW_EDGE_EXTENSION_M,
    FIXED_WINDOW_TYPE,
    SASH_WINDOW_TYPE,
    addWindowSideToState,
    classifyWindowState,
    createWindowStateFromLayoutDefinition,
    deriveWindowTopology,
    deleteWindowFromState,
    mergeWindowsInState,
    unmergeWindowInState,
    normalizeWindowState,
    parseWindowState,
    serializeWindowState,
    setTransBetweenWindowsInState,
    setWindowStateDividerProfile,
    setWindowStateTransProfile,
    setWindowTypeInState,
    setWindowSizeInState,
    setOverallWindowSizeInState,
} from './window-layout-state.js';
import { getWindowLocale, localizeLayoutLabel } from './i18n.js';

export const DEFAULT_WINDOW_LAYOUT_ID = 'single';
export const DEFAULT_DIVIDER_PROFILE_ID = '575800';
export const DEFAULT_TRANS_PROFILE_ID_UI = DEFAULT_TRANS_PROFILE_ID;

const CELL_TYPES = Object.freeze({
    fixed: FIXED_WINDOW_TYPE,
    left: SASH_WINDOW_TYPE,
    right: SASH_WINDOW_TYPE,
});
const CELL_HANDLES = Object.freeze({ fixed: null, left: 'left', right: 'right' });

function freezeLayout(id, definition) {
    return Object.freeze({ id, ...definition });
}

function buildLayouts() {
    const layouts = {
        single: freezeLayout('single', {
            label: 'Single opening',
            dividerOrientation: null,
            leftCell: null,
            rightCell: SASH_WINDOW_TYPE,
            cells: Object.freeze([SASH_WINDOW_TYPE]),
            cellHandleSides: Object.freeze(['right']),
        }),
        'vertical-divider': freezeLayout('vertical-divider', {
            label: 'Vertical mullion',
            dividerOrientation: 'vertical',
            leftCell: FIXED_WINDOW_TYPE,
            rightCell: SASH_WINDOW_TYPE,
            cells: Object.freeze([FIXED_WINDOW_TYPE, SASH_WINDOW_TYPE]),
        }),
        'vertical-fixed-fixed': freezeLayout('vertical-fixed-fixed', {
            label: 'Vertical mullion — fixed / fixed',
            dividerOrientation: 'vertical',
            leftCell: FIXED_WINDOW_TYPE,
            rightCell: FIXED_WINDOW_TYPE,
            cells: Object.freeze([FIXED_WINDOW_TYPE, FIXED_WINDOW_TYPE]),
        }),
        'vertical-fixed-fixed-fixed': freezeLayout('vertical-fixed-fixed-fixed', {
            label: 'Three fixed columns',
            dividerOrientation: 'vertical',
            leftCell: FIXED_WINDOW_TYPE,
            rightCell: FIXED_WINDOW_TYPE,
            cells: Object.freeze([FIXED_WINDOW_TYPE, FIXED_WINDOW_TYPE, FIXED_WINDOW_TYPE]),
        }),
        'vertical-sash-sash': freezeLayout('vertical-sash-sash', {
            label: 'Vertical mullion — sash / sash',
            dividerOrientation: 'vertical',
            leftCell: SASH_WINDOW_TYPE,
            rightCell: SASH_WINDOW_TYPE,
            cells: Object.freeze([SASH_WINDOW_TYPE, SASH_WINDOW_TYPE]),
        }),
        'horizontal-divider': freezeLayout('horizontal-divider', {
            label: 'Horizontal transom',
            dividerOrientation: 'horizontal',
            leftCell: FIXED_WINDOW_TYPE,
            rightCell: SASH_WINDOW_TYPE,
            cells: Object.freeze([FIXED_WINDOW_TYPE, SASH_WINDOW_TYPE]),
        }),
        'horizontal-fixed-fixed': freezeLayout('horizontal-fixed-fixed', {
            label: 'Horizontal transom — fixed / fixed',
            dividerOrientation: 'horizontal',
            leftCell: FIXED_WINDOW_TYPE,
            rightCell: FIXED_WINDOW_TYPE,
            cells: Object.freeze([FIXED_WINDOW_TYPE, FIXED_WINDOW_TYPE]),
        }),
        'horizontal-fixed-fixed-fixed': freezeLayout('horizontal-fixed-fixed-fixed', {
            label: 'Three fixed rows',
            dividerOrientation: 'horizontal',
            leftCell: FIXED_WINDOW_TYPE,
            rightCell: FIXED_WINDOW_TYPE,
            cells: Object.freeze([FIXED_WINDOW_TYPE, FIXED_WINDOW_TYPE, FIXED_WINDOW_TYPE]),
        }),
        'top-fixed-bottom-sash-sash': freezeLayout('top-fixed-bottom-sash-sash', {
            label: 'Top fixed — two sashes below',
            layoutKind: 't-grid',
            dividerOrientation: 'grid',
            primaryDividerOrientation: 'horizontal',
            leftCell: FIXED_WINDOW_TYPE,
            rightCell: SASH_WINDOW_TYPE,
            cells: Object.freeze([FIXED_WINDOW_TYPE, SASH_WINDOW_TYPE, SASH_WINDOW_TYPE]),
            cellHandleSides: Object.freeze([null, 'right', 'left']),
            topRowFraction: 0.30,
        }),
    };

    ['fixed', 'left', 'right'].forEach(option => {
        layouts[`single-${option}`] = freezeLayout(`single-${option}`, {
            label: `1 window — ${option}`,
            dividerOrientation: null,
            leftCell: null,
            rightCell: CELL_TYPES[option],
            cells: Object.freeze([CELL_TYPES[option]]),
            cellHandleSides: Object.freeze([CELL_HANDLES[option]]),
        });
    });

    ['fixed', 'left', 'right'].forEach(a => {
        ['fixed', 'left', 'right'].forEach(b => {
            layouts[`vertical-2-${a}-${b}`] = freezeLayout(`vertical-2-${a}-${b}`, {
                label: `2 window — ${a} / ${b}`,
                dividerOrientation: 'vertical',
                leftCell: CELL_TYPES[a],
                rightCell: CELL_TYPES[b],
                cells: Object.freeze([CELL_TYPES[a], CELL_TYPES[b]]),
                cellHandleSides: Object.freeze([CELL_HANDLES[a], CELL_HANDLES[b]]),
            });
            layouts[`horizontal-2-${a}-${b}`] = freezeLayout(`horizontal-2-${a}-${b}`, {
                label: `2 rows — ${a} / ${b}`,
                dividerOrientation: 'horizontal',
                leftCell: CELL_TYPES[a],
                rightCell: CELL_TYPES[b],
                cells: Object.freeze([CELL_TYPES[a], CELL_TYPES[b]]),
                cellHandleSides: Object.freeze([CELL_HANDLES[a], CELL_HANDLES[b]]),
            });
            ['fixed', 'left', 'right'].forEach(c => {
                layouts[`vertical-3-${a}-${b}-${c}`] = freezeLayout(`vertical-3-${a}-${b}-${c}`, {
                    label: `3 window — ${a} / ${b} / ${c}`,
                    dividerOrientation: 'vertical',
                    leftCell: CELL_TYPES[a],
                    rightCell: CELL_TYPES[c],
                    cells: Object.freeze([CELL_TYPES[a], CELL_TYPES[b], CELL_TYPES[c]]),
                    cellHandleSides: Object.freeze([CELL_HANDLES[a], CELL_HANDLES[b], CELL_HANDLES[c]]),
                });
                layouts[`horizontal-3-${a}-${b}-${c}`] = freezeLayout(`horizontal-3-${a}-${b}-${c}`, {
                    label: `3 rows — ${a} / ${b} / ${c}`,
                    dividerOrientation: 'horizontal',
                    leftCell: CELL_TYPES[a],
                    rightCell: CELL_TYPES[c],
                    cells: Object.freeze([CELL_TYPES[a], CELL_TYPES[b], CELL_TYPES[c]]),
                    cellHandleSides: Object.freeze([CELL_HANDLES[a], CELL_HANDLES[b], CELL_HANDLES[c]]),
                });
            });
        });
    });

    // Legacy menu URLs kept for backward compatibility.
    ['fixed', 'left', 'right'].forEach(option => {
        layouts[`horizontal-2-fixed-top-${option}`] = freezeLayout(`horizontal-2-fixed-top-${option}`, {
            label: `Fixed top — bottom ${option}`,
            dividerOrientation: 'horizontal',
            leftCell: CELL_TYPES[option],
            rightCell: FIXED_WINDOW_TYPE,
            cells: Object.freeze([CELL_TYPES[option], FIXED_WINDOW_TYPE]),
            cellHandleSides: Object.freeze([CELL_HANDLES[option], null]),
        });
        layouts[`horizontal-2-fixed-bottom-${option}`] = freezeLayout(`horizontal-2-fixed-bottom-${option}`, {
            label: `Fixed bottom — top ${option}`,
            dividerOrientation: 'horizontal',
            leftCell: FIXED_WINDOW_TYPE,
            rightCell: CELL_TYPES[option],
            cells: Object.freeze([FIXED_WINDOW_TYPE, CELL_TYPES[option]]),
            cellHandleSides: Object.freeze([null, CELL_HANDLES[option]]),
        });
        ['fixed', 'left', 'right'].forEach(other => {
            layouts[`t-layout-${option}-${other}`] = freezeLayout(`t-layout-${option}-${other}`, {
                label: `T-layout — ${option} / ${other} bottom`,
                layoutKind: 't-grid',
                dividerOrientation: 'grid',
                primaryDividerOrientation: 'horizontal',
                leftCell: FIXED_WINDOW_TYPE,
                rightCell: CELL_TYPES[other],
                cells: Object.freeze([FIXED_WINDOW_TYPE, CELL_TYPES[option], CELL_TYPES[other]]),
                cellHandleSides: Object.freeze([null, CELL_HANDLES[option], CELL_HANDLES[other]]),
                topRowFraction: 0.30,
            });
        });
    });

    return Object.freeze(layouts);
}

export const WINDOW_LAYOUTS = buildLayouts();

function firstDefined(...values) {
    return values.find(value => value !== undefined && value !== null && value !== '');
}

export function normalizeWindowLayoutId(value) {
    return WINDOW_LAYOUTS[value] ? value : DEFAULT_WINDOW_LAYOUT_ID;
}

export function getWindowLayoutDefinition(layoutId) {
    return WINDOW_LAYOUTS[normalizeWindowLayoutId(layoutId)];
}

export function getWindowLayoutRequest(configuration = {}) {
    const dividerProfileId = String(firstDefined(
        configuration.dividerProfileId,
        configuration.divider_profile,
        configuration.mullionProfileId,
        configuration.mullion_profile
    ) || DEFAULT_DIVIDER_PROFILE_ID);
    const transProfileId = String(firstDefined(
        configuration.transProfileId,
        configuration.trans_profile
    ) || DEFAULT_TRANS_PROFILE_ID);
    const defaultWidthM = Number.isFinite(Number(configuration.widthM))
        ? Number(configuration.widthM)
        : DEFAULT_NEW_WINDOW_WIDTH_M;
    const defaultHeightM = Number.isFinite(Number(configuration.heightM))
        ? Number(configuration.heightM)
        : DEFAULT_NEW_WINDOW_HEIGHT_M;
    const windowState = parseWindowState(firstDefined(
        configuration.windowState,
        configuration.window_state,
        configuration.layoutState,
        configuration.layout_state
    ), {
        dividerProfileId,
        transProfileId,
        defaultWidthM,
        defaultHeightM,
        edgeExtensionM: DEFAULT_WINDOW_EDGE_EXTENSION_M,
    });
    return {
        layoutId: normalizeWindowLayoutId(firstDefined(
            configuration.layoutId,
            configuration.windowLayout,
            configuration.window_layout,
            configuration.layout
        )),
        dividerProfileId,
        transProfileId,
        windowState,
    };
}

export function createWindowLayoutSignature(configuration = {}) {
    const request = getWindowLayoutRequest(configuration);
    if (request.windowState) {
        return `state:${serializeWindowState(request.windowState)}|${request.dividerProfileId}|${request.transProfileId}`;
    }
    return `${request.layoutId}|${request.dividerProfileId}|${request.transProfileId}`;
}

function replaceSelectOptions(select, options, selectedValue) {
    if (!select || typeof document === 'undefined') return;

    const optionsUnchanged = select.options.length === options.length
        && options.every((optionDefinition, index) => {
            const existing = select.options[index];
            return existing?.value === String(optionDefinition.value)
                && existing?.textContent === String(optionDefinition.label);
        });

    if (!optionsUnchanged) {
        select.innerHTML = '';
        options.forEach(optionDefinition => {
            const option = document.createElement('option');
            option.value = optionDefinition.value;
            option.textContent = optionDefinition.label;
            select.appendChild(option);
        });
    }

    select.value = options.some(option => option.value === selectedValue)
        ? selectedValue
        : (options[0]?.value || '');
}

function compatibilitySnapshot(windowState, layoutId, dividerProfileId, transProfileId) {
    const classification = classifyWindowState(windowState);
    const topology = deriveWindowTopology(windowState);
    let orderedCells = [...windowState.windows];
    let dividerOrientation = null;
    let primaryDividerOrientation = null;
    let layoutKind = classification.kind === 't-grid' ? 't-grid' : 'linear';
    let topRowFraction = null;

    if (classification.kind === 'linear') {
        orderedCells = [...classification.cells];
        dividerOrientation = classification.orientation;
        primaryDividerOrientation = classification.orientation;
    } else if (classification.kind === 't-grid') {
        dividerOrientation = 'grid';
        primaryDividerOrientation = classification.spanningSide === 'top' || classification.spanningSide === 'bottom'
            ? 'horizontal'
            : 'vertical';
        const spanning = windowState.windows.find(cell => cell.id === classification.spanningCellId);
        const others = windowState.windows.filter(cell => cell.id !== classification.spanningCellId);
        if (classification.spanningSide === 'top') {
            others.sort((a, b) => a.rect.x0 - b.rect.x0);
            orderedCells = [spanning, ...others];
            topRowFraction = spanning.rect.y1 - spanning.rect.y0;
        } else {
            orderedCells = [spanning, ...others];
        }
    }

    const cells = orderedCells.map(cell => cell.type);
    const handles = orderedCells.map(cell => cell.handleSide);
    return {
        layoutId,
        windowLayout: layoutId,
        dividerProfileId,
        transProfileId,
        dividerOrientation,
        primaryDividerOrientation,
        layoutKind,
        spanningSide: classification.spanningSide || null,
        topRowFraction,
        leftCell: cells[0] || null,
        rightCell: cells.at(-1) || null,
        cells,
        cellHandleSides: handles,
        dividerCount: classification.kind === 't-grid' ? 2 : topology.dividers.length,
        layoutSignature: `state:${serializeWindowState(windowState)}|${dividerProfileId}|${transProfileId}`,
        windowState,
        topology,
        windowStateVersion: windowState.version,
        isDynamicWindowState: layoutId === 'dynamic',
    };
}

export function createWindowLayoutController({
    layoutInput,
    dividerProfileInput,
    transProfileInput,
    initialSelection = {},
    initialWidthM = DEFAULT_NEW_WINDOW_WIDTH_M,
    initialHeightM = DEFAULT_NEW_WINDOW_HEIGHT_M,
    edgeExtensionM = DEFAULT_WINDOW_EDGE_EXTENSION_M,
    onLayoutChange = async () => {},
} = {}) {
    const initialRequest = getWindowLayoutRequest(initialSelection);
    let layoutId = initialRequest.windowState ? 'dynamic' : initialRequest.layoutId;
    let dividerProfileId = initialRequest.dividerProfileId;
    let transProfileId = initialRequest.transProfileId;
    let windowState = initialRequest.windowState
        ? setWindowStateTransProfile(
            setWindowStateDividerProfile(initialRequest.windowState, dividerProfileId),
            transProfileId
        )
        : createWindowStateFromLayoutDefinition(
            getWindowLayoutDefinition(layoutId),
            dividerProfileId,
            transProfileId,
            { defaultWidthM: initialWidthM, defaultHeightM: initialHeightM, edgeExtensionM }
        );
    let controlsInitialized = false;

    function getDividerOptions() {
        return getBaseAluminiumProfiles('mullion-transom')
            .filter(isProfileGeometryAvailable)
            .map(profile => ({ value: profile.id, label: profile.id }));
    }


    function getTransOptions() {
        return getBaseAluminiumProfiles('trans')
            .filter(isProfileGeometryAvailable)
            .map(profile => ({ value: profile.id, label: profile.id }));
    }

    function getConfigurationSnapshot() {
        return compatibilitySnapshot(windowState, layoutId, dividerProfileId, transProfileId);
    }

    function syncControls({ refreshOptions = true, topology = null } = {}) {
        if (layoutInput) {
            const selectedLayoutId = layoutId === 'dynamic' ? DEFAULT_WINDOW_LAYOUT_ID : layoutId;
            if (refreshOptions) {
                replaceSelectOptions(
                    layoutInput,
                    Object.values(WINDOW_LAYOUTS).map(layout => ({
                        value: layout.id,
                        label: localizeLayoutLabel(getWindowLocale(), layout.id, layout.label),
                    })),
                    selectedLayoutId
                );
            } else {
                layoutInput.value = selectedLayoutId;
            }
        }
        if (dividerProfileInput) {
            if (refreshOptions) {
                replaceSelectOptions(dividerProfileInput, getDividerOptions(), dividerProfileId);
            } else {
                dividerProfileInput.value = dividerProfileId;
            }
            const hasDivider = windowState.windows.length > 1;
            dividerProfileInput.disabled = !hasDivider;
            dividerProfileInput.closest?.('.divider-profile-field')?.classList.toggle('is-disabled', !hasDivider);
        }
        if (transProfileInput) {
            if (refreshOptions) {
                replaceSelectOptions(transProfileInput, getTransOptions(), transProfileId);
            } else {
                transProfileInput.value = transProfileId;
            }
            const resolvedTopology = topology || deriveWindowTopology(windowState);
            const hasTransCandidate = resolvedTopology.transCandidates.length > 0;
            transProfileInput.disabled = !hasTransCandidate;
            transProfileInput.closest?.('.trans-profile-field')?.classList.toggle('is-disabled', !hasTransCandidate);
        }
    }

    async function notifyChange(previous, {
        reloadDivider = false,
        reloadTrans = false,
        topologyOnly = false,
        sizeOnly = false,
        refreshOptions = true,
    } = {}) {
        const next = getConfigurationSnapshot();
        syncControls({ refreshOptions, topology: next.topology });
        if (next.layoutSignature !== previous.layoutSignature || reloadDivider || reloadTrans) {
            await onLayoutChange(next, {
                reloadDivider,
                reloadTrans,
                topologyOnly,
                sizeOnly,
            });
        }
        return next;
    }

    async function setLayout(nextLayoutId, { notify = true } = {}) {
        const previous = getConfigurationSnapshot();
        layoutId = normalizeWindowLayoutId(nextLayoutId);
        windowState = createWindowStateFromLayoutDefinition(
            getWindowLayoutDefinition(layoutId),
            dividerProfileId,
            transProfileId,
            { defaultWidthM: initialWidthM, defaultHeightM: initialHeightM, edgeExtensionM }
        );
        if (notify) return notifyChange(previous, { topologyOnly: false });
        syncControls();
        return getConfigurationSnapshot();
    }

    async function setDividerProfile(nextProfileId, { notify = true } = {}) {
        const previous = getConfigurationSnapshot();
        const availableIds = getDividerOptions().map(option => option.value);
        dividerProfileId = availableIds.includes(String(nextProfileId))
            ? String(nextProfileId)
            : (availableIds[0] || DEFAULT_DIVIDER_PROFILE_ID);
        windowState = setWindowStateDividerProfile(windowState, dividerProfileId);
        if (notify) return notifyChange(previous, { reloadDivider: true });
        syncControls();
        return getConfigurationSnapshot();
    }


    async function setTransProfile(nextProfileId, { notify = true } = {}) {
        const previous = getConfigurationSnapshot();
        const availableIds = getTransOptions().map(option => option.value);
        transProfileId = availableIds.includes(String(nextProfileId))
            ? String(nextProfileId)
            : (availableIds[0] || DEFAULT_TRANS_PROFILE_ID);
        windowState = setWindowStateTransProfile(windowState, transProfileId);
        if (notify) return notifyChange(previous, { reloadTrans: true });
        syncControls();
        return getConfigurationSnapshot();
    }

    async function addWindow(cellId, direction, type, { handleSide = null, start = null, end = null, notify = true } = {}) {
        const previous = getConfigurationSnapshot();
        windowState = addWindowSideToState(windowState, {
            direction,
            type,
            handleSide,
            defaultWidthM: DEFAULT_NEW_WINDOW_WIDTH_M,
            defaultHeightM: DEFAULT_NEW_WINDOW_HEIGHT_M,
            edgeExtensionM,
        });
        layoutId = 'dynamic';
        if (notify) return notifyChange(previous, { topologyOnly: true });
        syncControls();
        return getConfigurationSnapshot();
    }

    async function mergeWindows(cellAId, cellBId, type = null, { handleSide = null, notify = true } = {}) {
        const previous = getConfigurationSnapshot();
        windowState = mergeWindowsInState(windowState, { cellAId, cellBId, type, handleSide });
        layoutId = 'dynamic';
        if (notify) return notifyChange(previous, { topologyOnly: true });
        syncControls();
        return getConfigurationSnapshot();
    }


    async function setTransBetweenWindows(cellAId, cellBId, {
        enabled = true,
        ownerCellId = null,
        notify = true,
    } = {}) {
        const previous = getConfigurationSnapshot();
        windowState = setTransBetweenWindowsInState(windowState, {
            cellAId,
            cellBId,
            enabled,
            ownerCellId,
        });
        layoutId = 'dynamic';
        if (notify) return notifyChange(previous, { topologyOnly: !enabled });
        syncControls();
        return getConfigurationSnapshot();
    }

    async function deleteWindow(cellId, { notify = true } = {}) {
        const previous = getConfigurationSnapshot();
        windowState = deleteWindowFromState(windowState, { cellId });
        layoutId = 'dynamic';
        if (notify) return notifyChange(previous, { topologyOnly: true });
        syncControls();
        return getConfigurationSnapshot();
    }

    async function setWindowType(cellId, type, { handleSide = null, notify = true } = {}) {
        const previous = getConfigurationSnapshot();
        windowState = setWindowTypeInState(windowState, cellId, type, handleSide);
        layoutId = 'dynamic';
        if (notify) return notifyChange(previous, { topologyOnly: true });
        syncControls();
        return getConfigurationSnapshot();
    }

    async function setWindowSize(cellId, { widthM = null, heightM = null, notify = true } = {}) {
        const previous = getConfigurationSnapshot();
        windowState = setWindowSizeInState(windowState, cellId, { widthM, heightM, edgeExtensionM });
        layoutId = 'dynamic';
        if (notify) {
            return notifyChange(previous, {
                topologyOnly: true,
                sizeOnly: true,
                refreshOptions: false,
            });
        }
        syncControls({ refreshOptions: false });
        return getConfigurationSnapshot();
    }

    async function unmergeWindow(cellId, { notify = true } = {}) {
        const previous = getConfigurationSnapshot();
        windowState = unmergeWindowInState(windowState, { cellId });
        layoutId = 'dynamic';
        if (notify) return notifyChange(previous, { topologyOnly: true });
        syncControls();
        return getConfigurationSnapshot();
    }

    async function applyConfiguration(configuration = {}, { notify = false } = {}) {
        const previous = getConfigurationSnapshot();
        const request = getWindowLayoutRequest(configuration);
        dividerProfileId = request.dividerProfileId;
        transProfileId = request.transProfileId;
        if (request.windowState) {
            layoutId = 'dynamic';
            windowState = setWindowStateTransProfile(
                setWindowStateDividerProfile(request.windowState, dividerProfileId),
                transProfileId
            );
        } else {
            layoutId = request.layoutId;
            windowState = createWindowStateFromLayoutDefinition(
                getWindowLayoutDefinition(layoutId),
                dividerProfileId,
                transProfileId,
                {
                    defaultWidthM: Number.isFinite(Number(configuration.widthM)) ? Number(configuration.widthM) : initialWidthM,
                    defaultHeightM: Number.isFinite(Number(configuration.heightM)) ? Number(configuration.heightM) : initialHeightM,
                    edgeExtensionM,
                }
            );
            windowState = setOverallWindowSizeInState(windowState, {
                widthM: Number.isFinite(Number(configuration.widthM)) ? Number(configuration.widthM) : null,
                heightM: Number.isFinite(Number(configuration.heightM)) ? Number(configuration.heightM) : null,
                edgeExtensionM,
            });
        }
        if (notify) return notifyChange(previous, {
            reloadDivider: dividerProfileId !== previous.dividerProfileId,
            reloadTrans: transProfileId !== previous.transProfileId,
            topologyOnly: dividerProfileId === previous.dividerProfileId && transProfileId === previous.transProfileId,
        });
        syncControls();
        return getConfigurationSnapshot();
    }

    function initializeControls() {
        if (controlsInitialized) return;
        controlsInitialized = true;
        syncControls();
        layoutInput?.addEventListener('change', () => setLayout(layoutInput.value));
        dividerProfileInput?.addEventListener('change', () => setDividerProfile(dividerProfileInput.value));
        transProfileInput?.addEventListener('change', () => setTransProfile(transProfileInput.value));
        globalThis.window?.addEventListener('window-locale-applied', syncControls);
    }

    function appendUrlParams(target) {
        const params = target?.searchParams || target;
        if (!params?.set) return target;
        params.set('window_state', serializeWindowState(windowState));
        params.set('divider_profile', dividerProfileId);
        params.set('trans_profile', transProfileId);
        if (layoutId !== 'dynamic') params.set('window_layout', layoutId);
        else params.delete?.('window_layout');
        return target;
    }

    return {
        initializeControls,
        syncControls,
        setLayout,
        setDividerProfile,
        setTransProfile,
        addWindow,
        mergeWindows,
        setTransBetweenWindows,
        deleteWindow,
        setWindowType,
        setWindowSize,
        unmergeWindow,
        applyConfiguration,
        appendUrlParams,
        getConfigurationSnapshot,
        getWindowState: () => windowState,
        getLayoutId: () => layoutId,
        getDividerProfileId: () => dividerProfileId,
        getTransProfileId: () => transProfileId,
        getDividerOrientation: () => getConfigurationSnapshot().dividerOrientation,
    };
}
