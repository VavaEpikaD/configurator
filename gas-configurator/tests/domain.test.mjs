import assert from 'node:assert/strict';
import test from 'node:test';
import { buildValidationResults, calculateProject } from '../src/domain/calculations.js';
import { buildRouteSegments, interpolateRoute } from '../src/domain/geometry.js';
import {
  DEFAULT_STATE,
  GAS_STATE_SCHEMA_VERSION,
  GasConfiguratorStore,
  normalizeState,
} from '../src/state.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('default route produces coherent quantities', () => {
  const calculation = calculateProject(clone(DEFAULT_STATE));
  assert.ok(calculation.routeLengthM > 1_000);
  assert.ok(calculation.pipeLengthM > calculation.routeLengthM);
  assert.ok(calculation.excavationM3 > calculation.beddingM3);
  assert.ok(calculation.estimateHighEur > calculation.estimateLowEur);
  assert.equal(calculation.beddingM, DEFAULT_STATE.trench.beddingM);
  assert.ok([
    calculation.outsideDiameterM,
    calculation.coverM,
    calculation.trenchWidthM,
    calculation.beddingM,
    calculation.trenchDepthM,
  ].every(Number.isFinite));
});

test('quantities use the configured trench width without silently correcting a blocked value', () => {
  const state = clone(DEFAULT_STATE);
  state.pipe.diameterMm = 110;
  state.trench.widthM = 0.3;
  const calculation = calculateProject(state);

  assert.equal(calculation.trenchWidthM, 0.3);
  assert.ok(Math.abs(calculation.requiredTrenchWidthM - 0.51) < 1e-12);
  assert.equal(calculation.trenchWidthAssessment.status, 'blocked');
  assert.ok(Math.abs(
    calculation.excavationM3
      - (calculation.routeLengthM * state.trench.widthM * calculation.trenchDepthM),
  ) < 1e-8);
});

test('saved v1-shaped state receives the compliant default bedding material', () => {
  const normalized = normalizeState({
    trench: { coverM: 1, widthM: 0.55, beddingM: 0.1 },
  });
  assert.equal(normalized.trench.beddingMaterial, 'sand03to08');
});


test('obstacle-screening settings are versioned, preserved and clamped', () => {
  const disabled = normalizeState({
    schemaVersion: 2,
    screening: { obstaclesEnabled: false, proximityThresholdM: 250 },
  });
  assert.equal(disabled.schemaVersion, GAS_STATE_SCHEMA_VERSION);
  assert.equal(disabled.screening.obstaclesEnabled, false);
  assert.equal(disabled.screening.proximityThresholdM, 100);

  const defaults = normalizeState({ schemaVersion: 2 });
  assert.equal(defaults.screening.obstaclesEnabled, true);
  assert.equal(defaults.screening.proximityThresholdM, 25);
});

test('the store checks v4 and v3 before migrating the previous v2 persistence key', () => {
  const previousLocalStorage = globalThis.localStorage;
  const requestedKeys = [];
  globalThis.localStorage = {
    getItem(key) {
      requestedKeys.push(key);
      if (key.endsWith(':v2')) {
        return JSON.stringify({
          schemaVersion: 2,
          project: { name: 'Migrated gas route' },
          screening: { obstaclesEnabled: false, proximityThresholdM: 40 },
        });
      }
      return null;
    },
    setItem() {},
  };

  try {
    const store = new GasConfiguratorStore();
    assert.deepEqual(requestedKeys.slice(0, 3), [
      '360-configurator:gas-prototype:v4',
      '360-configurator:gas-prototype:v3',
      '360-configurator:gas-prototype:v2',
    ]);
    assert.equal(store.get().project.name, 'Migrated gas route');
    assert.equal(store.get().screening.obstaclesEnabled, false);
    assert.equal(store.get().screening.proximityThresholdM, 40);
  } finally {
    if (previousLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousLocalStorage;
  }
});

test('a waypoint splits the nearest route segment and inherits its assumptions', () => {
  const initial = clone(DEFAULT_STATE);
  const store = new GasConfiguratorStore(initial);
  const coordinate = [
    (initial.route.points[0].coordinate[0] + initial.route.points[1].coordinate[0]) / 2,
    (initial.route.points[0].coordinate[1] + initial.route.points[1].coordinate[1]) / 2,
  ];

  assert.equal(store.addWaypoint(coordinate), true);
  const state = store.get();
  const segments = buildRouteSegments(state.route.points);
  assert.equal(state.route.points.length, 3);
  assert.equal(segments.length, 2);
  assert.ok(segments.every((segment) => state.segmentSettings[segment.id].groundType === 'common'));
  assert.equal(state.route.selectedPointId, state.route.points[1].id);
});

test('segment ground classification changes the preliminary estimate', () => {
  const store = new GasConfiguratorStore(clone(DEFAULT_STATE));
  const commonEstimate = calculateProject(store.get()).estimateMidEur;
  store.setSegmentSetting('groundType', 'hardRock');
  const rockEstimate = calculateProject(store.get()).estimateMidEur;
  assert.ok(rockEstimate > commonEstimate);
});

test('station interpolation remains within the route', () => {
  const state = clone(DEFAULT_STATE);
  const calculation = calculateProject(state);
  const station = interpolateRoute(state.route.points, calculation.routeLengthM / 2);
  assert.ok(station.ratio > 0 && station.ratio < 1);
  assert.equal(station.segment.id, 'a:b');
});

test('capacity and authorized review stay unresolved while the scoped cover rule runs', () => {
  const state = clone(DEFAULT_STATE);
  const validation = buildValidationResults(state, calculateProject(state));
  assert.equal(validation.find((item) => item.id === 'capacity').status, 'missing');
  assert.equal(validation.find((item) => item.id === 'authorization').status, 'missing');
  assert.equal(validation.find((item) => item.id === 'RO-NTPEE-075-COVER-001').status, 'pass');
  assert.equal(validation.find((item) => item.id === 'RO-NTPEE-082-ANGLE-001').status, 'not-evaluated');
});

test('public elevation data remains a screening warning', () => {
  const state = clone(DEFAULT_STATE);
  const validation = buildValidationResults(state, calculateProject(state), {
    elevationProfile: { status: 'ready' },
  });
  const ground = validation.find((item) => item.id === 'ground');
  assert.equal(ground.status, 'warning');
  assert.equal(ground.detailKey, 'validation.ground.publicTerrain');
});
