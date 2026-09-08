import { clamp } from './geometry.js';

export const MAIN_ROUTE_ID = 'main';

export const ROUTE_EVENT_TYPES = Object.freeze({
  utilityCrossing: Object.freeze({
    id: 'utility-crossing',
    labelKey: 'option.routeEventType.utilityCrossing',
    profileLabelKey: 'view.routeEvent.utilityCrossing',
    color: '#9b3fa8',
  }),
  roadCrossing: Object.freeze({
    id: 'road-crossing',
    labelKey: 'option.routeEventType.roadCrossing',
    profileLabelKey: 'view.routeEvent.roadCrossing',
    color: '#4b5862',
  }),
  railwayCrossing: Object.freeze({
    id: 'railway-crossing',
    labelKey: 'option.routeEventType.railwayCrossing',
    profileLabelKey: 'view.routeEvent.railwayCrossing',
    color: '#b45c19',
  }),
  watercourseCrossing: Object.freeze({
    id: 'watercourse-crossing',
    labelKey: 'option.routeEventType.watercourseCrossing',
    profileLabelKey: 'view.routeEvent.watercourseCrossing',
    color: '#267dad',
  }),
});

export const ROUTE_EVENT_TYPE_IDS = Object.freeze(
  Object.values(ROUTE_EVENT_TYPES).map((type) => type.id),
);

export const ROUTE_EVENT_TYPE_BY_OBSTACLE_TYPE = Object.freeze({
  road: ROUTE_EVENT_TYPES.roadCrossing.id,
  railway: ROUTE_EVENT_TYPES.railwayCrossing.id,
  waterway: ROUTE_EVENT_TYPES.watercourseCrossing.id,
});

export const ROUTE_EVENT_SOURCES = Object.freeze([
  'manual',
  'publicScreening',
  'ownerPlan',
  'fieldVerified',
]);

export const CROSSING_UTILITY_TYPES = Object.freeze([
  'water',
  'sewer',
  'electric',
  'telecom',
  'districtHeating',
  'other',
]);

export const CROSSING_GAS_POSITIONS = Object.freeze(['above', 'below']);
export const CROSSING_INSTALLATION_METHODS = Object.freeze([
  'notSpecified',
  'openTrench',
  'trenchless',
]);

function numberOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function safeChoice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function createRouteEvent({
  id = null,
  routeId = MAIN_ROUTE_ID,
  type = ROUTE_EVENT_TYPES.utilityCrossing.id,
  stationM = 0,
  source = 'manual',
  sourceFeatureId = null,
  confirmed = true,
  label = '',
  crossing = {},
} = {}) {
  const normalizedType = safeChoice(type, ROUTE_EVENT_TYPE_IDS, ROUTE_EVENT_TYPES.utilityCrossing.id);
  return {
    id: String(id || `event-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`),
    routeId: String(routeId || MAIN_ROUTE_ID),
    type: normalizedType,
    stationM: Math.max(0, numberOr(stationM, 0)),
    source: safeChoice(source, ROUTE_EVENT_SOURCES, 'manual'),
    sourceFeatureId: sourceFeatureId == null ? null : String(sourceFeatureId),
    confirmed: Boolean(confirmed),
    label: String(label || '').trim().slice(0, 80),
    crossing: {
      angleDeg: clamp(numberOr(crossing.angleDeg, 90), 0, 90),
      obstacleWidthM: clamp(numberOr(crossing.obstacleWidthM, 0), 0, 500),
      installationMethod: safeChoice(
        crossing.installationMethod,
        CROSSING_INSTALLATION_METHODS,
        'notSpecified',
      ),
      utilityType: safeChoice(crossing.utilityType, CROSSING_UTILITY_TYPES, 'water'),
      gasPosition: safeChoice(crossing.gasPosition, CROSSING_GAS_POSITIONS, 'above'),
      verticalClearanceM: clamp(numberOr(crossing.verticalClearanceM, 0.25), 0, 5),
      protectiveSleeve: Boolean(
        typeof crossing.protectiveSleeve === 'object'
          ? crossing.protectiveSleeve?.enabled
          : crossing.protectiveSleeve,
      ),
      ownerApprovalDocumented: Boolean(crossing.ownerApprovalDocumented),
    },
  };
}

