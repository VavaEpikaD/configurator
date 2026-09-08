import {
  buildRouteSegments,
  clamp,
  coordinateBounds,
  normalizeCoordinate,
  routeLengthMeters,
} from '../domain/geometry.js';

export const OBSTACLE_SOURCE_NAME = 'OpenStreetMap / Overpass API';
export const OBSTACLE_SOURCE_URL = 'https://www.openstreetmap.org/copyright';
export const DEFAULT_OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
export const DEFAULT_OBSTACLE_PROXIMITY_M = 25;
export const MIN_OBSTACLE_PROXIMITY_M = 0;
export const MAX_OBSTACLE_PROXIMITY_M = 100;

const DEFAULT_QUERY_PADDING_M = 120;
const DEFAULT_DEBOUNCE_MS = 520;
const DEFAULT_TIMEOUT_MS = 22_000;
const SCREENING_CACHE_LIMIT = 10;
const INTERSECTION_EPSILON = 1e-9;
const DUPLICATE_EVENT_TOLERANCE_M = 1;
const ROAD_FILTER = 'motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|track';
const RAILWAY_FILTER = 'rail|light_rail|tram|narrow_gauge|construction';
const WATERWAY_FILTER = 'river|stream|canal|drain|ditch';

function configuredOverpassEndpoint() {
  const runtimeValue = globalThis.GAS_OVERPASS_ENDPOINT;
  const buildValue = import.meta.env?.VITE_GAS_OVERPASS_URL;
  return String(runtimeValue || buildValue || DEFAULT_OVERPASS_ENDPOINT).trim()
    || DEFAULT_OVERPASS_ENDPOINT;
}

function addCacheEntry(cache, key, value, limit) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) cache.delete(cache.keys().next().value);
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

export function routeObstacleRouteKey(points = []) {
  return points
    .map((point) => normalizeCoordinate(point?.coordinate)
      .map((value) => value.toFixed(6))
      .join(','))
    .join(';');
}

export function routeObstacleRequestKey(points = [], proximityThresholdM = DEFAULT_OBSTACLE_PROXIMITY_M) {
  return `${routeObstacleRouteKey(points)}|${clamp(
    Number(proximityThresholdM) || 0,
    MIN_OBSTACLE_PROXIMITY_M,
    MAX_OBSTACLE_PROXIMITY_M,
  ).toFixed(1)}`;
}

export function expandCoordinateBounds(bounds, paddingM = DEFAULT_QUERY_PADDING_M) {
  if (!bounds) return null;
  const centerLatitude = (Number(bounds.minLat) + Number(bounds.maxLat)) / 2;
  const latitudePadding = Math.max(0, Number(paddingM) || 0) / 111_320;
  const longitudeScale = Math.max(0.1, Math.cos(centerLatitude * Math.PI / 180));
  const longitudePadding = latitudePadding / longitudeScale;
  return {
    minLon: Number(bounds.minLon) - longitudePadding,
    minLat: Number(bounds.minLat) - latitudePadding,
    maxLon: Number(bounds.maxLon) + longitudePadding,
    maxLat: Number(bounds.maxLat) + latitudePadding,
  };
}

export function routeObstacleQueryBounds(points = [], paddingM = DEFAULT_QUERY_PADDING_M) {
  return expandCoordinateBounds(coordinateBounds(points), paddingM);
}

function overpassBbox(bounds) {
  return [bounds.minLat, bounds.minLon, bounds.maxLat, bounds.maxLon]
    .map((value) => Number(value).toFixed(6))
    .join(',');
}

export function buildObstacleOverpassQuery(bounds) {
  if (!bounds) throw new TypeError('Obstacle query bounds are required.');
  const bbox = overpassBbox(bounds);
  return `[out:json][timeout:20];\n(\n  way["highway"~"^(${ROAD_FILTER})$"](${bbox});\n  way["railway"~"^(${RAILWAY_FILTER})$"](${bbox});\n  way["waterway"~"^(${WATERWAY_FILTER})$"](${bbox});\n);\nout tags geom;`;
}

function obstacleType(tags = {}) {
  if (tags.highway) return 'road';
  if (tags.railway) return 'railway';
  if (tags.waterway) return 'waterway';
  return null;
}

function obstacleSubtype(tags, type) {
  if (type === 'road') return String(tags.highway || 'road');
  if (type === 'railway') return String(tags.railway || 'railway');
  return String(tags.waterway || 'waterway');
}

