import {
  buildRouteSegments,
  clamp,
  haversineDistanceMeters,
  interpolateRoute,
  nearestPointOnSegmentRatio,
  normalizeCoordinate,
  routeLengthMeters,
  routeSegmentId,
} from './domain/geometry.js';
import { GROUND_TYPES, SURFACE_TYPES } from './domain/calculations.js';
import {
  clampPipeCover,
  coverAtChainage,
  DEPTH_POINT_MATCH_TOLERANCE_M,
  routeEventDepthZoneStations,
} from './domain/depthProfile.js';
import {
  DEFAULT_PIPE_PRODUCT_ID,
  DEFAULT_PIPE_SELECTION,
  normalizePipeSelection,
  PIPE_CATALOG_VERSION,
} from './domain/pipeCatalog.js';
import {
  createRouteEvent,
  firstUtilityCrossingEvent,
  isUtilityCrossingEvent,
  legacyCrossingToRouteEvent,
  matchingRouteEventForObstacle,
  MAIN_ROUTE_ID,
  normalizeRouteEvent,
  routeEventToLegacyCrossing,
  routeEventFromObstacleScreening,
  ROUTE_EVENT_TYPE_IDS,
  ROUTE_EVENT_TYPES,
  selectedRouteEvent,
} from './domain/routeEvents.js';
import {
  DEFAULT_OBSTACLE_PROXIMITY_M,
  MAX_OBSTACLE_PROXIMITY_M,
  MIN_OBSTACLE_PROXIMITY_M,
} from './obstacles/routeObstacles.js';
import {
  DEFAULT_NETWORK_SNAP_TOLERANCE_M,
  findNearestNetworkPoint,
  NETWORK_CONNECTION_EPSILON_M,
  projectCoordinateToNetworkAsset,
  serializeNetworkConnection,
} from './network/networkConnection.js';

export const GAS_STATE_SCHEMA_VERSION = 4;

const STORAGE_KEY = '360-configurator:gas-prototype:v4';
const LEGACY_STORAGE_KEYS = Object.freeze([
  '360-configurator:gas-prototype:v3',
  '360-configurator:gas-prototype:v2',
  '360-configurator:gas-prototype:v1',
]);
const MAX_HISTORY = 60;
const ROUTE_MODES = new Set(['inspect', 'setA', 'setB', 'addWaypoint']);
const GROUND_SOURCES = new Set(['assumption', 'publicScreening', 'verifiedSurvey']);
const UTILITY_SOURCES = new Set(['missing', 'ownerPlan', 'fieldVerified']);
const BEDDING_MATERIALS = new Set(['sand03to08', 'unspecified', 'other']);
const DEPTH_POINT_SOURCES = new Set(['default', 'manual', 'surveyed']);
const DEPTH_ZONE_ROLES = new Set(['entry', 'center', 'exit']);
const DEPTH_ENDPOINTS = new Set(['start', 'end']);

const DEFAULT_ROUTE_POINTS = Object.freeze([
  Object.freeze({ id: 'a', kind: 'endpoint', label: 'A', coordinate: Object.freeze([26.0937, 44.4324]) }),
  Object.freeze({ id: 'b', kind: 'endpoint', label: 'B', coordinate: Object.freeze([26.1112, 44.4252]) }),
]);
const DEFAULT_ROUTE_LENGTH_M = routeLengthMeters(DEFAULT_ROUTE_POINTS);

const DEFAULT_LEGACY_CROSSING = Object.freeze({
  enabled: false,
  stationM: Math.min(800, DEFAULT_ROUTE_LENGTH_M),
  utilityType: 'water',
  angleDeg: 90,
  gasPosition: 'above',
  verticalClearanceM: 0.25,
  protectiveSleeve: false,
  ownerApprovalDocumented: false,
});