export function routeEventFromObstacleScreening(obstacleEvent = {}, routeId = MAIN_ROUTE_ID) {
  const type = ROUTE_EVENT_TYPE_BY_OBSTACLE_TYPE[obstacleEvent?.type];
  if (!type || obstacleEvent?.relation !== 'crossing') return null;
  const stationM = Math.max(0, numberOr(obstacleEvent.stationM, 0));
  const featureId = String(obstacleEvent.featureId || obstacleEvent.id || 'public-feature');
  const stableFeatureId = featureId.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80);
  return createRouteEvent({
    id: `event-${stableFeatureId}-${Math.round(stationM * 10)}`,
    routeId,
    type,
    stationM,
    source: 'publicScreening',
    sourceFeatureId: featureId,
    confirmed: false,
    label: obstacleEvent.name || obstacleEvent.subtype || '',
    crossing: {
      angleDeg: obstacleEvent.angleDeg,
      obstacleWidthM: 0,
      installationMethod: 'notSpecified',
    },
  });
}


export function matchingRouteEventForObstacle(state, obstacleEvent = {}) {
  const converted = routeEventFromObstacleScreening(
    obstacleEvent,
    state?.route?.id || MAIN_ROUTE_ID,
  );
  if (!converted) return null;
  return getRouteEvents(state).find((candidate) => (
    candidate.source === 'publicScreening'
    && candidate.sourceFeatureId === converted.sourceFeatureId
    && candidate.type === converted.type
    && Math.abs((Number(candidate.stationM) || 0) - converted.stationM) <= 1
  )) || null;
}

export function normalizeRouteEvent(event, routeLengthM, fallbackId) {
  const normalized = createRouteEvent({
    ...event,
    id: String(event?.id || fallbackId || ''),
    crossing: event?.crossing || {},
  });
  normalized.stationM = clamp(normalized.stationM, 0, Math.max(0, numberOr(routeLengthM, 0)));
  return normalized;
}

export function isUtilityCrossingEvent(event) {
  return event?.type === ROUTE_EVENT_TYPES.utilityCrossing.id;
}

export function getRouteEvents(state, { type = null } = {}) {
  const events = Array.isArray(state?.routeEvents) ? state.routeEvents : [];
  return type ? events.filter((event) => event?.type === type) : events;
}

export function selectedRouteEvent(state) {
  const events = getRouteEvents(state);
  return events.find((event) => event.id === state?.route?.selectedEventId) || null;
}

export function firstUtilityCrossingEvent(state) {
  return getRouteEvents(state).find(isUtilityCrossingEvent) || null;
}

export function routeEventTypeDefinition(type) {
  return Object.values(ROUTE_EVENT_TYPES).find((definition) => definition.id === type)
    || ROUTE_EVENT_TYPES.utilityCrossing;
}

export function legacyCrossingToRouteEvent(crossing = {}, routeId = MAIN_ROUTE_ID) {
  if (!crossing?.enabled) return null;
  return createRouteEvent({
    id: 'event-legacy-utility-1',
    routeId,
    type: ROUTE_EVENT_TYPES.utilityCrossing.id,
    stationM: crossing.stationM,
    source: 'manual',
    confirmed: true,
    crossing: {
      angleDeg: crossing.angleDeg,
      utilityType: crossing.utilityType,
      gasPosition: crossing.gasPosition,
      verticalClearanceM: crossing.verticalClearanceM,
      protectiveSleeve: crossing.protectiveSleeve,
      ownerApprovalDocumented: crossing.ownerApprovalDocumented,
    },
  });
}

export function routeEventToLegacyCrossing(event = null, fallbackStationM = 0) {
  if (!event || !isUtilityCrossingEvent(event)) {
    return {
      enabled: false,
      stationM: Math.max(0, numberOr(fallbackStationM, 0)),
      utilityType: 'water',
      angleDeg: 90,
      gasPosition: 'above',
      verticalClearanceM: 0.25,
      protectiveSleeve: false,
      ownerApprovalDocumented: false,
    };
  }
  return {
    enabled: true,
    stationM: event.stationM,
    utilityType: event.crossing.utilityType,
    angleDeg: event.crossing.angleDeg,
    gasPosition: event.crossing.gasPosition,
    verticalClearanceM: event.crossing.verticalClearanceM,
    protectiveSleeve: event.crossing.protectiveSleeve,
    ownerApprovalDocumented: event.crossing.ownerApprovalDocumented,
  };
}

export function routeEventDisplayIndex(state, event) {
  const sameType = getRouteEvents(state).filter((candidate) => candidate.type === event?.type);
  const index = sameType.findIndex((candidate) => candidate.id === event?.id);
  return Math.max(0, index) + 1;
}
