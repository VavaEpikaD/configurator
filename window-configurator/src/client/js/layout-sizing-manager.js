const EPSILON = 1e-8;
const MIN_TRACK_M = 0.05;
const MIN_WINDOW_M = 0.45;
const DEFAULT_EDGE_EXTENSION_M = 0.013;
const SIZE_REBUILD_INTERVAL_MS = 70;

function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function hasFiniteValue(value) {
    return value !== null
        && value !== undefined
        && value !== ''
        && Number.isFinite(Number(value));
}

function nearlyEqual(a, b, epsilon = EPSILON) {
    return Math.abs(finite(a) - finite(b)) <= epsilon;
}

function coordinateKey(value) {
    return finite(value).toFixed(8);
}

function trackKey(track) {
    return `${coordinateKey(track?.start)}:${coordinateKey(track?.end)}`;
}

function cloneState(state) {
    return {
        ...state,
        gridTracks: {
            x: (state?.gridTracks?.x || []).map(track => ({ ...track })),
            y: (state?.gridTracks?.y || []).map(track => ({ ...track })),
        },
        windows: (state?.windows || []).map(cell => ({
            ...cell,
            rect: { ...cell.rect },
        })),
        transConnections: (state?.transConnections || []).map(connection => ({ ...connection })),
        mergeGuides: (state?.mergeGuides || []).map(guide => ({
            ...guide,
            ...(Array.isArray(guide.restoreCells)
                ? {
                    restoreCells: guide.restoreCells.map(cell => ({
                        ...cell,
                        rect: { ...cell.rect },
                    })),
                }
                : {}),
        })),
    };
}

function stateBounds(state) {
    const windows = state?.windows || [];
    if (!windows.length) return { x0: 0, y0: 0, x1: 1, y1: 1 };
    return {
        x0: Math.min(...windows.map(cell => finite(cell.rect?.x0))),
        y0: Math.min(...windows.map(cell => finite(cell.rect?.y0))),
        x1: Math.max(...windows.map(cell => finite(cell.rect?.x1, 1))),
        y1: Math.max(...windows.map(cell => finite(cell.rect?.y1, 1))),
    };
}

function tracksForCell(state, cell, axis) {
    if (!cell) return [];
    const start = axis === 'x' ? finite(cell.rect?.x0) : finite(cell.rect?.y0);
    const end = axis === 'x' ? finite(cell.rect?.x1) : finite(cell.rect?.y1);
    return (state?.gridTracks?.[axis] || []).filter(track => (
        finite(track.start) >= start - EPSILON
        && finite(track.end) <= end + EPSILON
        && finite(track.end) > finite(track.start) + EPSILON
    ));
}

function cellOuterSideCount(state, cell, axis) {
    const bounds = stateBounds(state);
    if (axis === 'x') {
        return (nearlyEqual(cell.rect.x0, bounds.x0) ? 1 : 0)
            + (nearlyEqual(cell.rect.x1, bounds.x1) ? 1 : 0);
    }
    return (nearlyEqual(cell.rect.y0, bounds.y0) ? 1 : 0)
        + (nearlyEqual(cell.rect.y1, bounds.y1) ? 1 : 0);
}

function sumTrackSizes(tracks) {
    return (tracks || []).reduce(
        (sum, track) => sum + Math.max(0, finite(track?.sizeM)),
        0
    );
}

function applySizeMap(tracks, sizeMap) {
    return (tracks || []).map(track => ({
        ...track,
        sizeM: sizeMap.has(trackKey(track))
            ? sizeMap.get(trackKey(track))
            : track.sizeM,
    }));
}

