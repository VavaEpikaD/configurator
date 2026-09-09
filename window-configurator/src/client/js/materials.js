import * as THREE from 'three';
import { MaterialLibrary } from '../shared-3d/src/index.js?v=6';
import {
    ALUMINIUM_FINISH_CATALOG,
    FIXED_PROFILE_COLOURS,
    normalizeHexColour,
    normalizeRequestedColour,
    getFinishDefinition,
    createFinishSelection,
    createRalFinishSelectionFromColour,
} from './config.js';
import { isDrainageCapProfile } from './profile-catalog.js';
import { getWindowLocale, localizeFinishSelection, windowT } from './i18n.js';

export function createMaterialManager({
    surfaceLibrary = null,
    captureMode,
    pageParams,
    requestedColour,
    getProfilesData,
    hasCurrentMetadata,
    invalidateSectionSamples,
    renderGroupFilters,
    buildWindow,
}) {
    const surfaces = surfaceLibrary || new MaterialLibrary(THREE, { quality: captureMode ? 'low' : 'balanced' });

    function createFinishSelectionFromParams(side, fallbackSelection) {
        const type = pageParams.get(`${side}_finish_type`);
        const preset = pageParams.get(`${side}_finish_preset`);
        const colour = normalizeHexColour(pageParams.get(`${side}_colour`));

        if (!ALUMINIUM_FINISH_CATALOG[type]) {
            return fallbackSelection;
        }

        if (type === 'coated' && colour) {
            return createRalFinishSelectionFromColour(colour);
        }

        return createFinishSelection(type, preset);
    }

    const normalizedRequestedColour = normalizeRequestedColour(requestedColour);
    let aluminiumFinishMode = pageParams.get('finish_mode') === 'different' ? 'different' : 'same';
    let outsideFinishSelection = normalizedRequestedColour
        ? createRalFinishSelectionFromColour(normalizedRequestedColour)
        : createFinishSelection('mill', 'natural');
    let insideFinishSelection = createFinishSelection('mill', 'natural');

    outsideFinishSelection = createFinishSelectionFromParams('outside', outsideFinishSelection);
    insideFinishSelection = createFinishSelectionFromParams('inside', insideFinishSelection);

    let configurationColour = outsideFinishSelection.color;
    let debugColoursEnabled = pageParams.get('debug_colors') !== '0';

    function createSurfaceMaterial(options) {
        const materialOptions = {
            color: options.color,
            side: options.side || THREE.DoubleSide,
            transparent: options.transparent || false,
            opacity: options.opacity ?? 1,
        };

        if (captureMode) {
            return new THREE.MeshPhongMaterial({
                ...materialOptions,
                shininess: options.shininess ?? 45,
            });
        }

        return new THREE.MeshStandardMaterial({
            ...materialOptions,
            metalness: options.metalness ?? 0.1,
            roughness: options.roughness ?? 0.7,
        });
    }

    const glassMat = surfaces.create('glass.clear', { thickness: 0.006 });
    const handleMat = surfaces.create('aluminium.powderCoated', {
        color: '#1f2937', roughness: 0.48, envMapIntensity: 0.82,
    });

    const profileMaterialCache = new Map();

    const materialPropertiesByKey = {
        alu: { metalness: 0.82, roughness: 0.28, shininess: 105 },
        iso: { metalness: 0.1, roughness: 0.7, shininess: 20 },
        centralSeal: { metalness: 0.1, roughness: 0.6, shininess: 40 },
        epdm: { metalness: 0.05, roughness: 0.8, shininess: 15 },
        foam: { metalness: 0.0, roughness: 0.95, shininess: 10 },
        glass: {
            transparent: true,
            opacity: 0.25,
            metalness: 0.9,
            roughness: 0.1,
            shininess: 90,
        },
        default: { metalness: 0.5, roughness: 0.5, shininess: 35 },
    };

    function isDrainageCoverCap(profile) {
        return isDrainageCapProfile(profile)
            || normalizeHexColour(profile?.baseCadColor) === '#cc9966';
    }

    function usesAluminiumFinish(profile) {
        return profile?.materialKey === 'alu' || isDrainageCoverCap(profile);
    }

    function getEffectiveAluminiumFinish(profile) {
        if (isDrainageCoverCap(profile)) {
            return outsideFinishSelection;
        }
        if (profile.aluminiumSide === 'inside' && aluminiumFinishMode === 'different') {
            return insideFinishSelection;
        }
        return outsideFinishSelection;
    }

    function getResolvedProfileColour(profile) {
        if (debugColoursEnabled) {
            return normalizeHexColour(profile.baseCadColor)
                || FIXED_PROFILE_COLOURS.default;
        }
        if (usesAluminiumFinish(profile)) {
            return getEffectiveAluminiumFinish(profile).color;
        }
        return FIXED_PROFILE_COLOURS[profile.materialKey]
            || normalizeHexColour(profile.baseCadColor)
            || FIXED_PROFILE_COLOURS.default;
    }

    function resolveDisplayColour(profile) {
        return getResolvedProfileColour(profile);
    }

    function makeColourIndicatorBackground(profiles) {
        const colours = [...new Set(
            profiles
                .map(profile => resolveDisplayColour(profile))
                .filter(Boolean)
                .map(colour => colour.toLowerCase())
        )];

        if (colours.length === 0) {
            return FIXED_PROFILE_COLOURS.default;
        }
        if (colours.length === 1) {
            return colours[0];
        }

        const visibleColours = colours.slice(0, 4);
        const stopSize = 100 / visibleColours.length;
        const stops = visibleColours.flatMap((colour, index) => {
            const start = (index * stopSize).toFixed(2);
            const end = ((index + 1) * stopSize).toFixed(2);
            return [`${colour} ${start}%`, `${colour} ${end}%`];
        });
        return `linear-gradient(90deg, ${stops.join(', ')})`;
    }

    function setColourIndicatorBackground(element, background) {
        if (!element) return;
        if (String(background).startsWith('linear-gradient(')) {
            element.style.backgroundColor = 'transparent';
            element.style.backgroundImage = background;
        } else {
            element.style.backgroundImage = 'none';
            element.style.backgroundColor = background;
        }
    }

    function updateProfileColourIndicators() {
        getProfilesData().forEach(profile => {
            const checkbox = document.getElementById(`toggle_${profile.index}`);
            const dot = checkbox?.closest('.part-toggle-item')?.querySelector('.part-color-dot');
            setColourIndicatorBackground(dot, resolveDisplayColour(profile));
        });
    }

    function getMaterialForProfile(profile) {
        const colour = getResolvedProfileColour(profile).toLowerCase();
        const usesFinish = !debugColoursEnabled && usesAluminiumFinish(profile);
        const materialKey = usesFinish
            ? 'alu'
            : (materialPropertiesByKey[profile.materialKey] ? profile.materialKey : 'default');
        const finish = usesFinish ? getEffectiveAluminiumFinish(profile) : null;
        const finishType = finish?.type || (debugColoursEnabled ? 'debug' : 'fixed');
        const materialProperties = finish
            ? getFinishDefinition(finish.type).material
            : materialPropertiesByKey[materialKey];
        const cacheKey = `${debugColoursEnabled ? 'debug' : 'finish'}:${materialKey}:${finishType}:${colour}`;

        if (!profileMaterialCache.has(cacheKey)) {
            profileMaterialCache.set(
                cacheKey,
                finish
                    ? surfaces.create({
                        mill: 'aluminium.bare',
                        anodized: 'aluminium.anodized',
                        coated: 'aluminium.powderCoated',
                    }[finish.type] || 'aluminium.powderCoated', {
                        color: colour, side: THREE.DoubleSide,
                    })
                    : (!debugColoursEnabled && materialKey === 'glass'
                        ? surfaces.create('glass.clear')
                        : createSurfaceMaterial({ color: colour, ...materialProperties }))
            );
        }

        return profileMaterialCache.get(cacheKey);
    }

    function clearCachedAluminiumMaterials() {
        for (const [cacheKey, material] of profileMaterialCache.entries()) {
            if (cacheKey.includes(':alu:')) {
                material.dispose();
                profileMaterialCache.delete(cacheKey);
            }
        }
    }

    function clearAllCachedProfileMaterials() {
        for (const material of profileMaterialCache.values()) {
            material.dispose();
        }
        profileMaterialCache.clear();
    }

    function getFinishSelection(side) {
        return side === 'inside' ? insideFinishSelection : outsideFinishSelection;
    }

    function setFinishSelection(side, selection) {
        if (side === 'inside') {
            insideFinishSelection = selection;
        } else {
            outsideFinishSelection = selection;
            configurationColour = selection.color;
        }
    }

    function getFinishUi(side) {
        const prefix = side === 'inside' ? 'inside' : 'outside';
        const typeToggle = document.getElementById(`${prefix}FinishType`);
        return {
            typeToggle,
            typeButtons: typeToggle ? [...typeToggle.querySelectorAll('[data-finish-type]')] : [],
            swatches: document.getElementById(`${prefix}FinishSwatches`),
            selectedName: document.getElementById(`${prefix}FinishName`),
        };
    }

    function renderFinishSideControls(side) {
        const ui = getFinishUi(side);
        const selection = getFinishSelection(side);
        const definition = getFinishDefinition(selection.type);
        if (!ui.typeToggle || !ui.swatches) return;

        ui.typeButtons.forEach(button => {
            const isActive = button.dataset.finishType === selection.type;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        ui.swatches.innerHTML = '';
        ui.swatches.hidden = false;

        definition.presets.forEach(preset => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `finish-swatch${selection.presetId === preset.id ? ' active' : ''}`;
            button.style.setProperty('--swatch-color', preset.color);
            const presetLabel = windowT(
                getWindowLocale(),
                `finish.preset.${selection.type}.${preset.id}`
            );
            button.title = presetLabel;
            button.setAttribute('aria-label', presetLabel);
            button.setAttribute('aria-pressed', selection.presetId === preset.id ? 'true' : 'false');
            button.addEventListener('click', () => {
                const hadDebug = debugColoursEnabled;
                debugColoursEnabled = false;
                setFinishSelection(side, createFinishSelection(selection.type, preset.id));
                syncFinishControls();
                if (hadDebug) {
                    refreshAllProfileMaterials();
                } else {
                    refreshAluminiumFinishMaterials();
                }
            });
            ui.swatches.appendChild(button);
        });

        if (ui.selectedName) {
            ui.selectedName.textContent = localizeFinishSelection(getWindowLocale(), selection);
        }
    }

    function syncFinishControls() {
        const sameButton = document.getElementById('finishModeSame');
        const differentButton = document.getElementById('finishModeDifferent');
        const insideCard = document.getElementById('insideFinishCard');
        const outsideTitle = document.getElementById('outsideFinishTitle');
        const debugButton = document.getElementById('debugColorsButton');
        const debugToggle = document.getElementById('debugColorsToggle');

        sameButton?.classList.toggle('active', aluminiumFinishMode === 'same');
        differentButton?.classList.toggle('active', aluminiumFinishMode === 'different');
        if (debugToggle) {
            debugToggle.checked = debugColoursEnabled;
        }
        if (debugButton) {
            debugButton.classList.toggle('active', debugColoursEnabled);
            debugButton.setAttribute('aria-pressed', debugColoursEnabled ? 'true' : 'false');
        }
        if (insideCard) insideCard.hidden = aluminiumFinishMode === 'same';
        if (outsideTitle) {
            outsideTitle.textContent = windowT(
                getWindowLocale(),
                aluminiumFinishMode === 'same' ? 'finish.insideOutside' : 'finish.outside'
            );
        }

        renderFinishSideControls('outside');
        renderFinishSideControls('inside');
    }

    function refreshAluminiumFinishMaterials() {
        configurationColour = outsideFinishSelection.color;

        if (debugColoursEnabled) return;

        clearCachedAluminiumMaterials();
        getProfilesData().forEach(profile => {
            if (usesAluminiumFinish(profile)) {
                profile.material = getMaterialForProfile(profile);
            }
        });
        invalidateSectionSamples();

        if (hasCurrentMetadata()) {
            updateProfileColourIndicators();
            renderGroupFilters();
            buildWindow();
        }
    }

    function refreshAllProfileMaterials() {
        clearAllCachedProfileMaterials();
        getProfilesData().forEach(profile => {
            profile.material = getMaterialForProfile(profile);
        });
        invalidateSectionSamples();

        if (hasCurrentMetadata()) {
            updateProfileColourIndicators();
            renderGroupFilters();
            buildWindow();
        }
    }

    function initializeControls() {
        document.getElementById('finishModeSame')?.addEventListener('click', () => {
            if (aluminiumFinishMode === 'same') return;
            aluminiumFinishMode = 'same';
            syncFinishControls();
            refreshAluminiumFinishMaterials();
        });

        document.getElementById('finishModeDifferent')?.addEventListener('click', () => {
            if (aluminiumFinishMode === 'different') return;
            aluminiumFinishMode = 'different';
            syncFinishControls();
            refreshAluminiumFinishMaterials();
        });

        for (const side of ['outside', 'inside']) {
            const ui = getFinishUi(side);
            ui.typeButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const nextType = button.dataset.finishType;
                    if (!ALUMINIUM_FINISH_CATALOG[nextType]) return;
                    const currentSelection = getFinishSelection(side);
                    if (currentSelection.type === nextType && !debugColoursEnabled) return;
                    const hadDebug = debugColoursEnabled;
                    debugColoursEnabled = false;
                    setFinishSelection(side, createFinishSelection(nextType));
                    syncFinishControls();
                    if (hadDebug) {
                        refreshAllProfileMaterials();
                    } else {
                        refreshAluminiumFinishMaterials();
                    }
                });
            });
        }

        const handleDebugChange = (enabled) => {
            if (debugColoursEnabled === enabled) return;
            debugColoursEnabled = enabled;
            syncFinishControls();
            refreshAllProfileMaterials();
        };

        document.getElementById('debugColorsToggle')?.addEventListener('change', (e) => {
            handleDebugChange(Boolean(e.target.checked));
        });

        document.getElementById('debugColorsButton')?.addEventListener('click', () => {
            handleDebugChange(!debugColoursEnabled);
        });

        syncFinishControls();
    }

    function applyConfiguration(configuration) {
        let finishConfigurationChanged = false;
        const requestedFinishMode = configuration.finishMode || configuration.finish_mode;

        if (requestedFinishMode === 'same' || requestedFinishMode === 'different') {
            if (aluminiumFinishMode !== requestedFinishMode) {
                aluminiumFinishMode = requestedFinishMode;
                finishConfigurationChanged = true;
            }
        }

        if (typeof configuration.colour === 'string') {
            const nextConfigurationColour = normalizeRequestedColour(configuration.colour);
            if (nextConfigurationColour) {
                const nextOutsideFinish = createRalFinishSelectionFromColour(nextConfigurationColour);
                if (
                    nextOutsideFinish.color !== outsideFinishSelection.color
                    || outsideFinishSelection.type !== 'coated'
                    || outsideFinishSelection.presetId !== nextOutsideFinish.presetId
                ) {
                    setFinishSelection('outside', nextOutsideFinish);
                    finishConfigurationChanged = true;
                }

                if (!requestedFinishMode) {
                    aluminiumFinishMode = 'different';
                    insideFinishSelection = createFinishSelection('mill', 'natural');
                    finishConfigurationChanged = true;
                }
            }
        }

        const requestedInsideColour = normalizeRequestedColour(
            configuration.insideColour || configuration.inside_colour
        );
        if (requestedInsideColour) {
            insideFinishSelection = createRalFinishSelectionFromColour(requestedInsideColour);
            finishConfigurationChanged = true;
        }

        if (typeof configuration.debugColors === 'boolean') {
            debugColoursEnabled = configuration.debugColors;
        } else if (finishConfigurationChanged && (configuration.colour || configuration.insideColour || configuration.inside_colour)) {
            debugColoursEnabled = false;
        }

        if (finishConfigurationChanged) {
            configurationColour = outsideFinishSelection.color;
            if (!debugColoursEnabled) {
                clearAllCachedProfileMaterials();
            } else {
                clearCachedAluminiumMaterials();
            }
            syncFinishControls();
            invalidateSectionSamples();
        }

        return finishConfigurationChanged;
    }

    function getState() {
        return {
            aluminiumFinishMode,
            outsideFinishSelection,
            insideFinishSelection,
            configurationColour,
            debugColoursEnabled,
        };
    }

    function getFinishState() {
        return {
            aluminiumFinishMode,
            outsideFinishSelection,
            insideFinishSelection,
        };
    }

    function getConfigurationSnapshot() {
        return {
            colour: configurationColour,
            finishMode: aluminiumFinishMode,
            outsideFinish: { ...outsideFinishSelection },
            insideFinish: aluminiumFinishMode === 'same'
                ? { ...outsideFinishSelection }
                : { ...insideFinishSelection },
            debugColors: debugColoursEnabled,
        };
    }

    function appendUrlParams(url) {
        url.searchParams.set('finish_mode', aluminiumFinishMode);
        url.searchParams.set('colour', outsideFinishSelection.color);
        url.searchParams.set('outside_finish_type', outsideFinishSelection.type);
        url.searchParams.set('outside_finish_preset', outsideFinishSelection.presetId);
        url.searchParams.set('outside_colour', outsideFinishSelection.color);
        url.searchParams.set('inside_finish_type', insideFinishSelection.type);
        url.searchParams.set('inside_finish_preset', insideFinishSelection.presetId);
        url.searchParams.set('inside_colour', insideFinishSelection.color);
        url.searchParams.set('debug_colors', debugColoursEnabled ? '1' : '0');
    }

    globalThis.window?.addEventListener('window-locale-applied', () => {
        syncFinishControls();
    });

    return {
        glassMat,
        handleMat,
        resolveDisplayColour,
        makeColourIndicatorBackground,
        setColourIndicatorBackground,
        getMaterialForProfile,
        isDrainageCoverCap,
        initializeControls,
        applyConfiguration,
        getState,
        getFinishState,
        getConfigurationSnapshot,
        appendUrlParams,
    };
}