export const DEFAULT_STATE = Object.freeze({
  schemaVersion: GAS_STATE_SCHEMA_VERSION,
  catalogVersion: PIPE_CATALOG_VERSION,
  project: {
    name: 'Gas route #1',
    osdCapacityKnown: false,
  },
  route: {
    id: MAIN_ROUTE_ID,
    editMode: 'inspect',
    selectedSegmentId: 'a:b',
    selectedPointId: null,
    selectedEventId: null,
    selectedDepthPointId: null,
    profileEditMode: false,
    stationM: 430,
    points: DEFAULT_ROUTE_POINTS,
  },
  connection: {
    assetId: null,
    coordinate: null,
    snapToleranceM: DEFAULT_NETWORK_SNAP_TOLERANCE_M,
  },
  pipe: DEFAULT_PIPE_SELECTION,
  pipeSections: [
    {
      id: 'pipe-section-main',
      routeId: MAIN_ROUTE_ID,
      startStationM: 0,
      endStationM: DEFAULT_ROUTE_LENGTH_M,
      catalogVersion: PIPE_CATALOG_VERSION,
      productId: DEFAULT_PIPE_PRODUCT_ID,
      material: DEFAULT_PIPE_SELECTION.material,
      diameterMm: DEFAULT_PIPE_SELECTION.diameterMm,
      sdr: DEFAULT_PIPE_SELECTION.sdr,
      designPressureBar: DEFAULT_PIPE_SELECTION.designPressureBar,
      inheritsDefault: true,
    },
  ],
  depthPoints: [
    {
      id: 'depth-a',
      routeId: MAIN_ROUTE_ID,
      stationM: 0,
      coverM: 1,
      source: 'default',
      inheritsDefault: true,
      endpoint: 'start',
      routeEventId: null,
      zoneRole: null,
    },
    {
      id: 'depth-b',
      routeId: MAIN_ROUTE_ID,
      stationM: DEFAULT_ROUTE_LENGTH_M,
      coverM: 1,
      source: 'default',
      inheritsDefault: true,
      endpoint: 'end',
      routeEventId: null,
      zoneRole: null,
    },
  ],
  routeEvents: [],
  // Temporary compatibility projection for v1 consumers. New code writes routeEvents.
  crossing: DEFAULT_LEGACY_CROSSING,
  trench: {
    coverM: 1,
    widthM: 0.55,
    beddingM: 0.1,
    beddingMaterial: 'sand03to08',
  },
  regulatory: {
    reducedCover: {
      osdAgreement: false,
      additionalProtection: false,
    },
  },
  screening: {
    obstaclesEnabled: true,
    proximityThresholdM: DEFAULT_OBSTACLE_PROXIMITY_M,
  },
  data: {
    groundSource: 'assumption',
    utilitySource: 'missing',
    startElevationM: 82,
    endElevationM: 85,
  },
  segmentSettings: {
    'a:b': { groundType: 'common', surfaceType: 'greenfield' },
  },
  preferences: {
    locale: 'en-US',
    units: 'metric',
    currency: 'EUR',
    darkMode: false,
  },
});

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function mergeObjects(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return source;
  const output = { ...target };
  Object.entries(source).forEach(([key, value]) => {
    if (
      value && typeof value === 'object' && !Array.isArray(value)
      && target?.[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
    ) {
      output[key] = mergeObjects(target[key], value);
    } else {
      output[key] = value;
    }
  });
  return output;
}

function safeChoice(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

function finiteNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function migrateIncomingState(incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return {};
  const migrated = clone(incoming);
  const incomingVersion = Math.max(1, Math.floor(finiteNumber(migrated.schemaVersion, 1)));
  migrated.route = migrated.route && typeof migrated.route === 'object' ? migrated.route : {};
  migrated.route.id = String(migrated.route.id || MAIN_ROUTE_ID);

  const hasRouteEvents = Array.isArray(migrated.routeEvents);
  if (!hasRouteEvents && incomingVersion < GAS_STATE_SCHEMA_VERSION) {
    const migratedCrossing = legacyCrossingToRouteEvent(migrated.crossing, migrated.route.id);
    migrated.routeEvents = migratedCrossing ? [migratedCrossing] : [];
    if (migratedCrossing && !migrated.route.selectedEventId) {
      migrated.route.selectedEventId = migratedCrossing.id;
    }
  }

  migrated.schemaVersion = GAS_STATE_SCHEMA_VERSION;
  migrated.catalogVersion = PIPE_CATALOG_VERSION;
  return migrated;
}

function normalizeRoutePoints(points) {
  const source = Array.isArray(points) ? points : [];
  const start = source.find((point) => point?.id === 'a') || DEFAULT_STATE.route.points[0];
  const end = source.find((point) => point?.id === 'b') || DEFAULT_STATE.route.points[1];
  const waypointIds = new Set();
  const waypoints = source.filter((point) => {
    if (!point || point.id === 'a' || point.id === 'b') return false;
    const id = String(point.id || '').trim();
    if (!id || waypointIds.has(id)) return false;
    waypointIds.add(id);
    return true;
  }).map((point, index) => ({
    id: String(point.id),
    kind: 'waypoint',
    label: String(index + 1),
    coordinate: normalizeCoordinate(point.coordinate),
  }));

  return [
    { id: 'a', kind: 'endpoint', label: 'A', coordinate: normalizeCoordinate(start.coordinate) },
    ...waypoints,
    { id: 'b', kind: 'endpoint', label: 'B', coordinate: normalizeCoordinate(end.coordinate) },
  ];
}

function normalizeSegmentSettings(points, settings = {}) {
  return Object.fromEntries(buildRouteSegments(points).map((segment) => {
    const incoming = settings?.[segment.id] || {};
    const groundType = Object.hasOwn(GROUND_TYPES, incoming.groundType) ? incoming.groundType : 'common';
    const surfaceType = Object.hasOwn(SURFACE_TYPES, incoming.surfaceType) ? incoming.surfaceType : 'greenfield';
    return [segment.id, { groundType, surfaceType }];
  }));
}

function normalizeRouteEvents(events, routeLengthM) {
  const ids = new Set();
  return (Array.isArray(events) ? events : []).map((event, index) => {
    let fallbackId = String(event?.id || `event-${index + 1}`);
    while (ids.has(fallbackId)) fallbackId = `${fallbackId}-${index + 1}`;
    ids.add(fallbackId);
    const normalized = normalizeRouteEvent(
      { ...event, id: fallbackId, routeId: MAIN_ROUTE_ID },
      routeLengthM,
      fallbackId,
    );
    normalized.routeId = MAIN_ROUTE_ID;
    return normalized;
  });
}

function normalizePipeSections(sections, routeLengthM, defaultPipe) {
  const ids = new Set();
  const normalized = (Array.isArray(sections) ? sections : []).map((section, index) => {
    let id = String(section?.id || `pipe-section-${index + 1}`);
    while (ids.has(id)) id = `${id}-${index + 1}`;
    ids.add(id);
    const startStationM = clamp(finiteNumber(section?.startStationM, 0), 0, routeLengthM);
    const endStationM = clamp(
      finiteNumber(section?.endStationM, routeLengthM),
      startStationM,
      routeLengthM,
    );
    const inheritsDefault = section?.inheritsDefault !== false;
    const selection = inheritsDefault
      ? defaultPipe
      : normalizePipeSelection(section?.pipe || section || {}, defaultPipe);
    return {
      id,
      routeId: MAIN_ROUTE_ID,
      startStationM,
      endStationM,
      ...selection,
      inheritsDefault,
    };
  }).filter((section) => routeLengthM === 0 || section.endStationM > section.startStationM);

  // Until section editing is exposed, the inherited main section must always cover
  // the full route. This also prevents route edits from leaving an unmodelled tail.
  if (normalized.length === 1 && normalized[0].inheritsDefault) {
    normalized[0].startStationM = 0;
    normalized[0].endStationM = routeLengthM;
    return normalized;
  }
  if (normalized.length > 0) return normalized;
  return [{
    id: 'pipe-section-main',
    routeId: MAIN_ROUTE_ID,
    startStationM: 0,
    endStationM: routeLengthM,
    ...defaultPipe,
    inheritsDefault: true,
  }];
}

function normalizeDepthPoints(points, routeLengthM, defaultCoverM, routeEvents = []) {
  const ids = new Set();
  const eventById = new Map((Array.isArray(routeEvents) ? routeEvents : []).map((event) => [event.id, event]));
  const sourcePoints = Array.isArray(points) ? points : [];
  const endpointCandidate = (endpoint) => sourcePoints.find((point) => (
    point?.endpoint === endpoint
    || (endpoint === 'start' && point?.id === 'depth-a')
    || (endpoint === 'end' && point?.id === 'depth-b')
  ));
  const endpointCandidates = new Set([
    endpointCandidate('start'),
    endpointCandidate('end'),
  ].filter(Boolean));

  // Inherited endpoints are regenerated for the current route length. Manual or
  // surveyed endpoint values remain attached to A/B through route geometry edits.
  const editablePoints = sourcePoints.filter((point) => (
    !endpointCandidates.has(point)
    && (point?.inheritsDefault === false || ['manual', 'surveyed'].includes(point?.source) || point?.routeEventId)
  ));

  const normalized = editablePoints.map((point, index) => {
    let id = String(point?.id || `depth-${index + 1}`);
    while (ids.has(id)) id = `${id}-${index + 1}`;
    ids.add(id);
    const routeEventId = point?.routeEventId && eventById.has(String(point.routeEventId))
      ? String(point.routeEventId)
      : null;
    const zoneRole = routeEventId && DEPTH_ZONE_ROLES.has(point?.zoneRole) ? point.zoneRole : null;
    const zoneStations = zoneRole ? routeEventDepthZoneStations(eventById.get(routeEventId), routeLengthM) : null;
    return {
      id,
      routeId: MAIN_ROUTE_ID,
      stationM: zoneStations
        ? zoneStations[zoneRole]
        : clamp(finiteNumber(point?.stationM, 0), 0, routeLengthM),
      coverM: clampPipeCover(point?.coverM, defaultCoverM),
      source: safeChoice(point?.source, DEPTH_POINT_SOURCES, 'manual'),
      inheritsDefault: false,
      endpoint: null,
      routeEventId,
      zoneRole,
    };
  });

  ['start', 'end'].forEach((endpoint) => {
    const candidate = endpointCandidate(endpoint);
    const defaultId = endpoint === 'start' ? 'depth-a' : 'depth-b';
    let id = String(candidate?.id || defaultId);
    while (ids.has(id)) id = `${id}-${endpoint}`;
    ids.add(id);
    const inheritsDefault = candidate?.inheritsDefault !== false && candidate?.source !== 'manual' && candidate?.source !== 'surveyed';
    normalized.push({
      id,
      routeId: MAIN_ROUTE_ID,
      stationM: endpoint === 'start' ? 0 : routeLengthM,
      coverM: inheritsDefault
        ? defaultCoverM
        : clampPipeCover(candidate?.coverM, defaultCoverM),
      source: inheritsDefault
        ? 'default'
        : safeChoice(candidate?.source, DEPTH_POINT_SOURCES, 'manual'),
      inheritsDefault,
      endpoint,
      routeEventId: null,
      zoneRole: null,
    });
  });

  return normalized.sort((left, right) => (
    left.stationM - right.stationM
    || Number(Boolean(left.endpoint)) - Number(Boolean(right.endpoint))
    || left.id.localeCompare(right.id)
  ));
}

export function normalizeState(incoming = {}) {
  const migrated = migrateIncomingState(incoming);
  const merged = mergeObjects(clone(DEFAULT_STATE), migrated);
  const points = normalizeRoutePoints(merged.route?.points);
  const segments = buildRouteSegments(points);
  const segmentSettings = normalizeSegmentSettings(points, merged.segmentSettings);
  const segmentIds = new Set(segments.map((segment) => segment.id));
  const waypointIds = new Set(points.filter((point) => point.kind === 'waypoint').map((point) => point.id));
  const locale = ['en-US', 'ro-RO', 'de-DE'].includes(merged.preferences?.locale)
    ? merged.preferences.locale
    : 'en-US';
  const pipe = normalizePipeSelection(merged.pipe, DEFAULT_PIPE_SELECTION);

  const normalized = {
    schemaVersion: GAS_STATE_SCHEMA_VERSION,
    catalogVersion: PIPE_CATALOG_VERSION,
    project: {
      name: String(merged.project?.name || DEFAULT_STATE.project.name).trim().slice(0, 80) || DEFAULT_STATE.project.name,
      osdCapacityKnown: Boolean(merged.project?.osdCapacityKnown),
    },
    route: {
      id: MAIN_ROUTE_ID,
      editMode: safeChoice(merged.route?.editMode, ROUTE_MODES, 'inspect'),
      selectedSegmentId: segmentIds.has(merged.route?.selectedSegmentId)
        ? merged.route.selectedSegmentId
        : segments[0]?.id || null,
      selectedPointId: waypointIds.has(merged.route?.selectedPointId) ? merged.route.selectedPointId : null,
      selectedEventId: null,
      selectedDepthPointId: null,
      profileEditMode: Boolean(merged.route?.profileEditMode),
      stationM: 0,
      points,
    },
    connection: serializeNetworkConnection(
      null,
      finiteNumber(
        merged.connection?.snapToleranceM,
        DEFAULT_NETWORK_SNAP_TOLERANCE_M,
      ),
    ),
    pipe,
    pipeSections: [],
    depthPoints: [],
    routeEvents: [],
    crossing: clone(DEFAULT_LEGACY_CROSSING),
    trench: {
      coverM: clamp(finiteNumber(merged.trench?.coverM, 1), 0.3, 3),
      widthM: clamp(finiteNumber(merged.trench?.widthM, 0.55), 0.3, 2),
      beddingM: clamp(finiteNumber(merged.trench?.beddingM, 0.1), 0.05, 0.5),
      beddingMaterial: safeChoice(merged.trench?.beddingMaterial, BEDDING_MATERIALS, 'sand03to08'),
    },
    regulatory: {
      reducedCover: {
        osdAgreement: Boolean(merged.regulatory?.reducedCover?.osdAgreement),
        additionalProtection: Boolean(merged.regulatory?.reducedCover?.additionalProtection),
      },
    },
    screening: {
      obstaclesEnabled: merged.screening?.obstaclesEnabled !== false,
      proximityThresholdM: clamp(
        finiteNumber(
          merged.screening?.proximityThresholdM,
          DEFAULT_OBSTACLE_PROXIMITY_M,
        ),
        MIN_OBSTACLE_PROXIMITY_M,
        MAX_OBSTACLE_PROXIMITY_M,
      ),
    },
    data: {
      groundSource: safeChoice(merged.data?.groundSource, GROUND_SOURCES, 'assumption'),
      utilitySource: safeChoice(merged.data?.utilitySource, UTILITY_SOURCES, 'missing'),
      startElevationM: clamp(finiteNumber(merged.data?.startElevationM, 82), -50, 2_500),
      endElevationM: clamp(finiteNumber(merged.data?.endElevationM, 85), -50, 2_500),
    },
    segmentSettings,
    preferences: {
      locale,
      units: ['metric', 'imperial'].includes(merged.preferences?.units) ? merged.preferences.units : 'metric',
      currency: ['EUR', 'RON', 'USD'].includes(merged.preferences?.currency) ? merged.preferences.currency : 'EUR',
      darkMode: Boolean(merged.preferences?.darkMode),
    },
  };

  const startCoordinate = normalized.route.points[0].coordinate;
  const requestedAssetId = String(merged.connection?.assetId || '').trim();
  const requestedCoordinate = Array.isArray(merged.connection?.coordinate)
    ? merged.connection.coordinate
    : startCoordinate;
  const requestedCandidate = requestedAssetId
    ? projectCoordinateToNetworkAsset(requestedCoordinate, requestedAssetId)
    : null;
  const requestedMatchesStart = requestedCandidate
    && haversineDistanceMeters(startCoordinate, requestedCandidate.coordinate)
      <= NETWORK_CONNECTION_EPSILON_M;
  const coincidentCandidate = requestedMatchesStart
    ? requestedCandidate
    : findNearestNetworkPoint(startCoordinate);
  if (
    coincidentCandidate
    && coincidentCandidate.distanceM <= NETWORK_CONNECTION_EPSILON_M
  ) {
    normalized.route.points[0].coordinate = normalizeCoordinate(
      coincidentCandidate.coordinate,
      startCoordinate,
    );
    normalized.connection = serializeNetworkConnection(
      coincidentCandidate,
      normalized.connection.snapToleranceM,
    );
  }

  const normalizedRouteLengthM = routeLengthMeters(normalized.route.points);
  normalized.route.stationM = clamp(
    finiteNumber(merged.route?.stationM, 0),
    0,
    normalizedRouteLengthM,
  );
  normalized.routeEvents = normalizeRouteEvents(merged.routeEvents, normalizedRouteLengthM);
  const eventIds = new Set(normalized.routeEvents.map((event) => event.id));
  normalized.route.selectedEventId = eventIds.has(merged.route?.selectedEventId)
    ? merged.route.selectedEventId
    : normalized.routeEvents[0]?.id || null;
  normalized.pipeSections = normalizePipeSections(
    merged.pipeSections,
    normalizedRouteLengthM,
    normalized.pipe,
  );
  normalized.depthPoints = normalizeDepthPoints(
    merged.depthPoints,
    normalizedRouteLengthM,
    normalized.trench.coverM,
    normalized.routeEvents,
  );
  const depthPointIds = new Set(normalized.depthPoints.map((point) => point.id));
  normalized.route.selectedDepthPointId = depthPointIds.has(merged.route?.selectedDepthPointId)
    ? merged.route.selectedDepthPointId
    : null;
  normalized.crossing = routeEventToLegacyCrossing(
    firstUtilityCrossingEvent(normalized),
    DEFAULT_LEGACY_CROSSING.stationM,
  );
  return normalized;
}

function loadLocalState() {
  const keys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
  for (const key of keys) {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      // Local persistence is optional; continue with the next compatible key.
    }
  }
  return null;
}

function setAtPath(object, path, value) {
  const parts = String(path).split('.').filter(Boolean);
  if (parts.length === 0) return;
  let target = object;
  parts.slice(0, -1).forEach((part) => {
    if (!target[part] || typeof target[part] !== 'object') target[part] = {};
    target = target[part];
  });
  target[parts.at(-1)] = value;
}

function depthPointStationIsLocked(point) {
  return DEPTH_ENDPOINTS.has(point?.endpoint)
    || Boolean(point?.routeEventId && DEPTH_ZONE_ROLES.has(point?.zoneRole));
}

function selectSegmentAtStation(nextState, stationM) {
  const station = interpolateRoute(nextState.route.points, stationM);
  if (station.segment) nextState.route.selectedSegmentId = station.segment.id;
}

function createDepthPointId(prefix = 'depth') {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export class GasConfiguratorStore {
  constructor(initialState = null) {
    this.state = normalizeState(initialState || loadLocalState() || DEFAULT_STATE);
    this.listeners = new Set();
    this.history = [];
  }

  get() {
    return this.state;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state, { source: 'initial' });
    return () => this.listeners.delete(listener);
  }

  notify(meta = {}) {
    this.listeners.forEach((listener) => listener(this.state, meta));
  }

  persist() {
    try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch { /* optional */ }
  }

  commit(nextState, { recordHistory = true, persist = true, source = 'update' } = {}) {
    const normalized = normalizeState(nextState);
    if (JSON.stringify(normalized) === JSON.stringify(this.state)) return false;
    if (recordHistory) {
      this.history.push(clone(this.state));
      if (this.history.length > MAX_HISTORY) this.history.shift();
    }
    this.state = normalized;
    if (persist) this.persist();
    this.notify({ source });
    return true;
  }

  update(path, value, options = {}) {
    const next = clone(this.state);
    setAtPath(next, path, value);
    return this.commit(next, { source: path, ...options });
  }

  setPipeSelection(patch = {}) {
    const next = clone(this.state);
    next.pipe = { ...next.pipe, ...patch, productId: null };
    return this.commit(next, { source: 'pipe-selection' });
  }

  setTrenchCover(coverM) {
    const next = clone(this.state);
    next.trench.coverM = coverM;
    return this.commit(next, { source: 'trench-cover' });
  }

  setProfileEditMode(enabled) {
    return this.update('route.profileEditMode', Boolean(enabled), {
      recordHistory: false,
      source: 'depth-profile-mode',
    });
  }

  selectDepthPoint(pointId) {
    const point = this.state.depthPoints.find((candidate) => candidate.id === pointId);
    if (!point) return false;
    const next = clone(this.state);
    next.route.selectedDepthPointId = point.id;
    next.route.stationM = point.stationM;
    selectSegmentAtStation(next, point.stationM);
    return this.commit(next, { recordHistory: false, source: 'depth-point-selection' });
  }

  addDepthPoint(stationM, coverM = null, {
    source = 'manual',
    routeEventId = null,
    zoneRole = null,
    recordHistory = true,
  } = {}) {
    const next = clone(this.state);
    const routeLengthM = routeLengthMeters(next.route.points);
    const requestedStationM = clamp(finiteNumber(stationM, next.route.stationM), 0, routeLengthM);
    const requestedCoverM = clampPipeCover(
      coverM,
      coverAtChainage(next.depthPoints, requestedStationM, routeLengthM, next.trench.coverM),
    );
    const nearby = !routeEventId && next.depthPoints.find((point) => (
      !point.routeEventId
      && Math.abs(point.stationM - requestedStationM) <= DEPTH_POINT_MATCH_TOLERANCE_M
    ));
    if (nearby) {
      nearby.coverM = requestedCoverM;
      nearby.source = source === 'surveyed' ? 'surveyed' : 'manual';
      nearby.inheritsDefault = false;
      next.route.selectedDepthPointId = nearby.id;
      next.route.stationM = nearby.stationM;
      selectSegmentAtStation(next, nearby.stationM);
      this.commit(next, { source: 'depth-point-update-nearby', recordHistory });
      return nearby.id;
    }

    const id = createDepthPointId('depth-manual');
    next.depthPoints.push({
      id,
      routeId: MAIN_ROUTE_ID,
      stationM: requestedStationM,
      coverM: requestedCoverM,
      source: source === 'surveyed' ? 'surveyed' : 'manual',
      inheritsDefault: false,
      endpoint: null,
      routeEventId: routeEventId ? String(routeEventId) : null,
      zoneRole: DEPTH_ZONE_ROLES.has(zoneRole) ? zoneRole : null,
    });
    next.route.selectedDepthPointId = id;
    next.route.stationM = requestedStationM;
    next.route.profileEditMode = true;
    selectSegmentAtStation(next, requestedStationM);
    return this.commit(next, { source: 'depth-point-add', recordHistory }) ? id : false;
  }

  updateSelectedDepthPoint(path, value, options = {}) {
    const selectedId = this.state.route.selectedDepthPointId;
    const next = clone(this.state);
    const point = next.depthPoints.find((candidate) => candidate.id === selectedId);
    if (!point) return false;
    if (path === 'stationM' && depthPointStationIsLocked(point)) return false;

    if (path === 'coverM') {
      point.coverM = clampPipeCover(value, next.trench.coverM);
      point.inheritsDefault = false;
      if (point.source === 'default') point.source = 'manual';
    } else if (path === 'stationM') {
      const routeLengthM = routeLengthMeters(next.route.points);
      point.stationM = clamp(finiteNumber(value, point.stationM), 0, routeLengthM);
      next.route.stationM = point.stationM;
      selectSegmentAtStation(next, point.stationM);
    } else if (path === 'source') {
      point.source = value === 'surveyed' ? 'surveyed' : 'manual';
      point.inheritsDefault = false;
    } else {
      setAtPath(point, path, value);
    }
    return this.commit(next, { source: `depth-point-${path}`, ...options });
  }

  moveDepthPoint(pointId, stationM, coverM, options = {}) {
    const next = clone(this.state);
    const point = next.depthPoints.find((candidate) => candidate.id === pointId);
    if (!point) return false;
    const routeLengthM = routeLengthMeters(next.route.points);
    if (!depthPointStationIsLocked(point)) {
      point.stationM = clamp(finiteNumber(stationM, point.stationM), 0, routeLengthM);
    }
    point.coverM = clampPipeCover(coverM, point.coverM);
    point.inheritsDefault = false;
    if (point.source === 'default') point.source = 'manual';
    next.route.selectedDepthPointId = point.id;
    next.route.stationM = point.stationM;
    next.route.profileEditMode = true;
    selectSegmentAtStation(next, point.stationM);
    return this.commit(next, {
      recordHistory: false,
      source: 'depth-point-drag',
      ...options,
    });
  }

  removeSelectedDepthPoint() {
    const selectedId = this.state.route.selectedDepthPointId;
    const index = this.state.depthPoints.findIndex((point) => point.id === selectedId);
    if (index < 0 || DEPTH_ENDPOINTS.has(this.state.depthPoints[index]?.endpoint)) return false;
    const next = clone(this.state);
    const removed = next.depthPoints[index];
    next.depthPoints.splice(index, 1);
    const replacement = next.depthPoints
      .filter((point) => point.id !== removed.id)
      .sort((left, right) => Math.abs(left.stationM - removed.stationM) - Math.abs(right.stationM - removed.stationM))[0];
    next.route.selectedDepthPointId = replacement?.id || null;
    if (replacement) {
      next.route.stationM = replacement.stationM;
      selectSegmentAtStation(next, replacement.stationM);
    }
    return this.commit(next, { source: 'depth-point-remove' });
  }

  resetDepthProfile() {
    const next = clone(this.state);
    next.depthPoints = [];
    next.route.selectedDepthPointId = null;
    return this.commit(next, { source: 'depth-profile-reset' });
  }

  createDepthZoneForRouteEvent(eventId, coverM = null) {
    const next = clone(this.state);
    const event = next.routeEvents.find((candidate) => candidate.id === eventId);
    const routeLengthM = routeLengthMeters(next.route.points);
    const stations = routeEventDepthZoneStations(event, routeLengthM);
    if (!event || !stations) return false;
    const targetCoverM = clampPipeCover(
      coverM,
      coverAtChainage(next.depthPoints, event.stationM, routeLengthM, next.trench.coverM),
    );
    next.depthPoints = next.depthPoints.filter((point) => point.routeEventId !== event.id);
    const safeEventId = event.id.replace(/[^a-z0-9_-]+/gi, '-');
    const created = ['entry', 'center', 'exit'].map((zoneRole) => ({
      id: `depth-zone-${safeEventId}-${zoneRole}`,
      routeId: MAIN_ROUTE_ID,
      stationM: stations[zoneRole],
      coverM: targetCoverM,
      source: 'manual',
      inheritsDefault: false,
      endpoint: null,
      routeEventId: event.id,
      zoneRole,
    }));
    next.depthPoints.push(...created);
    next.route.selectedDepthPointId = created[1].id;
    next.route.stationM = event.stationM;
    next.route.profileEditMode = true;
    selectSegmentAtStation(next, event.stationM);
    return this.commit(next, { source: 'route-event-depth-zone' });
  }

  recordTransientHistory(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    const normalized = normalizeState(snapshot);
    if (JSON.stringify(normalized) === JSON.stringify(this.state)) return false;
    this.history.push(normalized);
    if (this.history.length > MAX_HISTORY) this.history.shift();
    return true;
  }

  setEditMode(mode) {
    return this.update('route.editMode', mode, { recordHistory: false, source: 'route-mode' });
  }

  selectSegment(segmentId, stationM = null) {
    const next = clone(this.state);
    next.route.selectedSegmentId = segmentId;
    if (stationM !== null) next.route.stationM = stationM;
    return this.commit(next, { recordHistory: false, source: 'route-selection' });
  }

  setStation(stationM) {
    return this.update('route.stationM', stationM, { recordHistory: false, source: 'station' });
  }

  addRouteEvent(type = ROUTE_EVENT_TYPES.utilityCrossing.id) {
    const next = clone(this.state);
    const event = createRouteEvent({
      routeId: MAIN_ROUTE_ID,
      type: ROUTE_EVENT_TYPE_IDS.includes(type) ? type : ROUTE_EVENT_TYPES.utilityCrossing.id,
      stationM: next.route.stationM,
      source: 'manual',
      confirmed: true,
    });
    next.routeEvents.push(event);
    next.route.selectedEventId = event.id;
    return this.commit(next, { source: 'route-event-add' });
  }

  addRouteEventFromObstacle(obstacleEvent) {
    const existing = matchingRouteEventForObstacle(this.state, obstacleEvent);
    if (existing) return this.selectRouteEvent(existing.id);

    const routeEvent = routeEventFromObstacleScreening(obstacleEvent, MAIN_ROUTE_ID);
    if (!routeEvent) return false;
    const next = clone(this.state);
    next.routeEvents.push(routeEvent);
    next.route.selectedEventId = routeEvent.id;
    next.route.stationM = routeEvent.stationM;
    const station = interpolateRoute(next.route.points, routeEvent.stationM);
    if (station.segment) next.route.selectedSegmentId = station.segment.id;
    return this.commit(next, { source: 'route-event-public-crossing-add' });
  }


  selectRouteEvent(eventId) {
    const event = this.state.routeEvents.find((candidate) => candidate.id === eventId);
    if (!event) return false;
    const next = clone(this.state);
    next.route.selectedEventId = event.id;
    next.route.stationM = event.stationM;
    const station = interpolateRoute(next.route.points, event.stationM);
    if (station.segment) next.route.selectedSegmentId = station.segment.id;
    return this.commit(next, { recordHistory: false, source: 'route-event-selection' });
  }

  updateSelectedRouteEvent(path, value, options = {}) {
    const selected = selectedRouteEvent(this.state);
    if (!selected) return false;
    const next = clone(this.state);
    const event = next.routeEvents.find((candidate) => candidate.id === selected.id);
    if (!event) return false;
    setAtPath(event, path, value);
    if (path === 'stationM') {
      next.route.stationM = value;
      const station = interpolateRoute(next.route.points, Number(value));
      if (station.segment) next.route.selectedSegmentId = station.segment.id;
    }
    return this.commit(next, { source: `route-event-${path}`, ...options });
  }

  setRouteEventStation(stationM) {
    return this.updateSelectedRouteEvent('stationM', stationM, {
      recordHistory: false,
      source: 'route-event-station',
    });
  }

  setCrossingStation(stationM) {
    const selected = selectedRouteEvent(this.state);
    const event = isUtilityCrossingEvent(selected) ? selected : firstUtilityCrossingEvent(this.state);
    if (!event) {
      const next = clone(this.state);
      const created = createRouteEvent({
        routeId: MAIN_ROUTE_ID,
        type: ROUTE_EVENT_TYPES.utilityCrossing.id,
        stationM,
      });
      next.routeEvents.push(created);
      next.route.selectedEventId = created.id;
      return this.commit(next, { source: 'route-event-station' });
    }
    if (selected?.id !== event.id) this.selectRouteEvent(event.id);
    return this.setRouteEventStation(stationM);
  }

  removeSelectedRouteEvent() {
    const selectedId = this.state.route.selectedEventId;
    const index = this.state.routeEvents.findIndex((event) => event.id === selectedId);
    if (index < 0) return false;
    const next = clone(this.state);
    const removedEventId = next.routeEvents[index].id;
    next.routeEvents.splice(index, 1);
    next.depthPoints = next.depthPoints.filter((point) => point.routeEventId !== removedEventId);
    if (!next.depthPoints.some((point) => point.id === next.route.selectedDepthPointId)) {
      next.route.selectedDepthPointId = null;
    }
    const replacement = next.routeEvents[Math.min(index, next.routeEvents.length - 1)] || null;
    next.route.selectedEventId = replacement?.id || null;
    if (replacement) next.route.stationM = replacement.stationM;
    return this.commit(next, { source: 'route-event-remove' });
  }

  selectPoint(pointId) {
    return this.update('route.selectedPointId', pointId, { recordHistory: false, source: 'point-selection' });
  }

  movePoint(pointId, coordinate) {
    const next = clone(this.state);
    const point = next.route.points.find((candidate) => candidate.id === pointId);
    if (!point) return false;
    const requestedCoordinate = normalizeCoordinate(coordinate);
    if (pointId === 'a') {
      const nearest = findNearestNetworkPoint(requestedCoordinate);
      if (nearest && nearest.distanceM <= next.connection.snapToleranceM) {
        point.coordinate = nearest.coordinate;
        next.connection = serializeNetworkConnection(
          nearest,
          next.connection.snapToleranceM,
        );
      } else {
        point.coordinate = requestedCoordinate;
        next.connection = serializeNetworkConnection(
          null,
          next.connection.snapToleranceM,
        );
      }
    } else {
      point.coordinate = requestedCoordinate;
    }
    return this.commit(next, { source: 'route-point' });
  }

  connectToNetwork(assetId, coordinate) {
    const candidate = projectCoordinateToNetworkAsset(coordinate, assetId);
    if (!candidate) return false;
    const next = clone(this.state);
    next.route.points[0].coordinate = candidate.coordinate;
    next.route.selectedPointId = null;
    next.connection = serializeNetworkConnection(
      candidate,
      next.connection.snapToleranceM,
    );
    return this.commit(next, { source: 'network-connection' });
  }

  snapStartToNearestNetwork() {
    const start = this.state.route.points[0];
    const candidate = findNearestNetworkPoint(start.coordinate);
    return candidate
      ? this.connectToNetwork(candidate.assetId, candidate.coordinate)
      : false;
  }

  setEndpoint(id, coordinate) {
    if (id !== 'a' && id !== 'b') return false;
    const changed = this.movePoint(id, coordinate);
    if (changed) this.setEditMode('inspect');
    return changed;
  }

  addWaypoint(coordinate) {
    const next = clone(this.state);
    const requestedCoordinate = normalizeCoordinate(coordinate);
    const segments = buildRouteSegments(next.route.points);
    const nearestSegment = segments.reduce((nearest, segment) => {
      const ratio = nearestPointOnSegmentRatio(requestedCoordinate, segment);
      const start = segment.startPoint.coordinate;
      const end = segment.endPoint.coordinate;
      const projected = [
        start[0] + ((end[0] - start[0]) * ratio),
        start[1] + ((end[1] - start[1]) * ratio),
      ];
      const distanceM = haversineDistanceMeters(requestedCoordinate, projected);
      return !nearest || distanceM < nearest.distanceM ? { segment, distanceM } : nearest;
    }, null)?.segment || segments.at(-1);
    if (!nearestSegment) return false;
    const insertIndex = nearestSegment.index + 1;
    const before = next.route.points[nearestSegment.index];
    const end = next.route.points[insertIndex];
    const oldSegmentId = nearestSegment.id;
    const inherited = clone(next.segmentSettings?.[oldSegmentId] || { groundType: 'common', surfaceType: 'greenfield' });
    const id = `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const waypoint = { id, kind: 'waypoint', label: '', coordinate: requestedCoordinate };
    next.route.points.splice(insertIndex, 0, waypoint);
    next.route.selectedPointId = id;
    delete next.segmentSettings[oldSegmentId];
    next.segmentSettings[routeSegmentId(before, waypoint)] = clone(inherited);
    next.segmentSettings[routeSegmentId(waypoint, end)] = clone(inherited);
    next.route.selectedSegmentId = routeSegmentId(before, waypoint);
    return this.commit(next, { source: 'waypoint-add' });
  }

  removeSelectedWaypoint() {
    const selectedId = this.state.route.selectedPointId;
    const index = this.state.route.points.findIndex((point) => point.id === selectedId && point.kind === 'waypoint');
    if (index < 1 || index >= this.state.route.points.length - 1) return false;

    const next = clone(this.state);
    const previous = next.route.points[index - 1];
    const removed = next.route.points[index];
    const following = next.route.points[index + 1];
    const inherited = clone(
      next.segmentSettings[routeSegmentId(previous, removed)]
      || next.segmentSettings[routeSegmentId(removed, following)]
      || { groundType: 'common', surfaceType: 'greenfield' },
    );
    next.route.points.splice(index, 1);
    next.route.selectedPointId = null;
    next.segmentSettings[routeSegmentId(previous, following)] = inherited;
    return this.commit(next, { source: 'waypoint-remove' });
  }

  clearWaypoints() {
    const next = clone(this.state);
    const start = next.route.points[0];
    const end = next.route.points.at(-1);
    const selectedSetting = clone(
      next.segmentSettings[next.route.selectedSegmentId]
      || { groundType: 'common', surfaceType: 'greenfield' },
    );
    next.route.points = [start, end];
    next.route.selectedPointId = null;
    next.route.selectedSegmentId = routeSegmentId(start, end);
    next.segmentSettings = { [next.route.selectedSegmentId]: selectedSetting };
    return this.commit(next, { source: 'waypoints-clear' });
  }

  setSegmentSetting(key, value) {
    const segmentId = this.state.route.selectedSegmentId;
    if (!segmentId) return false;
    return this.update(`segmentSettings.${segmentId}.${key}`, value, { source: `segment-${key}` });
  }

  undo() {
    const previous = this.history.pop();
    if (!previous) return false;
    this.state = normalizeState(previous);
    this.persist();
    this.notify({ source: 'undo' });
    return true;
  }

  reset() {
    const preferences = clone(this.state.preferences);
    this.commit({ ...clone(DEFAULT_STATE), preferences }, { source: 'reset' });
    return true;
  }

  captureState() {
    return clone(this.state);
  }

  restoreState(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    return this.commit(snapshot, { source: 'restore' });
  }
}