// Scale a set of tracks to an exact structural total while respecting the
// minimum physical track size. When no track is clamped this preserves the
// existing proportions, which is important for smooth individual resizing.
function distributeToTarget(tracks, requestedTotal) {
    const source = tracks || [];
    const result = new Map();
    if (!source.length) return result;

    const target = Math.max(MIN_TRACK_M * source.length, finite(requestedTotal));
    const remaining = new Set(source.map(trackKey));
    const currentByKey = new Map(source.map(track => [
        trackKey(track),
        Math.max(0, finite(track.sizeM)),
    ]));
    let remainingTarget = target;

    while (remaining.size) {
        const keys = [...remaining];
        const weightTotal = keys.reduce(
            (sum, key) => sum + Math.max(EPSILON, currentByKey.get(key) || 0),
            0
        );
        let clampedAny = false;

        keys.forEach(key => {
            if (!remaining.has(key)) return;
            const weight = Math.max(EPSILON, currentByKey.get(key) || 0);
            const proposed = remainingTarget * (weight / weightTotal);
            if (proposed >= MIN_TRACK_M - EPSILON) return;
            result.set(key, MIN_TRACK_M);
            remaining.delete(key);
            remainingTarget -= MIN_TRACK_M;
            clampedAny = true;
        });

        if (!clampedAny) {
            const activeKeys = [...remaining];
            const activeWeight = activeKeys.reduce(
                (sum, key) => sum + Math.max(EPSILON, currentByKey.get(key) || 0),
                0
            );
            activeKeys.forEach((key, index) => {
                const weight = Math.max(EPSILON, currentByKey.get(key) || 0);
                let value = remainingTarget * (weight / activeWeight);
                if (index === activeKeys.length - 1) {
                    const assigned = activeKeys.slice(0, -1).reduce(
                        (sum, assignedKey) => sum + finite(result.get(assignedKey)),
                        0
                    );
                    const fixedAssigned = [...result.entries()]
                        .filter(([assignedKey]) => !activeKeys.includes(assignedKey))
                        .reduce((sum, [, assignedValue]) => sum + finite(assignedValue), 0);
                    value = target - fixedAssigned - assigned;
                }
                result.set(key, Math.max(MIN_TRACK_M, value));
            });
            break;
        }
    }

    // Correct tiny floating-point residue on the largest adjustable track.
    const resolved = [...result.values()].reduce((sum, value) => sum + value, 0);
    let delta = target - resolved;
    if (Math.abs(delta) > EPSILON) {
        const candidates = [...result.entries()]
            .sort((left, right) => right[1] - left[1]);
        for (const [key, value] of candidates) {
            const next = Math.max(MIN_TRACK_M, value + delta);
            const applied = next - value;
            result.set(key, next);
            delta -= applied;
            if (Math.abs(delta) <= EPSILON) break;
        }
    }

    return result;
}

// Historical overall-size behavior: every physical row/column gets the same
// visible millimetre share. The outer 13 mm frame correction is subtracted from
// the structural size of the two perimeter tracks so the user-facing values
// remain exact.
function distributeTracksEquallyInMillimetres(
    tracks,
    targetStructuralM,
    { allTracks = tracks, edgeExtensionM = DEFAULT_EDGE_EXTENSION_M } = {}
) {
    const source = tracks || [];
    const result = new Map();
    if (!source.length) return result;

    const extension = Math.max(0, finite(edgeExtensionM, DEFAULT_EDGE_EXTENSION_M));
    const complete = allTracks || source;
    const minStart = Math.min(...complete.map(track => finite(track.start)));
    const maxEnd = Math.max(...complete.map(track => finite(track.end)));
    const outerCorrection = track => (
        (nearlyEqual(track.start, minStart) ? 1 : 0)
        + (nearlyEqual(track.end, maxEnd) ? 1 : 0)
    ) * extension;

    const correctionTotal = source.reduce((sum, track) => sum + outerCorrection(track), 0);
    const targetActualMm = Math.round((finite(targetStructuralM) + correctionTotal) * 1000);
    const baseActualMm = Math.floor(targetActualMm / source.length);
    let remainderMm = targetActualMm - baseActualMm * source.length;

    source.forEach(track => {
        const actualMm = baseActualMm + (remainderMm > 0 ? 1 : 0);
        if (remainderMm > 0) remainderMm -= 1;
        result.set(
            trackKey(track),
            Math.max(MIN_TRACK_M, actualMm / 1000 - outerCorrection(track))
        );
    });

    const structuralResolved = [...result.values()].reduce((sum, value) => sum + value, 0);
    const delta = finite(targetStructuralM) - structuralResolved;
    if (Math.abs(delta) > EPSILON) {
        const key = trackKey(source.at(-1));
        result.set(key, Math.max(MIN_TRACK_M, finite(result.get(key)) + delta));
    }
    return result;
}

export function getOverallLayoutDimensions(
    state,
    { edgeExtensionM = DEFAULT_EDGE_EXTENSION_M } = {}
) {
    const extension = Math.max(0, finite(edgeExtensionM, DEFAULT_EDGE_EXTENSION_M));
    return {
        widthM: sumTrackSizes(state?.gridTracks?.x) + extension * 2,
        heightM: sumTrackSizes(state?.gridTracks?.y) + extension * 2,
    };
}

function getCellActualAxisSize(state, cell, axis, extension) {
    return sumTrackSizes(tracksForCell(state, cell, axis))
        + cellOuterSideCount(state, cell, axis) * extension;
}

function stateMeetsMinimumWindowSize(
    state,
    axis,
    minWindowM = MIN_WINDOW_M,
    extension = DEFAULT_EDGE_EXTENSION_M
) {
    return (state?.windows || []).every(cell => (
        getCellActualAxisSize(state, cell, axis, extension) >= minWindowM - EPSILON
    ));
}

