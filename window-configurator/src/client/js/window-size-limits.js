import { WINDOW_SLIDER_LIMITS } from './window-settings.js';
import { WINDOW_SIZE_CONTROLS, applyWindowSliderBounds } from '../../../../shared-ui/src/windowSizeSettings.js?v=1';
import { getGlazingBeadCode } from './config.js';
import {
    WINDOW_PROFILE_MANUFACTURING_DATA,
    WINDOW_PROFILE_NON_ALUMINIUM_DATA,
} from './window-summary.js';
import {
    SASH_WINDOW_TYPE,
    getWindowActualSizeInState,
} from './window-layout-state.js';

export const MAX_INDIVIDUAL_WINDOW_WIDTH_M = 2.5;
export const MAX_INDIVIDUAL_WINDOW_HEIGHT_M = 2.5;
export const MAX_OVERALL_LAYOUT_WIDTH_M = 25;
export const MAX_OVERALL_LAYOUT_HEIGHT_M = 25;
export const MAX_OPENING_SASH_WEIGHT_KG = 130;

// The configurator stores the complete insulating-glass-unit thickness, not
// solid-glass thickness. The usual double-glazed make-up uses two 4 mm panes,
// which is approximately 20 kg/m² of actual glass. The spacer/cavity does not
// add glass mass and therefore must not be treated as solid glass.
export const DEFAULT_GLASS_WEIGHT_KG_PER_SQM = 20;

const MIN_WINDOW_M = 0.45;
const SASH_FROM_FRAME_END_INSET_M = 0.027;
const BEAD_FROM_SASH_END_INSET_M = 0.049;
const LIMIT_EPSILON = 1e-6;

function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function profileLinearMassKgPerM(profileId, fallback = 0) {
    const id = String(profileId || '');
    return finite(WINDOW_PROFILE_MANUFACTURING_DATA[id]?.kgPerM, fallback)
        + finite(WINDOW_PROFILE_NON_ALUMINIUM_DATA[id]?.kgPerM, 0);
}

function glazingBeadLinearMassKgPerM(profileId) {
    const id = String(profileId || '');
    return finite(WINDOW_PROFILE_MANUFACTURING_DATA[id]?.kgPerM, 0.369);
}

/**
 * Conservative AW CT 65 operable-leaf mass estimate for the documented
 * sash + glazing bead + glass 130 kg limit.
 *
 * Frame/mullion and hardware are intentionally excluded. The smallest normal
 * sash inset (27 mm at an outer frame) is used on every side, so divider/transom
 * cases with larger insets are never underestimated. The pane area is taken as
 * the complete sash clear rectangle; the real pane is slightly smaller.
 */
export function estimateOpeningSashWeightKg({
    widthM,
    heightM,
    sashProfileId = '575790',
    glazingBeadCode = '573940',
    glassWeightKgPerSqm = DEFAULT_GLASS_WEIGHT_KG_PER_SQM,
} = {}) {
    const width = Math.max(0, finite(widthM));
    const height = Math.max(0, finite(heightM));
    if (width <= 0 || height <= 0) return 0;

    const sashHorizontal = Math.max(0, width - SASH_FROM_FRAME_END_INSET_M * 2);
    const sashVertical = Math.max(0, height - SASH_FROM_FRAME_END_INSET_M * 2);
    const sashPerimeter = 2 * (sashHorizontal + sashVertical);

    const beadHorizontal = Math.max(0, sashHorizontal - BEAD_FROM_SASH_END_INSET_M * 2);
    const beadVertical = Math.max(0, sashVertical - BEAD_FROM_SASH_END_INSET_M * 2);
    const beadPerimeter = 2 * (beadHorizontal + beadVertical);

    const sashMassPerM = profileLinearMassKgPerM(sashProfileId, 1.534);
    const beadMassPerM = glazingBeadLinearMassKgPerM(glazingBeadCode);
    const glassMassPerSqm = Math.max(0, finite(
        glassWeightKgPerSqm,
        DEFAULT_GLASS_WEIGHT_KG_PER_SQM
    ));
    const glassAreaSqm = sashHorizontal * sashVertical;

    return sashPerimeter * sashMassPerM
        + beadPerimeter * beadMassPerM
        + glassAreaSqm * glassMassPerSqm;
}

