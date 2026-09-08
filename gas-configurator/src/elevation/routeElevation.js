import {
  buildRouteSegments,
  clamp,
  normalizeCoordinate,
  routeLengthMeters,
  routeProfileSamples,
} from '../domain/geometry.js';

export const TERRAIN_SOURCE_NAME = 'Mapzen Terrain Tiles / AWS Open Data';
export const TERRAIN_SOURCE_URL = 'https://registry.opendata.aws/terrain-tiles/';
export const DEFAULT_TERRAIN_TILE_TEMPLATE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const DEFAULT_TERRAIN_ZOOM = 15;

const MIN_TERRAIN_ZOOM = 0;
const MAX_TERRAIN_TILES = 24;
const MIN_PROFILE_SAMPLES = 24;
const MAX_PROFILE_SAMPLES = 120;
const PROFILE_SAMPLE_SPACING_M = 20;
const TILE_CACHE_LIMIT = 48;
const PROFILE_CACHE_LIMIT = 12;
const DEFAULT_DEBOUNCE_MS = 320;
const DEFAULT_TIMEOUT_MS = 15_000;
const TERRAIN_TILE_COORDINATE_EXTENT = 256;

const completedTerrainTiles = new Map();

function configuredTerrainTemplate() {
  const runtimeValue = globalThis.GAS_TERRAIN_TILE_ENDPOINT;
  const buildValue = import.meta.env?.VITE_GAS_TERRAIN_TILE_URL;
  return String(runtimeValue || buildValue || DEFAULT_TERRAIN_TILE_TEMPLATE).trim()
    || DEFAULT_TERRAIN_TILE_TEMPLATE;
}

function terrainUrl(template, z, x, y) {
  return template
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

function delay(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function isAbortError(error) {
  return error?.name === 'AbortError';
}

function cloneRoutePoints(points = []) {
  return points.map((point) => ({
    id: String(point?.id || ''),
    kind: point?.kind === 'waypoint' ? 'waypoint' : 'endpoint',
    label: String(point?.label || ''),
    coordinate: normalizeCoordinate(point?.coordinate),
  }));
}

function addCacheEntry(cache, key, value, limit) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) cache.delete(cache.keys().next().value);
}

export function routeElevationKey(points = []) {
  return points
    .map((point) => normalizeCoordinate(point?.coordinate)
      .map((value) => value.toFixed(6))
      .join(','))
    .join(';');
}

export function routeElevationSampleCount(points = []) {
  const routeLengthM = routeLengthMeters(points);
  return Math.round(clamp(
    Math.ceil(routeLengthM / PROFILE_SAMPLE_SPACING_M) + 1,
    MIN_PROFILE_SAMPLES,
    MAX_PROFILE_SAMPLES,
  ));
}

export function terrainAdjustedRouteLengthMeters(samples = []) {
  if (!Array.isArray(samples) || samples.length < 2) return NaN;

  let lengthM = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previousChainageM = Number(samples[index - 1]?.chainageM);
    const currentChainageM = Number(samples[index]?.chainageM);
    const previousElevationM = Number(samples[index - 1]?.elevationM);
    const currentElevationM = Number(samples[index]?.elevationM);
    const horizontalDistanceM = currentChainageM - previousChainageM;
    const elevationChangeM = currentElevationM - previousElevationM;

    if (
      !Number.isFinite(horizontalDistanceM)
      || horizontalDistanceM <= 0
      || !Number.isFinite(elevationChangeM)
    ) return NaN;

    lengthM += Math.hypot(horizontalDistanceM, elevationChangeM);
  }

  return lengthM;
}

export function buildRouteElevationLocations(points = []) {
  const routeLengthM = routeLengthMeters(points);
  const uniformSamples = routeProfileSamples(points, routeElevationSampleCount(points));
  const vertices = buildRouteSegments(points).flatMap((segment, index, segments) => {
    const samples = [{
      chainageM: segment.startChainageM,
      coordinate: normalizeCoordinate(segment.startPoint.coordinate),
    }];
    if (index === segments.length - 1) {
      samples.push({
        chainageM: segment.endChainageM,
        coordinate: normalizeCoordinate(segment.endPoint.coordinate),
      });
    }
    return samples;
  });

  const combined = [
    ...uniformSamples.map((sample) => ({
      chainageM: sample.chainageM,
      coordinate: normalizeCoordinate(sample.coordinate),
    })),
    ...vertices,
  ].sort((a, b) => a.chainageM - b.chainageM);

  const deduplicated = [];
  combined.forEach((sample) => {
    const previous = deduplicated.at(-1);
    if (previous && Math.abs(previous.chainageM - sample.chainageM) < 0.001) return;
    deduplicated.push({
      chainageM: sample.chainageM,
      progress: routeLengthM > 0 ? sample.chainageM / routeLengthM : 0,
      coordinate: sample.coordinate,
    });
  });
  return deduplicated;
}