function getMinimumOverallAxisSize(
    state,
    axis,
    minWindowM = MIN_WINDOW_M,
    extension = DEFAULT_EDGE_EXTENSION_M
) {
    const tracks = state?.gridTracks?.[axis] || [];
    if (!tracks.length) return minWindowM;
    const trackCount = tracks.length;
    let minimum = trackCount * MIN_TRACK_M + extension * 2;

    // With equal visible track shares, a cell spanning k tracks receives k/n
    // of the overall dimension. Therefore this is the exact lower bound needed
    // to keep every window at or above the 450 mm fabrication/UI minimum.
    (state?.windows || []).forEach(cell => {
        const spanCount = Math.max(1, tracksForCell(state, cell, axis).length);
        minimum = Math.max(minimum, minWindowM * (trackCount / spanCount));
    });
    return minimum;
}

function lockedTrackKeysForModifiedWindows(state, modifiedWindowIds, axis, currentCellId = null) {
    const lockedKeys = new Set();
    for (const windowId of modifiedWindowIds || []) {
        if (currentCellId !== null && String(windowId) === String(currentCellId)) continue;
        const cell = state?.windows?.find(candidate => String(candidate.id) === String(windowId));
        if (!cell) continue;
        tracksForCell(state, cell, axis).forEach(track => lockedKeys.add(trackKey(track)));
    }
    return lockedKeys;
}

function proposeIndividualAxis(
    stateValue,
    cellId,
    axis,
    targetActualM,
    extension,
    lockedTrackKeys = new Set()
) {
    const state = cloneState(stateValue);
    const cell = state.windows.find(candidate => String(candidate.id) === String(cellId));
    if (!cell) return { feasible: false, state };

    const allTracks = state.gridTracks?.[axis] || [];
    const selectedTracks = tracksForCell(state, cell, axis);
    if (!selectedTracks.length) return { feasible: false, state };

    const locks = lockedTrackKeys instanceof Set ? lockedTrackKeys : new Set();
    const selectedKeys = new Set(selectedTracks.map(trackKey));
    const selectedLockedTracks = selectedTracks.filter(track => locks.has(trackKey(track)));
    const selectedFreeTracks = selectedTracks.filter(track => !locks.has(trackKey(track)));
    const outsideTracks = allTracks.filter(track => !selectedKeys.has(trackKey(track)));
    const outsideLockedTracks = outsideTracks.filter(track => locks.has(trackKey(track)));
    const outsideFreeTracks = outsideTracks.filter(track => !locks.has(trackKey(track)));

    const totalStructural = sumTrackSizes(allTracks);
    const targetSelectedStructural = Math.max(
        MIN_TRACK_M * selectedTracks.length,
        finite(targetActualM) - cellOuterSideCount(state, cell, axis) * extension
    );

    const selectedLockedStructural = sumTrackSizes(selectedLockedTracks);
    const selectedFreeTarget = targetSelectedStructural - selectedLockedStructural;
    if (
        (!selectedFreeTracks.length && Math.abs(selectedFreeTarget) > 1e-7)
        || selectedFreeTarget < MIN_TRACK_M * selectedFreeTracks.length - EPSILON
    ) {
        return { feasible: false, state: cloneState(stateValue), selectedKeys, preservedOverall: true };
    }

    const outsideTarget = totalStructural - targetSelectedStructural;
    const outsideLockedStructural = sumTrackSizes(outsideLockedTracks);
    const outsideFreeTarget = outsideTarget - outsideLockedStructural;
    if (
        (!outsideFreeTracks.length && Math.abs(outsideFreeTarget) > 1e-7)
        || outsideFreeTarget < MIN_TRACK_M * outsideFreeTracks.length - EPSILON
    ) {
        return { feasible: false, state: cloneState(stateValue), selectedKeys, preservedOverall: true };
    }

    let nextTracks = allTracks;
    if (selectedFreeTracks.length) {
        nextTracks = applySizeMap(
            nextTracks,
            distributeToTarget(selectedFreeTracks, selectedFreeTarget)
        );
    }
    if (outsideFreeTracks.length) {
        nextTracks = applySizeMap(
            nextTracks,
            distributeToTarget(outsideFreeTracks, outsideFreeTarget)
        );
    }
    state.gridTracks[axis] = nextTracks;

    const totalAfter = sumTrackSizes(nextTracks);
    const selectedAfter = sumTrackSizes(tracksForCell(state, cell, axis));
    const feasible = nearlyEqual(totalAfter, totalStructural, 1e-6)
        && nearlyEqual(selectedAfter, targetSelectedStructural, 1e-6)
        && stateMeetsMinimumWindowSize(state, axis, MIN_WINDOW_M, extension);

    return {
        feasible,
        state,
        selectedKeys,
        preservedOverall: true,
    };
}