function obstacleStructure(tags = {}) {
  if (tags.bridge && tags.bridge !== 'no') return 'bridge';
  if (tags.tunnel && tags.tunnel !== 'no') return 'tunnel';
  const layer = Number(tags.layer);
  return Number.isFinite(layer) && layer !== 0 ? (layer > 0 ? 'elevated' : 'underground') : 'at-grade';
}

export function parseOverpassObstacleFeatures(payload = {}) {
  const elements = Array.isArray(payload?.elements) ? payload.elements : [];
  return elements.flatMap((element) => {
    if (element?.type !== 'way') return [];
    const tags = element.tags || {};
    const type = obstacleType(tags);
    if (!type) return [];
    const coordinates = (Array.isArray(element.geometry) ? element.geometry : [])
      .map((coordinate) => normalizeCoordinate([coordinate?.lon, coordinate?.lat], [NaN, NaN]))
      .filter((coordinate) => coordinate.every(Number.isFinite))
      .filter((coordinate, index, list) => (
        index === 0
        || coordinate[0] !== list[index - 1][0]
        || coordinate[1] !== list[index - 1][1]
      ));
    if (coordinates.length < 2) return [];
    return [{
      id: `osm-way-${String(element.id)}`,
      osmType: 'way',
      osmId: String(element.id),
      type,
      subtype: obstacleSubtype(tags, type),
      name: String(tags.name || tags.ref || '').trim(),
      structure: obstacleStructure(tags),
      coordinates,
      tags: {
        name: tags.name || null,
        ref: tags.ref || null,
        highway: tags.highway || null,
        railway: tags.railway || null,
        waterway: tags.waterway || null,
        bridge: tags.bridge || null,
        tunnel: tags.tunnel || null,
        layer: tags.layer || null,
      },
    }];
  });
}

function createLocalProjector(points = []) {
  const coordinates = points.map((coordinate) => normalizeCoordinate(coordinate));
  const referenceLongitude = coordinates.reduce((sum, coordinate) => sum + coordinate[0], 0)
    / Math.max(1, coordinates.length);
  const referenceLatitude = coordinates.reduce((sum, coordinate) => sum + coordinate[1], 0)
    / Math.max(1, coordinates.length);
  const metersPerDegreeLatitude = 111_320;
  const metersPerDegreeLongitude = Math.max(
    1,
    metersPerDegreeLatitude * Math.cos(referenceLatitude * Math.PI / 180),
  );
  return (coordinate) => {
    const [longitude, latitude] = normalizeCoordinate(coordinate);
    return {
      x: (longitude - referenceLongitude) * metersPerDegreeLongitude,
      y: (latitude - referenceLatitude) * metersPerDegreeLatitude,
    };
  };
}