export function lonLatToTileFraction(longitude, latitude, zoom = DEFAULT_TERRAIN_ZOOM) {
  const n = 2 ** zoom;
  const safeLatitude = clamp(Number(latitude), -85.05112878, 85.05112878);
  const latitudeRadians = safeLatitude * Math.PI / 180;
  return {
    x: ((Number(longitude) + 180) / 360) * n,
    y: (1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * n,
  };
}

export function terrainTileReference(coordinate, zoom = DEFAULT_TERRAIN_ZOOM) {
  const [longitude, latitude] = normalizeCoordinate(coordinate);
  const fraction = lonLatToTileFraction(longitude, latitude, zoom);
  const n = 2 ** zoom;
  const rawX = Math.floor(fraction.x);
  const rawY = Math.floor(fraction.y);
  const x = ((rawX % n) + n) % n;
  const y = Math.round(clamp(rawY, 0, n - 1));
  return {
    z: zoom,
    x,
    y,
    pixelX: (fraction.x - rawX) * 256,
    pixelY: (fraction.y - rawY) * 256,
    key: `${zoom}/${x}/${y}`,
  };
}

function uniqueTileCount(locations, zoom) {
  return new Set(locations.map((sample) => terrainTileReference(sample.coordinate, zoom).key)).size;
}

export function selectTerrainZoom(locations = [], maxTiles = MAX_TERRAIN_TILES) {
  for (let zoom = DEFAULT_TERRAIN_ZOOM; zoom >= MIN_TERRAIN_ZOOM; zoom -= 1) {
    if (uniqueTileCount(locations, zoom) <= maxTiles) return zoom;
  }
  return MIN_TERRAIN_ZOOM;
}

export function decodeTerrariumRgb(red, green, blue) {
  return Number(red) * 256 + Number(green) + Number(blue) / 256 - 32768;
}

export function sampleTerrainTile(tile, pixelX, pixelY) {
  const width = Number(tile?.width || tile?.imageData?.width);
  const height = Number(tile?.height || tile?.imageData?.height);
  const data = tile?.imageData?.data;
  if (!Number.isFinite(width) || !Number.isFinite(height) || !data?.length) return NaN;
  const x = Math.floor(clamp(
    (Number(pixelX) / TERRAIN_TILE_COORDINATE_EXTENT) * width,
    0,
    width - 1,
  ));
  const y = Math.floor(clamp(
    (Number(pixelY) / TERRAIN_TILE_COORDINATE_EXTENT) * height,
    0,
    height - 1,
  ));
  const offset = (y * width + x) * 4;
  const elevationM = decodeTerrariumRgb(data[offset], data[offset + 1], data[offset + 2]);
  return elevationM > -12_000 && elevationM < 10_000 ? elevationM : NaN;
}

async function blobToImageData(blob) {
  let source = null;
  let revokeUrl = null;
  try {
    if (typeof globalThis.createImageBitmap === 'function') {
      source = await globalThis.createImageBitmap(blob);
    } else {
      const objectUrl = globalThis.URL.createObjectURL(blob);
      revokeUrl = objectUrl;
      source = await new Promise((resolve, reject) => {
        const image = new globalThis.Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not decode the terrain tile image.'));
        image.src = objectUrl;
      });
    }

    const width = source.width || 256;
    const height = source.height || 256;
    const canvas = globalThis.document?.createElement('canvas');
    if (!canvas) throw new Error('Canvas is not available for terrain decoding.');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas 2D is not available for terrain decoding.');
    context.drawImage(source, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  } finally {
    source?.close?.();
    if (revokeUrl) globalThis.URL.revokeObjectURL(revokeUrl);
  }
}

async function fetchTerrainTile({ z, x, y, signal, tileTemplate, fetchImpl }) {
  const cacheKey = `${tileTemplate}|${z}/${x}/${y}`;
  if (completedTerrainTiles.has(cacheKey)) return completedTerrainTiles.get(cacheKey);

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(terrainUrl(tileTemplate, z, x, y), {
        signal,
        mode: 'cors',
        credentials: 'omit',
        cache: 'force-cache',
      });
      if (!response.ok) throw new Error(`Terrain tile HTTP ${response.status}.`);
      const imageData = await blobToImageData(await response.blob());
      const tile = { imageData, width: imageData.width, height: imageData.height };
      addCacheEntry(completedTerrainTiles, cacheKey, tile, TILE_CACHE_LIMIT);
      return tile;
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) throw error;
      lastError = error;
      if (attempt === 0) await delay(180);
    }
  }
  throw lastError || new Error('Terrain tile unavailable.');
}