function findBestIndividualAxisProposal(
    state,
    cellId,
    axis,
    requestedActualM,
    extension,
    lockedKeys
) {
    const cell = state.windows.find(candidate => String(candidate.id) === String(cellId));
    if (!cell) return { feasible: false, state };
    const currentActual = getCellActualAxisSize(state, cell, axis, extension);
    const requested = Math.max(MIN_WINDOW_M, finite(requestedActualM, currentActual));

    const requestedProposal = proposeIndividualAxis(
        state,
        cellId,
        axis,
        requested,
        extension,
        lockedKeys
    );
    if (requestedProposal.feasible) return requestedProposal;

    // If the exact request is impossible while preserving the overall size and
    // all previously modified windows, move only as far as those constraints allow.
    let low = 0;
    let high = 1;
    let best = proposeIndividualAxis(
        state,
        cellId,
        axis,
        currentActual,
        extension,
        lockedKeys
    );
    for (let iteration = 0; iteration < 48; iteration += 1) {
        const factor = (low + high) / 2;
        const target = currentActual + (requested - currentActual) * factor;
        const candidate = proposeIndividualAxis(
            state,
            cellId,
            axis,
            target,
            extension,
            lockedKeys
        );
        if (candidate.feasible) {
            best = candidate;
            low = factor;
        } else {
            high = factor;
        }
    }
    return best;
}

function createSharedFeedback() {
    if (typeof document === 'undefined') return { show() {} };
    let fallbackTimer = null;

    function feedbackElement() {
        return document.querySelector('[data-save-feedback]');
    }

    return {
        show(message, { type = 'error', durationMs = 2000 } = {}) {
            const feedback = feedbackElement();
            if (!(feedback instanceof HTMLElement)) return;
            const text = feedback.querySelector('[data-save-feedback-text]');
            if (!(text instanceof HTMLElement)) return;

            if (fallbackTimer !== null) {
                clearTimeout(fallbackTimer);
                fallbackTimer = null;
            }

            const feedbackType = type === 'error' ? 'is-error' : 'is-success';
            feedback.classList.remove('is-success', 'is-error', 'is-animating');
            void feedback.offsetWidth;
            const duration = Math.max(300, Number(durationMs) || 2000);
            feedback.style.animationDuration = `${duration}ms`;
            text.textContent = String(message || '');
            feedback.classList.add(feedbackType, 'is-animating');

            fallbackTimer = setTimeout(() => {
                feedback.classList.remove('is-animating');
                feedback.style.removeProperty('animation-duration');
                fallbackTimer = null;
            }, duration + 80);
        },
    };
}