function cross(a, b) {
  return (a.x * b.y) - (a.y * b.x);
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function interpolateCoordinate(start, end, ratio) {
  const normalizedStart = normalizeCoordinate(start);
  const normalizedEnd = normalizeCoordinate(end);
  return [
    normalizedStart[0] + ((normalizedEnd[0] - normalizedStart[0]) * ratio),
    normalizedStart[1] + ((normalizedEnd[1] - normalizedStart[1]) * ratio),
  ];
}

function segmentIntersection(routeStart, routeEnd, obstacleStart, obstacleEnd) {
  const routeVector = subtract(routeEnd, routeStart);
  const obstacleVector = subtract(obstacleEnd, obstacleStart);
  const denominator = cross(routeVector, obstacleVector);
  if (Math.abs(denominator) < INTERSECTION_EPSILON) return null;
  const offset = subtract(obstacleStart, routeStart);
  const routeRatio = cross(offset, obstacleVector) / denominator;
  const obstacleRatio = cross(offset, routeVector) / denominator;
  if (
    routeRatio < -INTERSECTION_EPSILON
    || routeRatio > 1 + INTERSECTION_EPSILON
    || obstacleRatio < -INTERSECTION_EPSILON
    || obstacleRatio > 1 + INTERSECTION_EPSILON
  ) return null;
  return {
    routeRatio: clamp(routeRatio, 0, 1),
    obstacleRatio: clamp(obstacleRatio, 0, 1),
  };
}

function closestPointOnSegment(point, start, end) {
  const vector = subtract(end, start);
  const denominator = (vector.x ** 2) + (vector.y ** 2);
  const ratio = denominator > 0
    ? clamp((((point.x - start.x) * vector.x) + ((point.y - start.y) * vector.y)) / denominator, 0, 1)
    : 0;
  const projected = { x: start.x + vector.x * ratio, y: start.y + vector.y * ratio };
  return {
    ratio,
    point: projected,
    distanceM: Math.hypot(point.x - projected.x, point.y - projected.y),
  };
}

function closestSegmentApproach(routeStart, routeEnd, obstacleStart, obstacleEnd) {
  const candidates = [];
  const routeStartProjection = closestPointOnSegment(routeStart, obstacleStart, obstacleEnd);
  candidates.push({
    distanceM: routeStartProjection.distanceM,
    routeRatio: 0,
    obstacleRatio: routeStartProjection.ratio,
  });
  const routeEndProjection = closestPointOnSegment(routeEnd, obstacleStart, obstacleEnd);
  candidates.push({
    distanceM: routeEndProjection.distanceM,
    routeRatio: 1,
    obstacleRatio: routeEndProjection.ratio,
  });
  const obstacleStartProjection = closestPointOnSegment(obstacleStart, routeStart, routeEnd);
  candidates.push({
    distanceM: obstacleStartProjection.distanceM,
    routeRatio: obstacleStartProjection.ratio,
    obstacleRatio: 0,
  });
  const obstacleEndProjection = closestPointOnSegment(obstacleEnd, routeStart, routeEnd);
  candidates.push({
    distanceM: obstacleEndProjection.distanceM,
    routeRatio: obstacleEndProjection.ratio,
    obstacleRatio: 1,
  });
  return candidates.reduce((nearest, candidate) => (
    !nearest || candidate.distanceM < nearest.distanceM ? candidate : nearest
  ), null);
}

function acuteAngleDegrees(routeStart, routeEnd, obstacleStart, obstacleEnd) {
  const routeVector = subtract(routeEnd, routeStart);
  const obstacleVector = subtract(obstacleEnd, obstacleStart);
  const routeLength = Math.hypot(routeVector.x, routeVector.y);
  const obstacleLength = Math.hypot(obstacleVector.x, obstacleVector.y);
  if (routeLength <= 0 || obstacleLength <= 0) return NaN;
  const dot = Math.abs((routeVector.x * obstacleVector.x) + (routeVector.y * obstacleVector.y));
  const cosine = clamp(dot / (routeLength * obstacleLength), 0, 1);
  return Math.acos(cosine) * 180 / Math.PI;
}

function eventFromCandidate(feature, routeSegment, routeRatio, obstacleStartCoordinate, obstacleEndCoordinate, obstacleRatio, relation, distanceM, angleDeg) {
  const stationM = routeSegment.startChainageM + routeSegment.lengthM * routeRatio;
  const coordinate = interpolateCoordinate(
    routeSegment.startPoint.coordinate,
    routeSegment.endPoint.coordinate,
    routeRatio,
  );
  const obstacleCoordinate = interpolateCoordinate(
    obstacleStartCoordinate,
    obstacleEndCoordinate,
    obstacleRatio,
  );
  return {
    id: `${relation}:${feature.id}:${Math.round(stationM * 10)}`,
    featureId: feature.id,
    type: feature.type,
    subtype: feature.subtype,
    name: feature.name,
    structure: feature.structure,
    relation,
    stationM,
    distanceM: Math.max(0, Number(distanceM) || 0),
    angleDeg: Number.isFinite(angleDeg) ? angleDeg : null,
    coordinate,
    obstacleCoordinate,
    segmentId: routeSegment.id,
    source: 'publicScreening',
  };
}

function deduplicateFeatureCrossings(events) {
  const sorted = [...events].sort((a, b) => a.stationM - b.stationM);
  return sorted.filter((event, index) => (
    index === 0
    || Math.abs(event.stationM - sorted[index - 1].stationM) > DUPLICATE_EVENT_TOLERANCE_M
  ));
}

function emptySummary(features = []) {
  const byType = Object.fromEntries(['road', 'railway', 'waterway'].map((type) => [type, {
    features: features.filter((feature) => feature.type === type).length,
    crossings: 0,
    proximities: 0,
  }]));
  return {
    featureCount: features.length,
    eventCount: 0,
    crossingCount: 0,
    proximityCount: 0,
    byType,
  };
}

export function summarizeObstacleEvents(features = [], events = []) {
  const summary = emptySummary(features);
  events.forEach((event) => {
    if (!summary.byType[event.type]) return;
    summary.eventCount += 1;
    if (event.relation === 'crossing') {
      summary.crossingCount += 1;
      summary.byType[event.type].crossings += 1;
    } else if (event.relation === 'proximity') {
      summary.proximityCount += 1;
      summary.byType[event.type].proximities += 1;
    }
  });
  return summary;
}

export function analyzeRouteObstacles(points = [], features = [], {
  proximityThresholdM = DEFAULT_OBSTACLE_PROXIMITY_M,
} = {}) {
  const routePoints = cloneRoutePoints(points);
  const routeSegments = buildRouteSegments(routePoints);
  const thresholdM = clamp(
    Number(proximityThresholdM) || 0,
    MIN_OBSTACLE_PROXIMITY_M,
    MAX_OBSTACLE_PROXIMITY_M,
  );
  if (!routeSegments.length) return { events: [], summary: summarizeObstacleEvents(features, []) };

  const projector = createLocalProjector(routePoints.map((point) => point.coordinate));
  const events = [];

  features.forEach((feature) => {
    const featureCrossings = [];
    let nearest = null;
    for (let obstacleIndex = 0; obstacleIndex < feature.coordinates.length - 1; obstacleIndex += 1) {
      const obstacleStartCoordinate = feature.coordinates[obstacleIndex];
      const obstacleEndCoordinate = feature.coordinates[obstacleIndex + 1];
      const obstacleStart = projector(obstacleStartCoordinate);
      const obstacleEnd = projector(obstacleEndCoordinate);

      routeSegments.forEach((routeSegment) => {
        const routeStart = projector(routeSegment.startPoint.coordinate);
        const routeEnd = projector(routeSegment.endPoint.coordinate);
        const angleDeg = acuteAngleDegrees(routeStart, routeEnd, obstacleStart, obstacleEnd);
        const intersection = segmentIntersection(routeStart, routeEnd, obstacleStart, obstacleEnd);
        if (intersection) {
          featureCrossings.push(eventFromCandidate(
            feature,
            routeSegment,
            intersection.routeRatio,
            obstacleStartCoordinate,
            obstacleEndCoordinate,
            intersection.obstacleRatio,
            'crossing',
            0,
            angleDeg,
          ));
          return;
        }

        const approach = closestSegmentApproach(routeStart, routeEnd, obstacleStart, obstacleEnd);
        if (!nearest || approach.distanceM < nearest.distanceM) {
          nearest = eventFromCandidate(
            feature,
            routeSegment,
            approach.routeRatio,
            obstacleStartCoordinate,
            obstacleEndCoordinate,
            approach.obstacleRatio,
            'proximity',
            approach.distanceM,
            angleDeg,
          );
        }
      });
    }

    if (featureCrossings.length) events.push(...deduplicateFeatureCrossings(featureCrossings));
    else if (nearest && nearest.distanceM <= thresholdM) events.push(nearest);
  });

  events.sort((a, b) => a.stationM - b.stationM || a.type.localeCompare(b.type));
  return {
    events,
    summary: summarizeObstacleEvents(features, events),
  };
}

export async function loadRouteObstacleScreening(points = [], {
  signal,
  fetchImpl = globalThis.fetch,
  endpoint = configuredOverpassEndpoint(),
  proximityThresholdM = DEFAULT_OBSTACLE_PROXIMITY_M,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is not available for obstacle screening.');
  const routePoints = cloneRoutePoints(points);
  if (routeLengthMeters(routePoints) <= 0) throw new Error('The route must have a positive length.');
  const thresholdM = clamp(
    Number(proximityThresholdM) || 0,
    MIN_OBSTACLE_PROXIMITY_M,
    MAX_OBSTACLE_PROXIMITY_M,
  );
  const bounds = routeObstacleQueryBounds(
    routePoints,
    Math.max(DEFAULT_QUERY_PADDING_M, thresholdM + 75),
  );
  const query = buildObstacleOverpassQuery(bounds);
  const body = new URLSearchParams({ data: query });
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    signal,
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body,
  });
  if (!response.ok) throw new Error(`Obstacle screening HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload?.remark) throw new Error(String(payload.remark));
  const features = parseOverpassObstacleFeatures(payload);
  const analysis = analyzeRouteObstacles(routePoints, features, { proximityThresholdM: thresholdM });
  return {
    status: 'ready',
    routeKey: routeObstacleRouteKey(routePoints),
    requestKey: routeObstacleRequestKey(routePoints, thresholdM),
    source: OBSTACLE_SOURCE_NAME,
    sourceUrl: OBSTACLE_SOURCE_URL,
    endpoint,
    proximityThresholdM: thresholdM,
    queryBounds: bounds,
    fetchedAt: Date.now(),
    features,
    ...analysis,
  };
}

export class RouteObstacleController {
  constructor({
    onChange,
    loadScreening = loadRouteObstacleScreening,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}) {
    if (typeof onChange !== 'function') throw new TypeError('An obstacle-screening change handler is required.');
    this.onChange = onChange;
    this.loadScreening = loadScreening;
    this.debounceMs = Math.max(0, Number(debounceMs) || 0);
    this.timeoutMs = Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS);
    this.cache = new Map();
    this.timer = 0;
    this.abortController = null;
    this.generation = 0;
    this.destroyed = false;
    this.state = {
      status: 'idle',
      routeKey: '',
      requestKey: '',
      features: [],
      events: [],
      summary: emptySummary(),
    };
  }

  emit(nextState) {
    if (this.destroyed) return;
    this.state = nextState;
    this.onChange(nextState);
  }

  request(points, {
    enabled = true,
    proximityThresholdM = DEFAULT_OBSTACLE_PROXIMITY_M,
    force = false,
  } = {}) {
    if (this.destroyed) return '';
    const routeKey = routeObstacleRouteKey(points);
    const requestKey = routeObstacleRequestKey(points, proximityThresholdM);
    if (!enabled) {
      this.generation += 1;
      globalThis.clearTimeout(this.timer);
      this.timer = 0;
      this.abortController?.abort(new DOMException('Obstacle screening disabled.', 'AbortError'));
      this.abortController = null;
      if (this.state.status !== 'disabled' || this.state.routeKey !== routeKey) {
        this.emit({
          status: 'disabled',
          routeKey,
          requestKey,
          features: [],
          events: [],
          summary: emptySummary(),
          proximityThresholdM,
        });
      }
      return requestKey;
    }
    if (!force && requestKey === this.state.requestKey && ['loading', 'ready', 'error'].includes(this.state.status)) {
      return requestKey;
    }

    this.generation += 1;
    const generation = this.generation;
    globalThis.clearTimeout(this.timer);
    this.timer = 0;
    this.abortController?.abort(new DOMException('Superseded by a newer route.', 'AbortError'));
    this.abortController = null;

    if (force) this.cache.delete(requestKey);
    const cached = this.cache.get(requestKey);
    if (cached) {
      addCacheEntry(this.cache, requestKey, cached, SCREENING_CACHE_LIMIT);
      this.emit({ ...cached, cacheStatus: 'memory' });
      return requestKey;
    }

    const routePoints = cloneRoutePoints(points);
    this.emit({
      status: 'loading',
      routeKey,
      requestKey,
      features: [],
      events: [],
      summary: emptySummary(),
      proximityThresholdM,
    });
    this.timer = globalThis.setTimeout(() => {
      this.timer = 0;
      void this.load(routePoints, routeKey, requestKey, proximityThresholdM, generation);
    }, this.debounceMs);
    return requestKey;
  }

  async load(points, routeKey, requestKey, proximityThresholdM, generation) {
    const abortController = new AbortController();
    this.abortController = abortController;
    let timedOut = false;
    const timeout = globalThis.setTimeout(() => {
      timedOut = true;
      abortController.abort(new DOMException('Obstacle screening timed out.', 'TimeoutError'));
    }, this.timeoutMs);

    try {
      const result = await this.loadScreening(points, {
        signal: abortController.signal,
        proximityThresholdM,
      });
      if (this.destroyed || generation !== this.generation) return;
      const ready = {
        ...result,
        status: 'ready',
        routeKey,
        requestKey,
        cacheStatus: 'live',
      };
      addCacheEntry(this.cache, requestKey, ready, SCREENING_CACHE_LIMIT);
      this.emit(ready);
    } catch (error) {
      if (this.destroyed || generation !== this.generation) return;
      if (isAbortError(error) && !timedOut) return;
      this.emit({
        status: 'error',
        routeKey,
        requestKey,
        features: [],
        events: [],
        summary: emptySummary(),
        proximityThresholdM,
        error: timedOut
          ? 'Obstacle screening timed out.'
          : (error?.message || 'Public obstacle data is unavailable.'),
      });
    } finally {
      globalThis.clearTimeout(timeout);
      if (this.abortController === abortController) this.abortController = null;
    }
  }

  retry(points, options = {}) {
    return this.request(points, { ...options, force: true });
  }

  destroy() {
    this.destroyed = true;
    this.generation += 1;
    globalThis.clearTimeout(this.timer);
    this.timer = 0;
    this.abortController?.abort(new DOMException('Obstacle controller destroyed.', 'AbortError'));
    this.abortController = null;
    this.cache.clear();
  }
}
