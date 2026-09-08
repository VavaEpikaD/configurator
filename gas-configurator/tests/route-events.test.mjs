import assert from 'node:assert/strict';
import test from 'node:test';
import { routeLengthMeters } from '../src/domain/geometry.js';
import {
  matchingRouteEventForObstacle,
  routeEventFromObstacleScreening,
  ROUTE_EVENT_TYPES,
} from '../src/domain/routeEvents.js';
import {
  DEFAULT_STATE,
  GAS_STATE_SCHEMA_VERSION,
  GasConfiguratorStore,
  normalizeState,
} from '../src/state.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function detectedRoad(overrides = {}) {
  return {
    id: 'osm-way-123:crossing:500',
    featureId: 'osm-way-123',
    type: 'road',
    relation: 'crossing',
    name: 'DN 7',
    stationM: 500,
    angleDeg: 84,
    segmentId: 'a:b',
    ...overrides,
  };
}

test('legacy single-crossing state migrates through the route-event model into schema v4', () => {
  const state = normalizeState({
    schemaVersion: 2,
    crossing: {
      enabled: true,
      stationM: 350,
      utilityType: 'electric',
      angleDeg: 73,
      gasPosition: 'below',
      verticalClearanceM: 0.17,
      protectiveSleeve: true,
      ownerApprovalDocumented: true,
    },
  });

  assert.equal(state.schemaVersion, GAS_STATE_SCHEMA_VERSION);
  assert.equal(state.routeEvents.length, 1);
  assert.equal(state.routeEvents[0].type, ROUTE_EVENT_TYPES.utilityCrossing.id);
  assert.equal(state.routeEvents[0].stationM, 350);
  assert.equal(state.routeEvents[0].crossing.utilityType, 'electric');
  assert.equal(state.routeEvents[0].crossing.protectiveSleeve, true);
  assert.equal(state.crossing.enabled, true);
  assert.equal(state.crossing.stationM, 350);
  assert.equal(state.route.selectedEventId, state.routeEvents[0].id);
});

test('multiple route events can be added, edited, selected and removed independently', () => {
  const store = new GasConfiguratorStore(clone(DEFAULT_STATE));
  store.setStation(120);
  assert.equal(store.addRouteEvent(ROUTE_EVENT_TYPES.roadCrossing.id), true);
  const roadId = store.get().route.selectedEventId;
  store.updateSelectedRouteEvent('label', 'County road crossing');
  store.updateSelectedRouteEvent('crossing.obstacleWidthM', 9.5);

  store.setStation(680);
  assert.equal(store.addRouteEvent(ROUTE_EVENT_TYPES.watercourseCrossing.id), true);
  const waterId = store.get().route.selectedEventId;

  assert.notEqual(roadId, waterId);
  assert.equal(store.get().routeEvents.length, 2);
  assert.equal(store.get().routeEvents.find((event) => event.id === roadId).label, 'County road crossing');
  assert.equal(store.get().routeEvents.find((event) => event.id === roadId).crossing.obstacleWidthM, 9.5);

  assert.equal(store.selectRouteEvent(roadId), true);
  assert.equal(store.get().route.stationM, 120);
  assert.equal(store.removeSelectedRouteEvent(), true);
  assert.equal(store.get().routeEvents.length, 1);
  assert.equal(store.get().routeEvents[0].id, waterId);
});

test('only exact public crossings can be promoted and duplicate promotion is prevented', () => {
  const store = new GasConfiguratorStore(clone(DEFAULT_STATE));
  const road = detectedRoad();
  assert.equal(routeEventFromObstacleScreening({ ...road, relation: 'proximity' }), null);
  assert.equal(store.addRouteEventFromObstacle({ ...road, relation: 'proximity' }), false);
  assert.equal(store.get().routeEvents.length, 0);

  assert.equal(store.addRouteEventFromObstacle(road), true);
  const configured = store.get().routeEvents[0];
  assert.equal(configured.type, ROUTE_EVENT_TYPES.roadCrossing.id);
  assert.equal(configured.source, 'publicScreening');
  assert.equal(configured.sourceFeatureId, road.featureId);
  assert.equal(configured.confirmed, false);
  assert.equal(configured.label, 'DN 7');
  assert.equal(matchingRouteEventForObstacle(store.get(), road)?.id, configured.id);

  store.addRouteEventFromObstacle({ ...road, stationM: 500.4 });
  assert.equal(store.get().routeEvents.length, 1);
});

test('inherited pipe sections and default depth endpoints continue to span an edited route', () => {
  const initial = normalizeState(clone(DEFAULT_STATE));
  const initialLength = routeLengthMeters(initial.route.points);
  const edited = clone(initial);
  edited.route.points.at(-1).coordinate = [26.2, 44.35];
  const normalized = normalizeState(edited);
  const editedLength = routeLengthMeters(normalized.route.points);

  assert.ok(editedLength > initialLength);
  assert.equal(normalized.pipeSections.length, 1);
  assert.equal(normalized.pipeSections[0].startStationM, 0);
  assert.equal(normalized.pipeSections[0].endStationM, editedLength);
  assert.deepEqual(normalized.depthPoints.map((point) => point.stationM), [0, editedLength]);
});

test('manual depth controls survive route edits without accumulating inherited endpoints', () => {
  const state = clone(DEFAULT_STATE);
  state.depthPoints.push({
    id: 'depth-manual-1',
    routeId: 'main',
    stationM: 400,
    coverM: 1.35,
    source: 'manual',
    inheritsDefault: false,
  });
  const first = normalizeState(state);
  const secondInput = clone(first);
  secondInput.route.points.at(-1).coordinate = [26.16, 44.39];
  const second = normalizeState(secondInput);

  assert.equal(second.depthPoints.filter((point) => point.source === 'manual').length, 1);
  assert.equal(second.depthPoints.filter((point) => point.inheritsDefault).length, 2);
  assert.equal(second.depthPoints.length, 3);
  assert.equal(second.depthPoints[0].stationM, 0);
  assert.equal(second.depthPoints.at(-1).stationM, routeLengthMeters(second.route.points));
});