function bindOverallControls({
    getState,
    getDimensions,
    getMinimumDimensions,
    widthMaxM,
    heightMaxM,
    onResize,
    onPreview = null,
}) {
    if (typeof document === 'undefined') return null;
    const wrapper = document.getElementById('overallWindowSizeControls');
    if (!wrapper) return null;

    const widthRange = wrapper.querySelector('#overallWidthA');
    const heightRange = wrapper.querySelector('#overallHeightB');
    const widthValue = wrapper.querySelector('#valOverallWidth');
    const heightValue = wrapper.querySelector('#valOverallHeight');
    const widthDec = wrapper.querySelector('#btnOverallWidthDec');
    const widthInc = wrapper.querySelector('#btnOverallWidthInc');
    const heightDec = wrapper.querySelector('#btnOverallHeightDec');
    const heightInc = wrapper.querySelector('#btnOverallHeightInc');
    if (!widthRange || !heightRange || !widthValue || !heightValue) return null;

    let timer = null;
    let lastRebuildAt = 0;
    const pendingAxes = new Set();

    function updateBounds(range, valueM, minimumM, configuredMax) {
        const min = Math.max(0.05, finite(minimumM, 0.45));
        const currentMax = Math.max(min + 0.001, finite(range.max, configuredMax));
        const max = Math.max(
            configuredMax,
            currentMax,
            valueM * 1.25,
            min + 0.1
        );
        range.min = min.toFixed(3);
        range.max = (Math.ceil(max * 1000) / 1000).toFixed(3);
        return { min, max };
    }

    function writePair(range, valueInput, valueM, minimumM, configuredMax) {
        const requested = Math.max(0.001, finite(valueM, finite(range.value, 1)));
        const { min } = updateBounds(range, requested, minimumM, configuredMax);
        if (requested > finite(range.max)) {
            range.max = (Math.ceil(requested * 1.15 * 1000) / 1000).toFixed(3);
        }
        const clamped = Math.max(min, requested);
        range.value = clamped.toFixed(3);
        valueInput.min = String(Math.round(min * 1000));
        valueInput.value = String(Math.round(clamped * 1000));
        return clamped;
    }

    function sync(dimensions = getDimensions()) {
        const minimum = getMinimumDimensions();
        writePair(widthRange, widthValue, dimensions.widthM, minimum.widthM, widthMaxM);
        writePair(heightRange, heightValue, dimensions.heightM, minimum.heightM, heightMaxM);
    }

    function preview(axis = null) {
        if (axis) pendingAxes.add(axis);
        if (!pendingAxes.size || typeof onPreview !== 'function') return;
        const payload = {};
        if (pendingAxes.has('width')) payload.widthM = finite(widthRange.value);
        if (pendingAxes.has('height')) payload.heightM = finite(heightRange.value);
        lastRebuildAt = performance.now();
        onPreview(payload);
    }

    async function flush(axis = null) {
        if (axis) pendingAxes.add(axis);
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
        if (!pendingAxes.size) return;
        const payload = {};
        if (pendingAxes.has('width')) payload.widthM = finite(widthRange.value);
        if (pendingAxes.has('height')) payload.heightM = finite(heightRange.value);
        pendingAxes.clear();
        lastRebuildAt = performance.now();
        await onResize(payload);
    }

    function queue(axis) {
        pendingAxes.add(axis);
        const minimum = getMinimumDimensions();
        if (axis === 'width') {
            writePair(widthRange, widthValue, widthRange.value, minimum.widthM, widthMaxM);
        } else {
            writePair(heightRange, heightValue, heightRange.value, minimum.heightM, heightMaxM);
        }

        const elapsed = performance.now() - lastRebuildAt;
        if (elapsed >= SIZE_REBUILD_INTERVAL_MS && timer === null) {
            preview();
            return;
        }
        if (timer === null) {
            timer = setTimeout(() => {
                timer = null;
                preview();
            }, Math.max(0, SIZE_REBUILD_INTERVAL_MS - elapsed));
        }
    }

    widthRange.addEventListener('input', () => queue('width'));
    heightRange.addEventListener('input', () => queue('height'));
    widthRange.addEventListener('change', () => void flush('width'));
    heightRange.addEventListener('change', () => void flush('height'));

    function bindNumber(valueInput, range, axis, configuredMax) {
        const commit = () => {
            const minimum = getMinimumDimensions();
            const minimumM = axis === 'width' ? minimum.widthM : minimum.heightM;
            const requestedMm = finite(valueInput.value, finite(range.value) * 1000);
            writePair(range, valueInput, requestedMm / 1000, minimumM, configuredMax);
            void flush(axis);
        };
        valueInput.addEventListener('change', commit);
        valueInput.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            commit();
        });
    }
    bindNumber(widthValue, widthRange, 'width', widthMaxM);
    bindNumber(heightValue, heightRange, 'height', heightMaxM);

    function step(range, valueInput, axis, configuredMax, deltaMm) {
        const minimum = getMinimumDimensions();
        const minimumM = axis === 'width' ? minimum.widthM : minimum.heightM;
        writePair(
            range,
            valueInput,
            finite(range.value) + deltaMm / 1000,
            minimumM,
            configuredMax
        );
        void flush(axis);
    }
    widthDec?.addEventListener('click', () => step(widthRange, widthValue, 'width', widthMaxM, -1));
    widthInc?.addEventListener('click', () => step(widthRange, widthValue, 'width', widthMaxM, 1));
    heightDec?.addEventListener('click', () => step(heightRange, heightValue, 'height', heightMaxM, -1));
    heightInc?.addEventListener('click', () => step(heightRange, heightValue, 'height', heightMaxM, 1));

    // Keep the controls stable if a profile/layout operation completes before
    // the first user interaction.
    void getState();
    sync();
    return { sync };
}

