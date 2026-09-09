// This relative import resolves from both the source tree and the domain-root
// static releases (combined site or standalone window build). Node validators
// can load the same pure schema without preparing browser assets first.
import { DEFAULT_WINDOW_SIZE_LIMITS, validateWindowSizeLimits, applyWindowSliderBounds } from '../../../../shared-ui/src/windowSizeSettings.js?v=1';

const URL = 'https://europe-west1-configurator-360.cloudfunctions.net/getConfiguratorColors?configuratorId=window';
export async function loadPublishedWindowSettings(options = {}) {
    if (typeof window === 'undefined' && !options.fetchImpl) return null;
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    if (typeof fetchImpl !== 'function') return null;
    const controller = new AbortController();
    let timer;
    try {
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error('Window settings request timed out.')); }, options.timeoutMs ?? 8000);
        });
        const request = (async () => {
            const response = await fetchImpl(URL, {
                method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', signal: controller.signal,
            });
            if (!response.ok) throw new Error(`Window settings request failed (${response.status}).`);
            const text = await response.text();
            if (text.length > 100_000) throw new Error('Window settings response is too large.');
            const payload = JSON.parse(text);
            if (payload?.schemaVersion !== 1 || payload.configuratorId !== 'window'
                || !Number.isSafeInteger(payload.revision) || payload.revision < 0) throw new Error('Invalid window settings response.');
            if (payload.sizeLimits !== undefined) payload.sizeLimits = validateWindowSizeLimits(payload.sizeLimits);
            return payload;
        })();
        return await Promise.race([request, timeout]);
    } catch (error) {
        (options.warn || console.warn)('Window settings unavailable; using built-in defaults.', error);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

export const PUBLISHED_WINDOW_SETTINGS = await loadPublishedWindowSettings();
export const WINDOW_SLIDER_LIMITS = PUBLISHED_WINDOW_SETTINGS?.sizeLimits || DEFAULT_WINDOW_SIZE_LIMITS;
export function getWindowSliderRange(scope, axis) {
    const range = WINDOW_SLIDER_LIMITS[scope][axis === 'x' ? 'width' : axis === 'y' ? 'height' : axis];
    return { minM: range.minMm / 1000, maxM: range.maxMm / 1000 };
}
// This runs before main.js reads the initial DOM bounds. Node tooling stays offline.
applyWindowSliderBounds(WINDOW_SLIDER_LIMITS);