function maximumOpeningSashWidthForHeightM({
    heightM,
    sashProfileId = '575790',
    glazingBeadCode = '573940',
    glassWeightKgPerSqm = DEFAULT_GLASS_WEIGHT_KG_PER_SQM,
} = {}) {
    const height = Math.max(0, finite(heightM));
    if (height <= 0) return null;

    const weightAt = widthM => estimateOpeningSashWeightKg({
        widthM,
        heightM: height,
        sashProfileId,
        glazingBeadCode,
        glassWeightKgPerSqm,
    });

    // If even the configurator's minimum width is over the leaf-weight limit,
    // reducing width cannot solve the problem at this height.
    if (weightAt(MIN_WINDOW_M) > MAX_OPENING_SASH_WEIGHT_KG + LIMIT_EPSILON) {
        return null;
    }

    if (weightAt(MAX_INDIVIDUAL_WINDOW_WIDTH_M) <= MAX_OPENING_SASH_WEIGHT_KG + LIMIT_EPSILON) {
        return MAX_INDIVIDUAL_WINDOW_WIDTH_M;
    }

    // Leaf weight grows monotonically with width, so binary search gives the
    // largest width that still stays at or below 130 kg for the current height.
    let low = MIN_WINDOW_M;
    let high = MAX_INDIVIDUAL_WINDOW_WIDTH_M;
    for (let iteration = 0; iteration < 48; iteration += 1) {
        const middle = (low + high) / 2;
        if (weightAt(middle) <= MAX_OPENING_SASH_WEIGHT_KG + LIMIT_EPSILON) {
            low = middle;
        } else {
            high = middle;
        }
    }
    return low;
}

function currentLocale() {
    return String(
        globalThis.window?.WINDOW_CONFIGURATOR_SHARED_SHELL?.state?.locale
        || document?.documentElement?.lang
        || 'en-US'
    );
}