export function createLayoutSizingManager({
    controller,
    edgeExtensionM = DEFAULT_EDGE_EXTENSION_M,
    widthMaxM = 2,
    heightMaxM = 2.2,
    onResizeStateChange = () => {},
    onAfterChange = () => {},
    onPreviewStateChange = () => {},
} = {}) {
    if (!controller) throw new Error('A window layout controller is required.');

    const extension = Math.max(0, finite(edgeExtensionM, DEFAULT_EDGE_EXTENSION_M));
    // Width and height modification state are deliberately independent.
    // The visible/user-facing flag belongs to the window the user edited, while
    // protection belongs to the physical grid tracks touched by that edit. Two
    // windows in the same column/row share a track, so track-level protection is
    // what keeps the sizing rules correct for real grid layouts.
    const modifiedWindowIds = {
        x: new Set(),
        y: new Set(),
    };
    const modifiedTrackKeys = {
        x: new Set(),
        y: new Set(),
    };
    const sharedFeedback = createSharedFeedback();
    let mutationChain = Promise.resolve();
    let pendingWindowResize = null;
    let windowDrainPromise = null;
    let pendingOverallResize = null;
    let overallDrainPromise = null;

    const getState = () => controller.getWindowState();
    const getOverallDimensions = () => getOverallLayoutDimensions(
        getState(),
        { edgeExtensionM: extension }
    );
    const getMinimumDimensions = () => ({
        widthM: getMinimumOverallAxisSize(getState(), 'x', MIN_WINDOW_M, extension),
        heightM: getMinimumOverallAxisSize(getState(), 'y', MIN_WINDOW_M, extension),
    });

    function enqueue(task) {
        const next = mutationChain.then(task, task);
        mutationChain = next.catch(() => {});
        return next;
    }

    function clearModifiedFlags(axis = null) {
        if (axis === 'x' || axis === 'y') {
            modifiedWindowIds[axis].clear();
            modifiedTrackKeys[axis].clear();
            return;
        }
        modifiedWindowIds.x.clear();
        modifiedWindowIds.y.clear();
        modifiedTrackKeys.x.clear();
        modifiedTrackKeys.y.clear();
    }

    function isWindowAxisModified(cellId, axis) {
        if (axis !== 'x' && axis !== 'y') return false;
        return modifiedWindowIds[axis].has(String(cellId));
    }

    function getWindowModifiedFlags(cellId) {
        return Object.freeze({
            width: isWindowAxisModified(cellId, 'x'),
            height: isWindowAxisModified(cellId, 'y'),
        });
    }

    function isWindowModified(cellId) {
        const flags = getWindowModifiedFlags(cellId);
        return flags.width || flags.height;
    }

    async function applyState(nextState, {
        showLayoutResizedWarning = false,
        kind = 'resize',
    } = {}) {
        const snapshot = controller.getConfigurationSnapshot();
        onResizeStateChange(true);
        try {
            const result = await controller.applyConfiguration({
                windowState: nextState,
                dividerProfileId: snapshot.dividerProfileId,
                transProfileId: snapshot.transProfileId,
            }, {
                notify: true,
                sizeOnly: true,
                refreshOptions: false,
            });
            controls?.sync(getOverallDimensions());
            onAfterChange(result, { kind });
            if (showLayoutResizedWarning) {
                sharedFeedback.show('The layout was resized.', {
                    type: 'error',
                    durationMs: 2000,
                });
            }
            return result;
        } finally {
            onResizeStateChange(false);
        }
    }

    function computeWindowPreviewState(cellId, size = {}) {
        let nextState = getState();
        const previewTrackFlags = {
            x: new Set(modifiedTrackKeys.x),
            y: new Set(modifiedTrackKeys.y),
        };

        const resizeAxis = (axis, requestedValue) => {
            if (!hasFiniteValue(requestedValue)) return;
            const before = nextState;
            const cell = before.windows.find(candidate => String(candidate.id) === String(cellId));
            if (!cell) return;

            const currentActual = getCellActualAxisSize(before, cell, axis, extension);
            const requested = Math.max(MIN_WINDOW_M, Number(requestedValue));
            if (nearlyEqual(currentActual, requested, 1e-7)) return;

            const allTracks = before.gridTracks?.[axis] || [];
            const allTrackKeys = new Set(allTracks.map(trackKey));
            const selectedTracks = tracksForCell(before, cell, axis);
            const selectedKeys = new Set(selectedTracks.map(trackKey));
            const outsideKeys = new Set(
                [...allTrackKeys].filter(key => !selectedKeys.has(key))
            );
            const modifiedTracks = previewTrackFlags[axis];
            for (const key of [...modifiedTracks]) {
                if (!allTrackKeys.has(key)) modifiedTracks.delete(key);
            }

            const selectedHasUnmodifiedTrack = [...selectedKeys].some(
                key => !modifiedTracks.has(key)
            );
            const allOutsideTracksModified = outsideKeys.size > 0
                && [...outsideKeys].every(key => modifiedTracks.has(key));
            const startsNewCycle = selectedHasUnmodifiedTrack && allOutsideTracksModified;

            const lockedKeys = new Set();
            if (!startsNewCycle) {
                for (const key of modifiedTracks) {
                    if (!selectedKeys.has(key)) lockedKeys.add(key);
                }
            }

            const proposal = findBestIndividualAxisProposal(
                before,
                String(cellId),
                axis,
                requested,
                extension,
                lockedKeys
            );
            nextState = proposal.state;
            if (startsNewCycle) modifiedTracks.clear();
            for (const key of selectedKeys) modifiedTracks.add(key);
        };

        resizeAxis('x', size.widthM);
        resizeAxis('y', size.heightM);
        return nextState;
    }

    function computeOverallPreviewState(size = {}) {
        let nextState = getState();
        const minimum = getMinimumDimensions();

        const resizeAxis = (axis, requestedValue, minimumValue) => {
            if (!hasFiniteValue(requestedValue)) return;
            const tracks = nextState.gridTracks?.[axis] || [];
            if (!tracks.length) return;
            const requested = Math.max(minimumValue, Number(requestedValue));
            const targetStructural = Math.max(
                MIN_TRACK_M * tracks.length,
                requested - extension * 2
            );
            const sizes = distributeTracksEquallyInMillimetres(
                tracks,
                targetStructural,
                { allTracks: tracks, edgeExtensionM: extension }
            );
            const candidate = cloneState(nextState);
            candidate.gridTracks[axis] = applySizeMap(tracks, sizes);
            if (stateMeetsMinimumWindowSize(candidate, axis, MIN_WINDOW_M, extension)) {
                nextState = candidate;
            }
        };

        resizeAxis('x', size.widthM, minimum.widthM);
        resizeAxis('y', size.heightM, minimum.heightM);
        return nextState;
    }

    function previewWindow(cellId, size = {}) {
        const state = computeWindowPreviewState(cellId, size);
        onPreviewStateChange(state, { kind: 'window', cellId: String(cellId) });
        return state;
    }

    function previewOverall(size = {}) {
        const state = computeOverallPreviewState(size);
        onPreviewStateChange(state, { kind: 'overall' });
        return state;
    }

    async function resizeWindowNow(cellId, size = {}) {
        let nextState = getState();
        let showLayoutResizedWarning = false;

        const resizeAxis = (axis, requestedValue) => {
            if (!hasFiniteValue(requestedValue)) return;

            const before = nextState;
            const cell = before.windows.find(candidate => String(candidate.id) === String(cellId));
            if (!cell) throw new Error(`Unknown window ${cellId}.`);

            const currentActual = getCellActualAxisSize(before, cell, axis, extension);
            const requested = Math.max(MIN_WINDOW_M, Number(requestedValue));
            if (nearlyEqual(currentActual, requested, 1e-7)) return;

            const currentId = String(cellId);
            const windowIds = before.windows.map(windowCell => String(windowCell.id));
            const modifiedWindows = modifiedWindowIds[axis];
            const modifiedTracks = modifiedTrackKeys[axis];
            const allTracks = before.gridTracks?.[axis] || [];
            const allTrackKeys = new Set(allTracks.map(trackKey));
            const selectedTracks = tracksForCell(before, cell, axis);
            const selectedKeys = new Set(selectedTracks.map(trackKey));
            const outsideKeys = new Set(
                [...allTrackKeys].filter(key => !selectedKeys.has(key))
            );

            // Clean up stale state defensively in case a topology mutation happened
            // outside this manager. Normal add/delete/merge paths reset the flags.
            for (const modifiedId of [...modifiedWindows]) {
                if (!windowIds.includes(modifiedId)) modifiedWindows.delete(modifiedId);
            }
            for (const key of [...modifiedTracks]) {
                if (!allTrackKeys.has(key)) modifiedTracks.delete(key);
            }

            // Modification cycles are per physical axis track, not per rendered
            // window. In a 3x2 grid, for example, windows 5 and 1 share one width
            // track. After the first two columns have been manually modified,
            // editing a window in the last column must start a fresh cycle even
            // though three other window IDs happen to share those columns.
            //
            // Starting a new cycle releases every old flag on this axis, applies
            // the requested edit with no old track locks, then marks only the
            // newly edited window/tracks and shows the layout-resized feedback.
            const selectedHasUnmodifiedTrack = [...selectedKeys].some(
                key => !modifiedTracks.has(key)
            );
            const allOutsideTracksModified = outsideKeys.size > 0
                && [...outsideKeys].every(key => modifiedTracks.has(key));
            const startsNewCycle = selectedHasUnmodifiedTrack
                && allOutsideTracksModified;

            const lockedKeys = new Set();
            if (!startsNewCycle) {
                for (const key of modifiedTracks) {
                    // The window currently being edited always owns its selected
                    // tracks for this operation, even if a different window in the
                    // same row/column previously set the track flag.
                    if (!selectedKeys.has(key)) lockedKeys.add(key);
                }
            }

            const proposal = findBestIndividualAxisProposal(
                before,
                currentId,
                axis,
                requested,
                extension,
                lockedKeys
            );

            // Previously modified windows are never released implicitly. If the
            // requested value cannot be reached with them protected, the edit is
            // clamped to the furthest feasible value instead. The only automatic
            // release is the explicit all-but-one cycle above.
            const afterCell = proposal.state.windows.find(
                candidate => String(candidate.id) === currentId
            );
            const afterActual = afterCell
                ? getCellActualAxisSize(proposal.state, afterCell, axis, extension)
                : currentActual;
            const changed = !nearlyEqual(currentActual, afterActual, 1e-7);

            nextState = proposal.state;
            if (!changed) return;

            if (startsNewCycle) {
                modifiedWindows.clear();
                modifiedTracks.clear();
                showLayoutResizedWarning = true;
            }
            modifiedWindows.add(currentId);
            for (const key of selectedKeys) modifiedTracks.add(key);
        };

        resizeAxis('x', size.widthM);
        resizeAxis('y', size.heightM);
        return applyState(nextState, {
            showLayoutResizedWarning,
            kind: 'window',
        });
    }

    async function resizeOverallNow(size = {}) {
        let nextState = getState();
        const minimum = getMinimumDimensions();

        // Overall sizing intentionally starts a new sizing cycle. It is the
        // explicit command to resize the complete layout, so all existing
        // per-window modified flags are cleared first.
        clearModifiedFlags();

        const resizeAxis = (axis, requestedValue, minimumValue) => {
            if (!hasFiniteValue(requestedValue)) return;
            const tracks = nextState.gridTracks?.[axis] || [];
            if (!tracks.length) return;
            const requested = Math.max(minimumValue, Number(requestedValue));
            const targetStructural = Math.max(
                MIN_TRACK_M * tracks.length,
                requested - extension * 2
            );
            const sizes = distributeTracksEquallyInMillimetres(
                tracks,
                targetStructural,
                { allTracks: tracks, edgeExtensionM: extension }
            );
            const candidate = cloneState(nextState);
            candidate.gridTracks[axis] = applySizeMap(tracks, sizes);
            if (stateMeetsMinimumWindowSize(candidate, axis, MIN_WINDOW_M, extension)) {
                nextState = candidate;
            }
        };

        resizeAxis('x', size.widthM, minimum.widthM);
        resizeAxis('y', size.heightM, minimum.heightM);
        return applyState(nextState, { kind: 'overall' });
    }

    function resizeWindow(cellId, size = {}) {
        const id = String(cellId);
        if (!pendingWindowResize || pendingWindowResize.cellId !== id) {
            pendingWindowResize = { cellId: id, size: {} };
        }
        if (hasFiniteValue(size.widthM)) pendingWindowResize.size.widthM = Number(size.widthM);
        if (hasFiniteValue(size.heightM)) pendingWindowResize.size.heightM = Number(size.heightM);

        if (!windowDrainPromise) {
            windowDrainPromise = (async () => {
                while (pendingWindowResize) {
                    const request = pendingWindowResize;
                    pendingWindowResize = null;
                    await enqueue(() => resizeWindowNow(request.cellId, request.size));
                }
            })().finally(() => {
                windowDrainPromise = null;
            });
        }
        return windowDrainPromise;
    }

    function resizeOverall(size = {}) {
        pendingOverallResize ||= {};
        if (hasFiniteValue(size.widthM)) pendingOverallResize.widthM = Number(size.widthM);
        if (hasFiniteValue(size.heightM)) pendingOverallResize.heightM = Number(size.heightM);

        if (!overallDrainPromise) {
            overallDrainPromise = (async () => {
                while (pendingOverallResize) {
                    const request = pendingOverallResize;
                    pendingOverallResize = null;
                    await enqueue(() => resizeOverallNow(request));
                }
            })().finally(() => {
                overallDrainPromise = null;
            });
        }
        return overallDrainPromise;
    }

    const controls = bindOverallControls({
        getState,
        getDimensions: getOverallDimensions,
        getMinimumDimensions,
        widthMaxM,
        heightMaxM,
        onResize: resizeOverall,
        onPreview: previewOverall,
    });

    return {
        getOverallDimensions,
        getMinimumDimensions,
        syncOverallControls() {
            controls?.sync(getOverallDimensions());
        },
        resetModifiedFlags() {
            clearModifiedFlags();
            onAfterChange(controller.getConfigurationSnapshot(), { kind: 'flags' });
        },
        isWindowModified,
        isWindowWidthModified: cellId => isWindowAxisModified(cellId, 'x'),
        isWindowHeightModified: cellId => isWindowAxisModified(cellId, 'y'),
        getWindowModifiedFlags,
        previewWindow,
        previewOverall,
        resizeWindow,
        resizeOverall,
        addWindow(cellId, direction, type, options = {}) {
            return enqueue(async () => {
                const result = await controller.addWindow(cellId, direction, type, {
                    ...options,
                    notify: true,
                });
                clearModifiedFlags();
                controls?.sync(getOverallDimensions());
                onAfterChange(result, { kind: 'topology' });
                return result;
            });
        },
        deleteWindow(cellId) {
            return enqueue(async () => {
                const result = await controller.deleteWindow(cellId, { notify: true });
                clearModifiedFlags();
                controls?.sync(getOverallDimensions());
                onAfterChange(result, { kind: 'topology' });
                return result;
            });
        },
    };
}
