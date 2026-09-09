// Public, read-only published palette. Material definitions stay in config.js.
const PALETTE_URL = 'https://europe-west1-configurator-360.cloudfunctions.net/getConfiguratorColors?configuratorId=window';
const GROUP_IDS = ['mill', 'anodized', 'coated'];
const MAX_COLORS = 100;
const MAX_RESPONSE_LENGTH = 100_000;

export function mergeWindowFinishCatalog(defaults, payload) {
    if (payload?.schemaVersion !== 1 || payload.configuratorId !== 'window'
        || !Number.isSafeInteger(payload.revision) || payload.revision < 0
        || !payload.groups || Array.isArray(payload.groups)
        || Object.keys(payload.groups).length !== GROUP_IDS.length) {
        throw new Error('Invalid published window palette.');
    }

    const catalog = {};
    for (const type of GROUP_IDS) {
        const source = payload.groups[type];
        if (!Array.isArray(source) || source.length < 1 || source.length > MAX_COLORS) {
            throw new Error(`Invalid ${type} palette.`);
        }
        const ids = new Set();
        const presets = source.map(preset => {
            if (!preset || typeof preset !== 'object'
                || typeof preset.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(preset.id)
                || ids.has(preset.id)
                || typeof preset.name !== 'string' || !preset.name.trim()
                || preset.name.length > 120 || /[\u0000-\u001f\u007f]/.test(preset.name)
                || typeof preset.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(preset.color)) {
                throw new Error(`Invalid color in ${type} palette.`);
            }
            ids.add(preset.id);
            const name = preset.name.trim();
            const factoryPreset = defaults[type].presets.find(entry => entry.id === preset.id);
            return Object.freeze({
                id: preset.id,
                name,
                color: preset.color.toLowerCase(),
                nameOverridden: !factoryPreset || factoryPreset.name !== name,
            });
        });
        catalog[type] = Object.freeze({ ...defaults[type], presets: Object.freeze(presets) });
    }
    return Object.freeze(catalog);
}

export async function loadWindowFinishCatalog(defaults, options = {}) {
    if (Object.prototype.hasOwnProperty.call(options, 'payload')) {
        try { return options.payload ? mergeWindowFinishCatalog(defaults, options.payload) : defaults; }
        catch (error) {
            (options.warn || console.warn)('Invalid published window colors; using built-in defaults.', error);
            return defaults;
        }
    }
    // CAD/build/validation tools also import config.js, and must not contact
    // production. Dependency injection is limited to this explicit function API.
    if (typeof window === 'undefined' && !options.fetchImpl) return defaults;
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    if (typeof fetchImpl !== 'function') return defaults;
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 8000;
    let timer;
    try {
        // Race the entire request AND body read, not just response headers.
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => {
                controller.abort();
                reject(new Error('Published palette request timed out.'));
            }, timeoutMs);
        });
        const request = (async () => {
            const response = await fetchImpl(PALETTE_URL, {
                method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store',
                signal: controller.signal,
            });
            if (!response.ok) throw new Error(`Palette request failed (${response.status}).`);
            const text = await response.text();
            if (text.length > MAX_RESPONSE_LENGTH) throw new Error('Published palette is too large.');
            return mergeWindowFinishCatalog(defaults, JSON.parse(text));
        })();
        return await Promise.race([request, timeout]);
    } catch (error) {
        (options.warn || console.warn)('Window colors: using built-in palette because published colors are unavailable.', error);
        return defaults;
    } finally {
        clearTimeout(timer);
    }
}