function localizedViolationMessage(violation) {
    const locale = currentLocale();
    const number = violation.windowNumber;
    const widthMm = Math.round(violation.widthM * 1000);
    const heightMm = Math.round(violation.heightM * 1000);
    const language = locale.startsWith('ro') ? 'ro' : (locale.startsWith('de') ? 'de' : 'en');

    if (violation.type === 'dimension') {
        const tooWide = Boolean(violation.tooWide);
        const tooTall = Boolean(violation.tooTall);
        const maxWidthMm = Math.round(MAX_INDIVIDUAL_WINDOW_WIDTH_M * 1000);
        const maxHeightMm = Math.round(MAX_INDIVIDUAL_WINDOW_HEIGHT_M * 1000);

        if (tooTall && !tooWide) {
            const reductionMm = Math.max(1, heightMm - maxHeightMm);
            if (language === 'ro') {
                return `Fereastra ${number} este prea înaltă: ${heightMm} mm. Înălțimea maximă este ${maxHeightMm} mm. Reduceți înălțimea cu cel puțin ${reductionMm} mm înainte de a o adăuga în coș.`;
            }
            if (language === 'de') {
                return `Fenster ${number} ist zu hoch: ${heightMm} mm. Die maximale Höhe beträgt ${maxHeightMm} mm. Reduzieren Sie die Höhe um mindestens ${reductionMm} mm, bevor Sie das Fenster zum Warenkorb hinzufügen.`;
            }
            return `Window ${number} is too tall: ${heightMm} mm. Maximum height is ${maxHeightMm} mm. Reduce the height by at least ${reductionMm} mm before adding it to the cart.`;
        }

        if (tooWide && !tooTall) {
            const reductionMm = Math.max(1, widthMm - maxWidthMm);
            if (language === 'ro') {
                return `Fereastra ${number} este prea lată: ${widthMm} mm. Lățimea maximă este ${maxWidthMm} mm. Reduceți lățimea cu cel puțin ${reductionMm} mm înainte de a o adăuga în coș.`;
            }
            if (language === 'de') {
                return `Fenster ${number} ist zu breit: ${widthMm} mm. Die maximale Breite beträgt ${maxWidthMm} mm. Reduzieren Sie die Breite um mindestens ${reductionMm} mm, bevor Sie das Fenster zum Warenkorb hinzufügen.`;
            }
            return `Window ${number} is too wide: ${widthMm} mm. Maximum width is ${maxWidthMm} mm. Reduce the width by at least ${reductionMm} mm before adding it to the cart.`;
        }

        const widthReductionMm = Math.max(1, widthMm - maxWidthMm);
        const heightReductionMm = Math.max(1, heightMm - maxHeightMm);
        if (language === 'ro') {
            return `Fereastra ${number} este prea lată și prea înaltă (${widthMm} × ${heightMm} mm). Limita este ${maxWidthMm} × ${maxHeightMm} mm. Reduceți lățimea cu cel puțin ${widthReductionMm} mm și înălțimea cu cel puțin ${heightReductionMm} mm.`;
        }
        if (language === 'de') {
            return `Fenster ${number} ist zu breit und zu hoch (${widthMm} × ${heightMm} mm). Zulässig sind maximal ${maxWidthMm} × ${maxHeightMm} mm. Reduzieren Sie die Breite um mindestens ${widthReductionMm} mm und die Höhe um mindestens ${heightReductionMm} mm.`;
        }
        return `Window ${number} is too wide and too tall (${widthMm} × ${heightMm} mm). Maximum size is ${maxWidthMm} × ${maxHeightMm} mm. Reduce width by at least ${widthReductionMm} mm and height by at least ${heightReductionMm} mm.`;
    }

    const formattedWeight = Number(violation.weightKg).toFixed(1);
    const maximumWidthMm = Number.isFinite(violation.maximumWidthM)
        ? Math.floor(violation.maximumWidthM * 1000 + 1e-9)
        : null;

    if (maximumWidthMm !== null) {
        const minimumReductionMm = Math.max(1, widthMm - maximumWidthMm);
        if (language === 'ro') {
            return `Fereastra ${number} este prea grea: aproximativ ${formattedWeight} kg, peste limita de ${MAX_OPENING_SASH_WEIGHT_KG} kg. La înălțimea de ${heightMm} mm, lățimea trebuie să fie de maximum ${maximumWidthMm} mm. Reduceți lățimea cu cel puțin ${minimumReductionMm} mm.`;
        }
        if (language === 'de') {
            return `Fenster ${number} ist zu schwer: geschätzt ${formattedWeight} kg, über dem Grenzwert von ${MAX_OPENING_SASH_WEIGHT_KG} kg. Bei ${heightMm} mm Höhe darf die Breite höchstens ${maximumWidthMm} mm betragen. Reduzieren Sie die Breite um mindestens ${minimumReductionMm} mm.`;
        }
        return `Window ${number} is too heavy: estimated ${formattedWeight} kg, above the ${MAX_OPENING_SASH_WEIGHT_KG} kg limit. At ${heightMm} mm high, the width must be ${maximumWidthMm} mm or less. Reduce the width by at least ${minimumReductionMm} mm.`;
    }

    if (language === 'ro') {
        return `Fereastra ${number} este prea grea: aproximativ ${formattedWeight} kg, peste limita de ${MAX_OPENING_SASH_WEIGHT_KG} kg. La înălțimea de ${heightMm} mm, reducerea doar a lățimii până la minimul configuratorului nu este suficientă; reduceți și înălțimea.`;
    }
    if (language === 'de') {
        return `Fenster ${number} ist zu schwer: geschätzt ${formattedWeight} kg, über dem Grenzwert von ${MAX_OPENING_SASH_WEIGHT_KG} kg. Bei ${heightMm} mm Höhe reicht selbst die minimale Konfiguratorbreite nicht aus; reduzieren Sie auch die Höhe.`;
    }
    return `Window ${number} is too heavy: estimated ${formattedWeight} kg, above the ${MAX_OPENING_SASH_WEIGHT_KG} kg limit. At ${heightMm} mm high, even the configurator's minimum width is not enough; reduce the height as well.`;
}

function resolveLeafProfiles(snapshot = {}) {
    const thickness = finite(
        snapshot.glassThicknessMm,
        finite(document?.getElementById?.('glassThickness')?.value, 24)
    );
    return {
        sashProfileId: String(
            snapshot.sashProfileId
            || document?.getElementById?.('sashProfile')?.value
            || '575790'
        ),
        glazingBeadCode: String(
            snapshot.glazingBeadCode
            || getGlazingBeadCode(thickness)
            || '573940'
        ),
    };
}

