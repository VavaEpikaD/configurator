import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateProject } from '../src/domain/calculations.js';
import {
  analyzeDepthControls,
  buildDesignedPipeProfile,
  coverAtChainage,
  depthProfileStatistics,
  routeEventDepthZoneStatus,
} from '../src/domain/depthProfile.js';
import { routeLengthMeters, routeProfileSamples } from '../src/domain/geometry.js';
import { DEFAULT_STATE, GasConfiguratorStore, normalizeState } from '../src/state.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function flatTerrain(state, elevationM = 100, sampleCount = 24) {
  return routeProfileSamples(state.route.points, sampleCount).map((sample) => ({
    ...sample,
    elevationM,
    groundM: elevationM,
  }));
}

test('cover is interpolated piecewise and profile statistics integrate it exactly', () => {
  const controls = [
    { id: 'a', stationM: 0, coverM: 1, source: 'manual', inheritsDefault: false },
    { id: 'middle', stationM: 50, coverM: 2, source: 'manual', inheritsDefault: false },
    { id: 'b', stationM: 100, coverM: 1, source: 'manual', inheritsDefault: false },
  ];

  assert.equal(coverAtChainage(controls, 25, 100, 1), 1.5);
  assert.equal(coverAtChainage(controls, 75, 100, 1), 1.5);
  const statistics = depthProfileStatistics(controls, 100, 1);
  assert.equal(statistics.minimumCoverM, 1);
  assert.equal(statistics.maximumCoverM, 2);
  assert.equal(statistics.averageCoverM, 1.5);
  assert.equal(statistics.integratedCoverM2, 150);
});

test('inherited endpoint controls always follow the current global cover', () => {
  const points = clone(DEFAULT_STATE.depthPoints);
  const routeLengthM = routeLengthMeters(DEFAULT_STATE.route.points);
  const analysis = analyzeDepthControls(points, routeLengthM, 0.8);
  assert.deepEqual(analysis.effectivePoints.map((point) => point.coverM), [0.8, 0.8]);
});

test('variable cover changes excavation and designed centreline length', () => {
  const state = normalizeState(clone(DEFAULT_STATE));
  const routeLengthM = routeLengthMeters(state.route.points);
  state.depthPoints.push({
    id: 'depth-middle',
    routeId: 'main',
    stationM: routeLengthM / 2,
    coverM: 2,
    source: 'manual',
    inheritsDefault: false,
    endpoint: null,
    routeEventId: null,
    zoneRole: null,
  });
  const calculation = calculateProject(state, { terrainSamples: flatTerrain(state) });
  const expectedAverageCoverM = 1.5;
  const expectedExcavationM3 = routeLengthM * calculation.trenchWidthM * (
    expectedAverageCoverM + calculation.outsideDiameterM + calculation.beddingM
  );
  const expectedDifferenceM3 = routeLengthM * calculation.trenchWidthM * 0.5;

  assert.ok(Math.abs(calculation.averageCoverM - expectedAverageCoverM) < 1e-10);
  assert.ok(Math.abs(calculation.excavationM3 - expectedExcavationM3) < 1e-7);
  assert.ok(Math.abs(calculation.excavationDifferenceM3 - expectedDifferenceM3) < 1e-7);
  assert.ok(calculation.designedPipeLengthM > calculation.terrainLengthM);
  assert.ok(calculation.pipeLengthM > calculation.designedPipeLengthM);
});

test('designed profile exposes ground, crown, centreline and invert elevations', () => {
  const state = normalizeState(clone(DEFAULT_STATE));
  const routeLengthM = routeLengthMeters(state.route.points);
  const profile = buildDesignedPipeProfile({
    state,
    terrainSamples: flatTerrain(state, 100, 2),
    routeLengthM,
    outsideDiameterM: 0.063,
  });
  assert.equal(profile.liveTerrain, true);
  assert.equal(profile.samples[0].groundM, 100);
  assert.equal(profile.samples[0].pipeCrownM, 99);
  assert.equal(profile.samples[0].pipeCenterlineM, 98.9685);
  assert.equal(profile.samples[0].pipeInvertM, 98.937);
});

