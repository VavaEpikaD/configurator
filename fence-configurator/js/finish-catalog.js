// Finish identity also selects the original material treatment and price factor.
// Administrators edit only names and colors, never geometry or pricing metadata.
const builtIns = {
  anthracite: { color: '#252d33', name: 'Anthracite', labelKey: 'finish.anthracite', multiplier: 1 },
  black: { color: '#0e1215', name: 'Black', labelKey: 'finish.black', multiplier: 1.04 },
  white: { color: '#d8d7d2', name: 'Traffic white', labelKey: 'finish.white', multiplier: 1.05 },
  bronze: { color: '#5f544c', name: 'Bronze grey', labelKey: 'finish.bronze', multiplier: 1.08 },
  wood: { color: '#8a5734', name: 'Wood tone', labelKey: 'finish.wood', multiplier: 1.18 },
};
export const DEFAULT_FENCE_FINISHES = Object.freeze(Object.assign(Object.create(null),
  Object.fromEntries(Object.entries(builtIns).map(([id, finish]) => [id, Object.freeze({ id, ...finish })])),
));
const FACTORY_CHOICES = Object.freeze(Object.values(DEFAULT_FENCE_FINISHES));
const PALETTE_URL = 'https://europe-west1-configurator-360.cloudfunctions.net/getConfiguratorColors?configuratorId=fence';
const MAX_RESPONSE_LENGTH = 256_000;
let availableFinishes = FACTORY_CHOICES;
// Preserve built-in IDs for legacy shares/BOM readers, but expose only the
// published list through getAvailableFenceFinishes(). Deleted colors are not choices.
export let FINISHES = DEFAULT_FENCE_FINISHES;

function validColor(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && typeof value.id === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value.id)
    && typeof value.name === 'string' && !!value.name.trim() && value.name.length <= 120
    && !/[\u0000-\u001f\u007f]/.test(value.name)
    && typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color);
}

function makeFinish(color) {
  const original = DEFAULT_FENCE_FINISHES[color.id];
  const name = color.name.trim();
  return Object.freeze({
    id: color.id, name, color: color.color.toLowerCase(),
    labelKey: original?.name === name ? original.labelKey : null,
    // All new finishes are standard powder-coated colors. Never trust price
    // multipliers or material flags from a published payload or a saved state.
    multiplier: original?.multiplier ?? 1,
  });
}

export function parseFenceFinishPalette(payload) {
  if (payload?.schemaVersion !== 1 || payload.configuratorId !== 'fence'
      || !Number.isSafeInteger(payload.revision) || payload.revision < 0
      || !payload.groups || Array.isArray(payload.groups)
      || Object.keys(payload.groups).length !== 1
      || !Object.prototype.hasOwnProperty.call(payload.groups, 'finish')) {
    throw new Error('Invalid published fence palette.');
  }
  const colors = payload.groups.finish;
  if (!Array.isArray(colors) || colors.length < 1 || colors.length > 100) {
    throw new Error('The fence finish palette must contain between 1 and 100 colors.');
  }
  const ids = new Set();
  return Object.freeze(colors.map(color => {
    if (!validColor(color) || Object.keys(color).length !== 3 || ids.has(color.id)) {
      throw new Error('Invalid color in the fence finish palette.');
    }
    ids.add(color.id);
    return makeFinish(color);
  }));
}

export async function loadFenceFinishCatalog(options = {}) {
  // Imports in build/validation tools never contact the production backend.
  if (typeof window === 'undefined' && !options.fetchImpl) return FACTORY_CHOICES;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') return FACTORY_CHOICES;
  const controller = new AbortController();
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Published fence palette request timed out.'));
      }, options.timeoutMs ?? 8000);
    });
    const request = (async () => {
      const response = await fetchImpl(PALETTE_URL, {
        method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Palette request failed (${response.status}).`);
      const text = await response.text();
      if (text.length > MAX_RESPONSE_LENGTH) throw new Error('Published fence palette is too large.');
      return parseFenceFinishPalette(JSON.parse(text));
    })();
    // Bound the response body as well as connection time. Late responses have
    // no side effects and cannot replace the fallback after initialization.
    return await Promise.race([request, timeout]);
  } catch (error) {
    (options.warn || console.warn)('Fence colors: using built-in finishes because published colors are unavailable.', error);
    return FACTORY_CHOICES;
  } finally {
    clearTimeout(timer);
  }
}

export async function initializeFenceFinishCatalog(options = {}) {
  const choices = await loadFenceFinishCatalog(options);
  const registry = Object.assign(Object.create(null), DEFAULT_FENCE_FINISHES);
  for (const finish of choices) registry[finish.id] = finish;
  FINISHES = Object.freeze(registry);
  availableFinishes = choices;
  return choices;
}

export function getAvailableFenceFinishes() {
  return availableFinishes;
}

export function getDefaultFenceFinishId() {
  return availableFinishes.find(finish => finish.id === 'anthracite')?.id || availableFinishes[0].id;
}

export function resolveFenceFinish(state) {
  const snapshot = state?.finishSnapshot;
  if (validColor(snapshot) && snapshot.id === state.finish) return makeFinish(snapshot);
  const id = typeof state?.finish === 'string' ? state.finish : '';
  return FINISHES[id] || FINISHES[getDefaultFenceFinishId()];
}

export function normalizeFenceFinish(state) {
  const finish = resolveFenceFinish(state);
  state.finish = finish.id;
  // Store only display data. This keeps captured/cart/share configurations
  // renderable even after their custom color is renamed, recolored or deleted.
  state.finishSnapshot = { id: finish.id, name: finish.name, color: finish.color };
  return finish;
}

export function selectFenceFinish(state, id) {
  const finish = availableFinishes.find(candidate => candidate.id === id);
  if (!finish) return false;
  state.finish = finish.id;
  state.finishSnapshot = { id: finish.id, name: finish.name, color: finish.color };
  return true;
}
