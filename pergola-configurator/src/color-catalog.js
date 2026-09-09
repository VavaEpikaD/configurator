import {
  FRAME_COLORS,
  LOUVER_COLORS,
  SCREEN_COLORS,
  PRIVACY_WALL_COLORS,
  LED_COLORS,
} from './catalog.js';

const PALETTE_URL = 'https://europe-west1-configurator-360.cloudfunctions.net/getConfiguratorColors?configuratorId=pergola';
const MAX_COLORS = 100;
const MAX_RESPONSE_LENGTH = 256_000;

// These are the arrays already consumed by every pergola color widget. Keep
// their identities, so both the sidebar and per-segment controls see updates.
const catalogs = Object.freeze({
  frame: FRAME_COLORS,
  louvers: LOUVER_COLORS,
  screens: SCREEN_COLORS,
  'privacy-wall': PRIVACY_WALL_COLORS,
  led: LED_COLORS,
});
const GROUP_IDS = Object.freeze(Object.keys(catalogs));
const factoryCatalog = Object.freeze(Object.fromEntries(GROUP_IDS.map(id => [
  id, Object.freeze(catalogs[id].map(color => Object.freeze({ ...color }))),
])));

export function mergePergolaColorCatalog(defaults, payload) {
  if (payload?.schemaVersion !== 1 || payload.configuratorId !== 'pergola'
      || !Number.isSafeInteger(payload.revision) || payload.revision < 0
      || !payload.groups || Array.isArray(payload.groups)
      || Object.keys(payload.groups).length !== GROUP_IDS.length) {
    throw new Error('Invalid published pergola palette.');
  }
  const result = {};
  for (const groupId of GROUP_IDS) {
    const source = payload.groups[groupId];
    if (!Array.isArray(source) || !source.length || source.length > MAX_COLORS) {
      throw new Error(`Invalid ${groupId} palette.`);
    }
    const ids = new Set();
    const values = new Set();
    result[groupId] = Object.freeze(source.map(color => {
      if (!color || typeof color !== 'object' || Array.isArray(color)
          || typeof color.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(color.id) || ids.has(color.id)
          || typeof color.name !== 'string' || !color.name.trim() || color.name.length > 120
          || /[\u0000-\u001f\u007f]/.test(color.name)
          || typeof color.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color.color)) {
        throw new Error(`Invalid color in ${groupId} palette.`);
      }
      const value = color.color.toLowerCase();
      if (values.has(value)) throw new Error(`Duplicate hex value in ${groupId} palette.`);
      ids.add(color.id);
      values.add(value);
      const label = color.name.trim();
      const unchanged = defaults[groupId].some(original => original.value === value && original.label === label);
      return Object.freeze({
        id: color.id, value, label,
        // localizeCatalogOptions spreads this property. Renames/new names must
        // not be replaced by a built-in translation or an unknown message key.
        ...(unchanged ? {} : { publishedName: label }),
      });
    }));
  }
  return Object.freeze(result);
}

export async function loadPergolaColorCatalog(defaults = factoryCatalog, options = {}) {
  // Build tools may import the module without a browser. Never fetch production
  // from those tools; tests explicitly inject a read-only fetch implementation.
  if (typeof window === 'undefined' && !options.fetchImpl) return defaults;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') return defaults;
  const controller = new AbortController();
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Published pergola palette request timed out.'));
      }, options.timeoutMs ?? 8000);
    });
    const request = (async () => {
      const response = await fetchImpl(PALETTE_URL, {
        method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Palette request failed (${response.status}).`);
      const text = await response.text();
      if (text.length > MAX_RESPONSE_LENGTH) throw new Error('Published pergola palette is too large.');
      return mergePergolaColorCatalog(defaults, JSON.parse(text));
    })();
    // Bound the entire request, including a response body that never finishes.
    return await Promise.race([request, timeout]);
  } catch (error) {
    (options.warn || console.warn)('Pergola colors: using built-in palettes because published colors are unavailable.', error);
    return defaults;
  } finally {
    clearTimeout(timer);
  }
}

export async function initializePergolaColorCatalog(options = {}) {
  const next = await loadPergolaColorCatalog(factoryCatalog, options);
  // Only install a complete, validated response (or the complete safe fallback).
  // A late response after a timeout cannot partially overwrite the active arrays.
  for (const id of GROUP_IDS) catalogs[id].splice(0, catalogs[id].length, ...next[id]);
  return next;
}