test('store depth controls can be added, moved, removed and reset without deleting endpoints', () => {
  const store = new GasConfiguratorStore(clone(DEFAULT_STATE));
  const routeLengthM = routeLengthMeters(store.get().route.points);
  const pointId = store.addDepthPoint(routeLengthM / 2, 1.35);
  assert.ok(pointId);
  assert.equal(store.get().route.profileEditMode, true);
  assert.equal(store.get().depthPoints.length, 3);

  assert.equal(store.moveDepthPoint(pointId, routeLengthM * 0.6, 1.7), true);
  let point = store.get().depthPoints.find((candidate) => candidate.id === pointId);
  assert.ok(Math.abs(point.stationM - routeLengthM * 0.6) < 1e-6);
  assert.equal(point.coverM, 1.7);

  assert.equal(store.removeSelectedDepthPoint(), true);
  assert.equal(store.get().depthPoints.length, 2);
  store.selectDepthPoint('depth-a');
  assert.equal(store.removeSelectedDepthPoint(), false);

  store.updateSelectedDepthPoint('coverM', 1.25);
  assert.equal(store.get().depthPoints.find((candidate) => candidate.id === 'depth-a').source, 'manual');
  assert.equal(store.resetDepthProfile(), true);
  assert.deepEqual(store.get().depthPoints.map((candidate) => candidate.source), ['default', 'default']);
});

test('a route-event depth zone creates locked entry, centre and exit controls', () => {
  const store = new GasConfiguratorStore(clone(DEFAULT_STATE));
  store.setStation(400);
  store.addRouteEvent('road-crossing');
  const eventId = store.get().route.selectedEventId;
  store.updateSelectedRouteEvent('crossing.obstacleWidthM', 12);

  assert.equal(store.createDepthZoneForRouteEvent(eventId, 1.5), true);
  const state = store.get();
  const event = state.routeEvents.find((candidate) => candidate.id === eventId);
  const zone = routeEventDepthZoneStatus(state.depthPoints, event, routeLengthMeters(state.route.points));
  assert.equal(zone.status, 'ready');
  assert.deepEqual(zone.points.map((point) => point.zoneRole).sort(), ['center', 'entry', 'exit']);
  assert.deepEqual(
    zone.points.sort((left, right) => left.stationM - right.stationM).map((point) => point.stationM),
    [394, 400, 406],
  );
  assert.ok(zone.points.every((point) => point.coverM === 1.5));

  store.updateSelectedRouteEvent('crossing.obstacleWidthM', 20);
  const updatedState = store.get();
  const updatedZone = routeEventDepthZoneStatus(
    updatedState.depthPoints,
    updatedState.routeEvents.find((candidate) => candidate.id === eventId),
    routeLengthMeters(updatedState.route.points),
  );
  assert.equal(updatedZone.status, 'ready');
  assert.deepEqual(
    updatedZone.points.sort((left, right) => left.stationM - right.stationM).map((point) => point.stationM),
    [390, 400, 410],
  );

  assert.equal(store.removeSelectedRouteEvent(), true);
  assert.equal(store.get().depthPoints.some((point) => point.routeEventId === eventId), false);
});

test('drag history can be recorded as one undoable depth edit', () => {
  const store = new GasConfiguratorStore(clone(DEFAULT_STATE));
  const pointId = store.addDepthPoint(300, 1.2);
  const beforeDrag = store.captureState();
  store.moveDepthPoint(pointId, 450, 1.8, { persist: false });
  assert.equal(store.recordTransientHistory(beforeDrag), true);
  assert.equal(store.undo(), true);
  const restored = store.get().depthPoints.find((point) => point.id === pointId);
  assert.equal(restored.stationM, 300);
  assert.equal(restored.coverM, 1.2);
});
