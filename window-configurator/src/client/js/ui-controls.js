import { getWindowLocale, windowT } from './i18n.js';
import { WINDOW_WIDTH_MAX_M } from './config.js';

const SIZE_REBUILD_INTERVAL_MS = 80;

function setSidebarCollapsed(collapsed) {
    const controlsPanel = document.getElementById('controls');
    const toggleButton = document.getElementById('sidebar-toggle');
    if (!controlsPanel || !toggleButton) return;

    controlsPanel.classList.toggle('sidebar-collapsed', collapsed);
    document.body.classList.toggle('sidebar-is-collapsed', collapsed);
    toggleButton.setAttribute('aria-expanded', String(!collapsed));
    const locale = getWindowLocale();
    const sidebarLabel = windowT(locale, collapsed ? 'sidebar.show' : 'sidebar.hide');
    toggleButton.setAttribute('aria-label', sidebarLabel);
    toggleButton.title = sidebarLabel;
}

function stepDecimals(stepValue) {
    const text = String(stepValue ?? '');
    if (!text.includes('.')) return 0;
    return text.split('.')[1].length;
}

function changeInputValue(input, delta) {
    const min = Number.parseFloat(input.min);
    const max = Number.parseFloat(input.max);
    const value = Number.parseFloat(input.value) || min;
    const nextValue = Math.min(max, Math.max(min, value + delta));
    const decimals = Math.max(3, stepDecimals(input.step));
    input.value = nextValue.toFixed(decimals);
    input.dispatchEvent(new Event('input'));
}

