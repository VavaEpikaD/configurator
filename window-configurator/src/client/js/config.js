import { getLegacyProfileSetIds } from './profile-catalog.js';
import {
    resolveGlazingBeadProfileId,
    resolveMovableGasketProfileId,
} from './profile-compatibility.js';

export const allowedProfiles = new Set(getLegacyProfileSetIds());

export const WINDOW_WIDTH_MIN_M = 0.45;
export const WINDOW_WIDTH_MAX_M = 2.5;
export const WINDOW_HEIGHT_MIN_M = 0.45;
export const WINDOW_HEIGHT_MAX_M = 2.5;
export const HOUSE_WIDTH_SWITCH_M = 1.2;
export const HOUSE_HEIGHT_SWITCH_M = (WINDOW_HEIGHT_MIN_M + WINDOW_HEIGHT_MAX_M) / 2;

export const ALUMINIUM_FINISH_CATALOG = Object.freeze({
    mill: Object.freeze({
        label: 'Mill finish',
        material: Object.freeze({ metalness: 0.82, roughness: 0.28, shininess: 105 }),
        presets: Object.freeze([
            Object.freeze({ id: 'natural', name: 'Natural aluminum gray', color: '#aeb4b9' }),
        ]),
    }),
    anodized: Object.freeze({
        label: 'Anodized',
        material: Object.freeze({ metalness: 0.68, roughness: 0.32, shininess: 92 }),
        presets: Object.freeze([
            Object.freeze({ id: 'natural', name: 'Natural anodized', color: '#9ca3a7' }),
            Object.freeze({ id: 'champagne', name: 'Champagne anodized', color: '#b0a184' }),
            Object.freeze({ id: 'light-bronze', name: 'Light bronze anodized', color: '#887863' }),
            Object.freeze({ id: 'dark-bronze', name: 'Dark bronze anodized', color: '#4d443a' }),
            Object.freeze({ id: 'black', name: 'Black anodized', color: '#24272b' }),
        ]),
    }),
    coated: Object.freeze({
        label: 'Color coated',
        material: Object.freeze({ metalness: 0.22, roughness: 0.46, shininess: 62 }),
        presets: Object.freeze([
            Object.freeze({ id: 'ral-9016', name: 'RAL 9016 – Traffic white', color: '#f1f0ea' }),
            Object.freeze({ id: 'ral-9010', name: 'RAL 9010 – Pure white', color: '#f1ece1' }),
            Object.freeze({ id: 'ral-9001', name: 'RAL 9001 – Cream', color: '#e9e0d2' }),
            Object.freeze({ id: 'ral-7035', name: 'RAL 7035 – Light grey', color: '#cbd0cc' }),
            Object.freeze({ id: 'ral-7040', name: 'RAL 7040 – Window grey', color: '#9da3a6' }),
            Object.freeze({ id: 'ral-7001', name: 'RAL 7001 – Silver grey', color: '#8a9597' }),
            Object.freeze({ id: 'ral-7016', name: 'RAL 7016 – Anthracite grey', color: '#383e42' }),
            Object.freeze({ id: 'ral-7021', name: 'RAL 7021 – Black grey', color: '#2f3234' }),
            Object.freeze({ id: 'ral-9005', name: 'RAL 9005 – Jet black', color: '#0a0a0d' }),
            Object.freeze({ id: 'ral-8014', name: 'RAL 8014 – Sepia brown', color: '#4a3526' }),
            Object.freeze({ id: 'ral-8017', name: 'RAL 8017 – Chocolate brown', color: '#45322e' }),
            Object.freeze({ id: 'ral-6005', name: 'RAL 6005 – Moss green', color: '#0f4336' }),
            Object.freeze({ id: 'ral-6009', name: 'RAL 6009 – Fir green', color: '#27352a' }),
            Object.freeze({ id: 'ral-3005', name: 'RAL 3005 – Wine red', color: '#5e2028' }),
            Object.freeze({ id: 'ral-5011', name: 'RAL 5011 – Steel blue', color: '#1f2a44' }),
        ]),
    }),
});

export const FIXED_PROFILE_COLOURS = Object.freeze({
    epdm: '#20242a',
    centralSeal: '#2f343a',
    iso: '#41474e',
    foam: '#9aa1a8',
    glass: '#60a5fa',
    default: '#4b5158',
});

export function normalizeHexColour(value) {
    if (typeof value === 'string') {
        const trimmed = value.trim();

        if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
            return trimmed.toLowerCase();
        }
        if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
            return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
        }
        if (/^0x[0-9a-fA-F]{6}$/.test(trimmed)) {
            return `#${trimmed.slice(2)}`.toLowerCase();
        }
        if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
            return `#${trimmed}`.toLowerCase();
        }
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        const integerColour = Math.max(0, Math.min(0xffffff, Math.trunc(value)));
        return `#${integerColour.toString(16).padStart(6, '0')}`;
    }

    let red;
    let green;
    let blue;
    if (Array.isArray(value) && value.length >= 3) {
        [red, green, blue] = value;
    } else if (value && typeof value === 'object') {
        red = value.r ?? value.red;
        green = value.g ?? value.green;
        blue = value.b ?? value.blue;
    }

    if ([red, green, blue].every(component => Number.isFinite(Number(component)))) {
        const toByte = component => Math.max(0, Math.min(255, Math.round(Number(component))));
        return `#${[red, green, blue]
            .map(component => toByte(component).toString(16).padStart(2, '0'))
            .join('')}`;
    }

    return null;
}

export function normalizeRequestedColour(value) {
    return normalizeHexColour(value);
}

export function getFinishDefinition(type) {
    return ALUMINIUM_FINISH_CATALOG[type] || ALUMINIUM_FINISH_CATALOG.mill;
}

export function createFinishSelection(type = 'mill', presetId = null) {
    const finishType = ALUMINIUM_FINISH_CATALOG[type] ? type : 'mill';
    const definition = getFinishDefinition(finishType);
    const requestedPreset = definition.presets.find(preset => preset.id === presetId);
    const preset = requestedPreset || definition.presets[0];
    return {
        type: finishType,
        presetId: preset.id,
        color: preset.color,
        name: preset.name,
    };
}

function hexColourToRgb(colour) {
    const normalized = normalizeHexColour(colour);
    if (!normalized) return null;
    return {
        r: Number.parseInt(normalized.slice(1, 3), 16),
        g: Number.parseInt(normalized.slice(3, 5), 16),
        b: Number.parseInt(normalized.slice(5, 7), 16),
    };
}

function findNearestRalPreset(colour) {
    const requestedRgb = hexColourToRgb(colour);
    const ralPresets = getFinishDefinition('coated').presets;
    if (!requestedRgb) return ralPresets[0];

    return ralPresets.reduce((nearest, preset) => {
        const presetRgb = hexColourToRgb(preset.color);
        const distance = (
            (requestedRgb.r - presetRgb.r) ** 2
            + (requestedRgb.g - presetRgb.g) ** 2
            + (requestedRgb.b - presetRgb.b) ** 2
        );
        return distance < nearest.distance ? { preset, distance } : nearest;
    }, { preset: ralPresets[0], distance: Number.POSITIVE_INFINITY }).preset;
}

export function createRalFinishSelectionFromColour(colour) {
    return createFinishSelection('coated', findNearestRalPreset(colour).id);
}

export function getGlazingBeadCode(thicknessMm) {
    return resolveGlazingBeadProfileId(thicknessMm);
}

export function getGasketCode(thicknessMm) {
    return resolveMovableGasketProfileId(thicknessMm);
}