export function validateWindowConfigurationForCart(snapshot = null) {
    const current = snapshot || globalThis.window?.WINDOW_CONFIGURATOR_API?.captureState?.();
    const state = current?.windowState;
    const windows = state?.windows || [];
    if (!state || !windows.length) return { valid: true, violation: null, message: '' };

    const leafProfiles = resolveLeafProfiles(current || {});

    for (let index = 0; index < windows.length; index += 1) {
        const cell = windows[index];
        const size = getWindowActualSizeInState(state, cell.id);
        const widthM = finite(size?.widthM);
        const heightM = finite(size?.heightM);
        const tooWide = widthM > MAX_INDIVIDUAL_WINDOW_WIDTH_M + LIMIT_EPSILON;
        const tooTall = heightM > MAX_INDIVIDUAL_WINDOW_HEIGHT_M + LIMIT_EPSILON;

        if (tooWide || tooTall) {
            const violation = {
                type: 'dimension',
                windowNumber: index + 1,
                cellId: cell.id,
                widthM,
                heightM,
                tooWide,
                tooTall,
            };
            return {
                valid: false,
                violation,
                message: localizedViolationMessage(violation),
            };
        }

        if (cell?.type !== SASH_WINDOW_TYPE) continue;
        const weightKg = estimateOpeningSashWeightKg({
            widthM,
            heightM,
            ...leafProfiles,
        });
        if (weightKg > MAX_OPENING_SASH_WEIGHT_KG + LIMIT_EPSILON) {
            const maximumWidthM = maximumOpeningSashWidthForHeightM({
                heightM,
                ...leafProfiles,
            });
            const violation = {
                type: 'weight',
                windowNumber: index + 1,
                cellId: cell.id,
                widthM,
                heightM,
                weightKg,
                maximumWidthM,
            };
            return {
                valid: false,
                violation,
                message: localizedViolationMessage(violation),
            };
        }
    }

    return { valid: true, violation: null, message: '' };
}

// Slider settings are independent of the existing manufacturing/cart checks above.
function installWindowSizeAndCartLimits() {
    if (globalThis.__WINDOW_SIZE_AND_CART_LIMITS_INSTALLED__) return;
    globalThis.__WINDOW_SIZE_AND_CART_LIMITS_INSTALLED__ = true;
    const controls = WINDOW_SIZE_CONTROLS.map(control => ({
        ...control,
        range: document.getElementById(control.rangeId),
        number: document.getElementById(control.valueId),
    }));
    const syncBounds = () => applyWindowSliderBounds(WINDOW_SLIDER_LIMITS);
    const clampControl = target => {
        if (!(target instanceof HTMLInputElement)) return;
        const control = controls.find(entry => target === entry.range || target === entry.number);
        if (!control || target.disabled) return;
        syncBounds();
        const meters = target === control.number ? Number(target.value) / 1000 : Number(target.value);
        if (!Number.isFinite(meters) || target.value.trim() === '') return;
        const min = Number(control.range.min);
        const max = Number(control.range.max);
        const value = clamp(meters, min, max);
        control.range.value = value.toFixed(3);
        if (control.number) control.number.value = String(Math.round(value * 1000));
    };
    // Allow typing intermediate numbers naturally; constrain only on commit.
    document.addEventListener('input', event => {
        if (event.target?.type === 'range') clampControl(event.target);
    }, true);
    document.addEventListener('change', event => clampControl(event.target), true);
    document.addEventListener('keydown', event => {
        if (event.key === 'Enter') clampControl(event.target);
    }, true);
    document.addEventListener('input', syncBounds);
    document.addEventListener('change', syncBounds);

    // The common Add to cart handler lives inside the shared configurator footer.
    // Validate during capture so an invalid window never reaches that handler.
    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        const addButton = target?.closest?.('[data-shared-panel-add-to-cart]');
        if (!addButton) return;

        const result = validateWindowConfigurationForCart();
        if (result.valid) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        globalThis.window?.WINDOW_CONFIGURATOR_SHARED_SHELL?.showFeedback?.(
            result.message,
            'error',
            5000
        );
    }, true);

    ['window-pricing-updated', 'window-shared-shell-ready', 'window-locale-applied']
        .forEach(name => window.addEventListener(name, syncBounds));
    // Selection/restoration code can rewrite max attributes. Reapply settings
    // without touching model state or number values, and only write changed attributes.
    const observer = new MutationObserver(syncBounds);
    for (const { range, number } of controls) {
        for (const input of [range, number]) if (input) observer.observe(input, {
            attributes: true, attributeFilter: ['min', 'max'],
        });
    }
    syncBounds();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    globalThis.WINDOW_SIZE_LIMITS_API = Object.freeze({
        validateForCart: validateWindowConfigurationForCart,
        estimateOpeningSashWeightKg,
    });
    installWindowSizeAndCartLimits();
}