function repairVoidElevations(samples) {
  const validIndexes = samples
    .map((sample, index) => (Number.isFinite(sample.elevationM) ? index : -1))
    .filter((index) => index >= 0);
  if (!validIndexes.length) throw new Error('Terrain elevation could not be decoded.');

  let repairedCount = 0;
  const repaired = samples.map((sample, index) => {
    if (Number.isFinite(sample.elevationM)) return sample;
    repairedCount += 1;
    const previousIndex = [...validIndexes].reverse().find((candidate) => candidate < index);
    const nextIndex = validIndexes.find((candidate) => candidate > index);
    if (previousIndex === undefined) return { ...sample, elevationM: samples[nextIndex].elevationM };
    if (nextIndex === undefined) return { ...sample, elevationM: samples[previousIndex].elevationM };
    const previous = samples[previousIndex];
    const next = samples[nextIndex];
    const span = next.chainageM - previous.chainageM;
    const ratio = span > 0 ? (sample.chainageM - previous.chainageM) / span : 0;
    return {
      ...sample,
      elevationM: previous.elevationM + ((next.elevationM - previous.elevationM) * ratio),
    };
  });
  return { samples: repaired, repairedCount };
}

export async function loadRouteElevationProfile(points = [], {
  signal,
  fetchImpl = globalThis.fetch,
  tileTemplate = configuredTerrainTemplate(),
  loadTile = fetchTerrainTile,
} = {}) {
  if (typeof loadTile !== 'function') throw new TypeError('A terrain tile loader is required.');
  if (loadTile === fetchTerrainTile && typeof fetchImpl !== 'function') {
    throw new Error('Fetch is not available for terrain loading.');
  }

  const routePoints = cloneRoutePoints(points);
  const locations = buildRouteElevationLocations(routePoints);
  if (!locations.length) throw new Error('The route has no elevation sample locations.');
  const zoom = selectTerrainZoom(locations);
  const references = locations.map((sample) => terrainTileReference(sample.coordinate, zoom));
  const uniqueReferences = [...new Map(references.map((reference) => [reference.key, reference])).values()];
  const tiles = new Map(await Promise.all(uniqueReferences.map(async (reference) => [
    reference.key,
    await loadTile({
      ...reference,
      signal,
      tileTemplate,
      fetchImpl,
    }),
  ])));

  const decoded = locations.map((sample, index) => ({
    ...sample,
    elevationM: sampleTerrainTile(
      tiles.get(references[index].key),
      references[index].pixelX,
      references[index].pixelY,
    ),
  }));
  const { samples, repairedCount } = repairVoidElevations(decoded);
  const elevationValues = samples.map((sample) => sample.elevationM);

  return {
    status: 'ready',
    routeKey: routeElevationKey(routePoints),
    source: TERRAIN_SOURCE_NAME,
    sourceUrl: TERRAIN_SOURCE_URL,
    zoom,
    tileCount: uniqueReferences.length,
    sampleCount: samples.length,
    repairedCount,
    loadedAt: Date.now(),
    minElevationM: Math.min(...elevationValues),
    maxElevationM: Math.max(...elevationValues),
    startElevationM: samples[0].elevationM,
    endElevationM: samples.at(-1).elevationM,
    terrainAdjustedLengthM: terrainAdjustedRouteLengthMeters(samples),
    samples,
  };
}