export function initializeUIControls({
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
    onWindowSizeChange = null,
    syncModeButtons,
    setExploded,
    setSelectedHandleSide,
    getActiveGlazingBeadCode,
    getActiveGasketCode,
    updateGlazingBeadToggleLabels,
    updateGasketToggleLabels,
    updateComponentPictures,
    openCadReferenceModal,
    closeCadReferenceModal,
    setSelectedARPlatform,
    openQRModal,
    closeQRModal,
    downloadLatestARAsset,
    checkLatestStaticModel,
    startAR,
}) {
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
        const controlsPanel = document.getElementById('controls');
        const collapsed = controlsPanel?.classList.contains('sidebar-collapsed') || false;
        setSidebarCollapsed(!collapsed);
    });

    let pendingWindowRebuildTimer = null;
    let lastSizeRebuildAt = 0;
    let sizeChangeInFlight = false;
    let flushSizeChangeAfterFlight = false;
    const pendingSizeAxes = new Set();

    const widthValueInput = document.getElementById('valWidth');
    const heightValueInput = document.getElementById('valHeight');

    function updateSizeLabelsOnly() {
        const width = Number.parseFloat(widthInput.value) || WINDOW_WIDTH_MAX_M;
        const height = Number.parseFloat(heightInput.value) || 1.5;
        if (widthValueInput) {
            widthValueInput.max = String(Math.round(Number(widthInput.max) * 1000));
            widthValueInput.value = String(Math.round(width * 1000));
        }
        if (heightValueInput) {
            heightValueInput.max = String(Math.round(Number(heightInput.max) * 1000));
            heightValueInput.value = String(Math.round(height * 1000));
        }
    }

    function getRangeBoundsMm(rangeInput) {
        return {
            minMm: Math.round(Number.parseFloat(rangeInput.min) * 1000),
            maxMm: Math.round(Number.parseFloat(rangeInput.max) * 1000),
        };
    }

    function clampSizeMm(rangeInput, requestedMm) {
        const { minMm, maxMm } = getRangeBoundsMm(rangeInput);
        return Math.min(maxMm, Math.max(minMm, Math.round(requestedMm)));
    }

    function writeSizeInputs(valueInput, rangeInput, nextMm) {
        const clampedMm = clampSizeMm(rangeInput, nextMm);
        valueInput.value = String(clampedMm);
        rangeInput.value = (clampedMm / 1000).toFixed(3);
        return clampedMm;
    }

    function commitSizeTextInput(valueInput, rangeInput, axis) {
        if (!valueInput || !rangeInput || valueInput.disabled) return false;
        const requestedMm = Number.parseFloat(valueInput.value);
        if (!Number.isFinite(requestedMm)) {
            updateSizeLabelsOnly();
            return false;
        }
        writeSizeInputs(valueInput, rangeInput, requestedMm);
        flushWindowSizeRebuild(axis);
        return true;
    }

    function stepSizeTextInput(valueInput, rangeInput, axis, deltaMm) {
        if (!valueInput || !rangeInput || valueInput.disabled) return;
        const typedMm = Number.parseFloat(valueInput.value);
        const rangeMm = Math.round((Number.parseFloat(rangeInput.value) || 0) * 1000);
        const baseMm = Number.isFinite(typedMm) ? typedMm : rangeMm;
        writeSizeInputs(valueInput, rangeInput, baseMm + deltaMm);
        flushWindowSizeRebuild(axis);
    }

    function queueSizeAxis(axis) {
        if (axis === 'width' || axis === 'height') pendingSizeAxes.add(axis);
    }

    function getSizeAxisValue(axis) {
        return axis === 'width'
            ? Number.parseFloat(widthInput.value)
            : Number.parseFloat(heightInput.value);
    }

    async function emitPendingWindowSizeChange() {
        if (sizeChangeInFlight) {
            flushSizeChangeAfterFlight = true;
            return;
        }

        const payload = {};
        pendingSizeAxes.forEach(axis => {
            const value = getSizeAxisValue(axis);
            if (!Number.isFinite(value)) return;
            payload[axis === 'width' ? 'widthM' : 'heightM'] = value;
        });
        pendingSizeAxes.clear();

        if (!Object.keys(payload).length) return;

        if (typeof onWindowSizeChange !== 'function') {
            buildWindow();
            return;
        }

        sizeChangeInFlight = true;
        try {
            await onWindowSizeChange(payload);
        } catch (error) {
            console.error('Unable to resize selected window:', error);
        } finally {
            sizeChangeInFlight = false;
            if (pendingSizeAxes.size || flushSizeChangeAfterFlight) {
                flushSizeChangeAfterFlight = false;
                requestAnimationFrame(() => {
                    void emitPendingWindowSizeChange();
                });
            }
        }
    }

    function flushWindowSizeRebuild(axis = null) {
        queueSizeAxis(axis);
        if (pendingWindowRebuildTimer !== null) {
            clearTimeout(pendingWindowRebuildTimer);
            pendingWindowRebuildTimer = null;
        }

        lastSizeRebuildAt = performance.now();
        void emitPendingWindowSizeChange();
    }

    function triggerWindowRebuild(axis) {
        queueSizeAxis(axis);
        updateSizeLabelsOnly();

        const elapsed = performance.now() - lastSizeRebuildAt;
        if (elapsed >= SIZE_REBUILD_INTERVAL_MS && pendingWindowRebuildTimer === null) {
            flushWindowSizeRebuild();
            return;
        }

        if (pendingWindowRebuildTimer === null) {
            pendingWindowRebuildTimer = setTimeout(() => {
                pendingWindowRebuildTimer = null;
                lastSizeRebuildAt = performance.now();
                void emitPendingWindowSizeChange();
            }, Math.max(0, SIZE_REBUILD_INTERVAL_MS - elapsed));
        }
    }

    widthInput.addEventListener('input', () => triggerWindowRebuild('width'));
    heightInput.addEventListener('input', () => triggerWindowRebuild('height'));
    widthInput.addEventListener('change', () => flushWindowSizeRebuild('width'));
    heightInput.addEventListener('change', () => flushWindowSizeRebuild('height'));

    const bindSizeTextInput = (valueInput, rangeInput, axis) => {
        if (!valueInput) return;
        valueInput.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            commitSizeTextInput(valueInput, rangeInput, axis);
        });
        // Number inputs fire change when their edited value is committed by
        // clicking/tabbing elsewhere, which should resize the selected window.
        valueInput.addEventListener('change', () => {
            commitSizeTextInput(valueInput, rangeInput, axis);
        });
    };

    bindSizeTextInput(widthValueInput, widthInput, 'width');
    bindSizeTextInput(heightValueInput, heightInput, 'height');

    document.getElementById('btnWidthDec').addEventListener('click', () => {
        stepSizeTextInput(widthValueInput, widthInput, 'width', -1);
    });
    document.getElementById('btnWidthInc').addEventListener('click', () => {
        stepSizeTextInput(widthValueInput, widthInput, 'width', 1);
    });
    document.getElementById('btnHeightDec').addEventListener('click', () => {
        stepSizeTextInput(heightValueInput, heightInput, 'height', -1);
    });
    document.getElementById('btnHeightInc').addEventListener('click', () => {
        stepSizeTextInput(heightValueInput, heightInput, 'height', 1);
    });

    const toggleSectionButton = document.getElementById('toggleSectionViewBtn');
    if (toggleSectionButton) {
        toggleSectionButton.addEventListener('click', () => {
            const isActive = toggleSectionButton.classList.toggle('active');
            sectionGroup.visible = isActive;
        });
    }

    let pendingGlassThicknessFrame = null;
    let lastRenderedGlazingBeadCode = getActiveGlazingBeadCode();
    let lastRenderedGasketCode = getActiveGasketCode();

    glassThicknessInput.addEventListener('input', () => {
        const thickness = Math.min(
            29,
            Math.max(16, Number.parseFloat(glassThicknessInput.value) || 24)
        );
        glassThicknessInput.value = String(thickness);

        if (glassThicknessLabel) {
            glassThicknessLabel.textContent = `${thickness.toFixed(0)} mm`;
        }

        updateComponentPictures();

        if (pendingGlassThicknessFrame !== null) {
            return;
        }

        pendingGlassThicknessFrame = requestAnimationFrame(() => {
            pendingGlassThicknessFrame = null;

            const nextBeadCode = getActiveGlazingBeadCode();
            if (nextBeadCode !== lastRenderedGlazingBeadCode) {
                lastRenderedGlazingBeadCode = nextBeadCode;
                updateGlazingBeadToggleLabels();
            }

            const nextGasketCode = getActiveGasketCode();
            if (nextGasketCode !== lastRenderedGasketCode) {
                lastRenderedGasketCode = nextGasketCode;
                updateGasketToggleLabels();
            }

            buildWindow();
        });
    });

    document.getElementById('cExplode').addEventListener('change', (event) => {
        const exploded = event.target.checked;
        setExploded(exploded);
        if (!exploded) {
            componentSelection.clear();
        }
    });

    document.getElementById('mBatant').addEventListener('change', buildWindow);
    document.getElementById('mOscilo').addEventListener('change', buildWindow);


    const batantButton = document.getElementById('btnModeBatant');
    const osciloButton = document.getElementById('btnModeOscilo');
    if (batantButton && osciloButton) {
        batantButton.addEventListener('click', () => {
            document.getElementById('mBatant').checked = true;
            document.getElementById('mOscilo').checked = false;
            syncModeButtons();
            buildWindow();
        });
        osciloButton.addEventListener('click', () => {
            document.getElementById('mOscilo').checked = true;
            document.getElementById('mBatant').checked = false;
            syncModeButtons();
            buildWindow();
        });
    }

    document.getElementById('side_top').addEventListener('change', buildWindow);
    document.getElementById('side_bottom').addEventListener('change', buildWindow);
    document.getElementById('side_left').addEventListener('change', buildWindow);
    document.getElementById('side_right').addEventListener('change', buildWindow);
    document.getElementById('cShowHouse').addEventListener('change', buildWindow);

    cadReferenceButton.addEventListener('click', openCadReferenceModal);
    document.getElementById('cad-reference-close').addEventListener('click', closeCadReferenceModal);
    cadReferenceModal.addEventListener('click', (event) => {
        if (event.target.id === 'cad-reference-modal') {
            closeCadReferenceModal();
        }
    });

    document.querySelectorAll('.ar-platform-option').forEach(button => {
        button.addEventListener('click', () => {
            setSelectedARPlatform(button.dataset.platform);
        });
    });

    document.getElementById('qr-ar-button').addEventListener('click', openQRModal);
    document.getElementById('qr-close').addEventListener('click', closeQRModal);
    document.getElementById('qr-download-model').addEventListener('click', downloadLatestARAsset);
    document.getElementById('qr-check-published').addEventListener('click', checkLatestStaticModel);
    document.getElementById('qr-modal').addEventListener('click', (event) => {
        if (event.target.id === 'qr-modal') {
            closeQRModal();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            componentSelection.clear();
            closeQRModal();
            closeCadReferenceModal();
        }
    });

    document.getElementById('ar-start-button').addEventListener('click', startAR);

    let pendingViewportResizeFrame = null;
    window.addEventListener('resize', () => {
        if (pendingViewportResizeFrame !== null) return;
        pendingViewportResizeFrame = requestAnimationFrame(() => {
            pendingViewportResizeFrame = null;
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    });
}