export function interpolateElevationAtChainage(samples = [], requestedChainageM = 0, fallback = 0) {
  const valid = samples.filter((sample) => Number.isFinite(Number(sample?.elevationM)));
  if (!valid.length) return Number(fallback) || 0;
  const chainageM = clamp(
    Number(requestedChainageM) || 0,
    Number(valid[0].chainageM) || 0,
    Number(valid.at(-1).chainageM) || 0,
  );
  const nextIndex = valid.findIndex((sample) => Number(sample.chainageM) >= chainageM);
  if (nextIndex <= 0) return Number(valid[0].elevationM);
  if (nextIndex < 0) return Number(valid.at(-1).elevationM);
  const previous = valid[nextIndex - 1];
  const next = valid[nextIndex];
  const span = Number(next.chainageM) - Number(previous.chainageM);
  const ratio = span > 0 ? (chainageM - Number(previous.chainageM)) / span : 0;
  return Number(previous.elevationM) + ((Number(next.elevationM) - Number(previous.elevationM)) * ratio);
}

export class RouteElevationController {
  constructor({
    onChange,
    loadProfile = loadRouteElevationProfile,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}) {
    if (typeof onChange !== 'function') throw new TypeError('An elevation change handler is required.');
    this.onChange = onChange;
    this.loadProfile = loadProfile;
    this.debounceMs = Math.max(0, Number(debounceMs) || 0);
    this.timeoutMs = Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS);
    this.cache = new Map();
    this.timer = 0;
    this.abortController = null;
    this.generation = 0;
    this.destroyed = false;
    this.state = { status: 'idle', routeKey: '', samples: [] };
  }

  emit(nextState) {
    if (this.destroyed) return;
    this.state = nextState;
    this.onChange(nextState);
  }

  request(points, { force = false } = {}) {
    if (this.destroyed) return '';
    const routeKey = routeElevationKey(points);
    if (!force && routeKey === this.state.routeKey && ['loading', 'ready', 'error'].includes(this.state.status)) {
      return routeKey;
    }

    this.generation += 1;
    const generation = this.generation;
    globalThis.clearTimeout(this.timer);
    this.timer = 0;
    this.abortController?.abort(new DOMException('Superseded by a newer route.', 'AbortError'));
    this.abortController = null;

    if (force) this.cache.delete(routeKey);
    const cached = this.cache.get(routeKey);
    if (cached) {
      addCacheEntry(this.cache, routeKey, cached, PROFILE_CACHE_LIMIT);
      this.emit({ ...cached, cacheStatus: 'memory' });
      return routeKey;
    }

    const routePoints = cloneRoutePoints(points);
    this.emit({ status: 'loading', routeKey, samples: [] });
    this.timer = globalThis.setTimeout(() => {
      this.timer = 0;
      void this.load(routePoints, routeKey, generation);
    }, this.debounceMs);
    return routeKey;
  }

  async load(points, routeKey, generation) {
    const abortController = new AbortController();
    this.abortController = abortController;
    let timedOut = false;
    const timeout = globalThis.setTimeout(() => {
      timedOut = true;
      abortController.abort(new DOMException('Terrain request timed out.', 'TimeoutError'));
    }, this.timeoutMs);

    try {
      const profile = await this.loadProfile(points, { signal: abortController.signal });
      if (this.destroyed || generation !== this.generation) return;
      const ready = { ...profile, status: 'ready', routeKey, cacheStatus: 'live' };
      addCacheEntry(this.cache, routeKey, ready, PROFILE_CACHE_LIMIT);
      this.emit(ready);
    } catch (error) {
      if (this.destroyed || generation !== this.generation) return;
      if (isAbortError(error) && !timedOut) return;
      this.emit({
        status: 'error',
        routeKey,
        samples: [],
        error: timedOut ? 'Terrain request timed out.' : (error?.message || 'Terrain elevation unavailable.'),
      });
    } finally {
      globalThis.clearTimeout(timeout);
      if (this.abortController === abortController) this.abortController = null;
    }
  }

  retry(points) {
    return this.request(points, { force: true });
  }

  destroy() {
    this.destroyed = true;
    this.generation += 1;
    globalThis.clearTimeout(this.timer);
    this.timer = 0;
    this.abortController?.abort(new DOMException('Elevation controller destroyed.', 'AbortError'));
    this.abortController = null;
    this.cache.clear();
  }
}
