import assert from 'node:assert/strict';
import test from 'node:test';
import { buildValidationResults, calculateProject } from '../src/domain/calculations.js';
import {
  assessNetworkConnection,
  EXISTING_NETWORK_ASSETS,
  findNearestNetworkPoint,
  projectCoordinateToNetworkAsset,
} from '../src/network/networkConnection.js';
import { DEFAULT_STATE, GasConfiguratorStore, normalizeState } from '../src/state.js';
import { gasT } from '../src/i18n.js';
import { renderGasLayout } from '../src/ui/layout.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function firstAssetTestLocation(latitudeOffset = 0.0001) {
  const asset = EXISTING_NETWORK_ASSETS[0];
  const [start, end] = asset.geometry.coordinates;
  return {
    asset,
    coordinate: [
      (start[0] + end[0]) / 2,
      start[1] + latitudeOffset,
    ],
  };
}

test('network assets receive deterministic stable identifiers', () => {
  assert.equal(EXISTING_NETWORK_ASSETS.length, 94);
  assert.equal(EXISTING_NETWORK_ASSETS[0].properties.assetId, 'valcea-network-001');
  assert.equal(EXISTING_NETWORK_ASSETS.at(-1).properties.assetId, 'valcea-network-094');
  assert.equal(
    new Set(EXISTING_NETWORK_ASSETS.map((feature) => feature.properties.assetId)).size,
    EXISTING_NETWORK_ASSETS.length,
  );
});

test('a map click is projected onto the exact nearest point of a selected pipe', () => {
  const { asset, coordinate } = firstAssetTestLocation();
  const candidate = projectCoordinateToNetworkAsset(coordinate, asset);

  assert.equal(candidate.assetId, 'valcea-network-001');
  assert.ok(Math.abs(candidate.segmentRatio - 0.5) < 1e-12);
  assert.ok(Math.abs(candidate.coordinate[0] - 23.8871) < 1e-12);
  assert.ok(Math.abs(candidate.coordinate[1] - 44.995891) < 1e-12);
  assert.ok(candidate.distanceM > 11 && candidate.distanceM < 11.2);
  assert.equal(findNearestNetworkPoint(coordinate).assetId, candidate.assetId);
});

test('starting a route from an existing pipe snaps A and persists its asset identity', () => {
  const { asset, coordinate } = firstAssetTestLocation();
  const expected = projectCoordinateToNetworkAsset(coordinate, asset);
  const store = new GasConfiguratorStore(clone(DEFAULT_STATE));

  assert.equal(store.connectToNetwork(asset.properties.assetId, coordinate), true);
  assert.deepEqual(store.get().route.points[0].coordinate, expected.coordinate);
  assert.equal(store.get().connection.assetId, asset.properties.assetId);
  assert.deepEqual(store.get().connection.coordinate, expected.coordinate);
  assert.equal(assessNetworkConnection(store.get()).connected, true);

  const restored = normalizeState(store.captureState());
  assert.equal(restored.connection.assetId, asset.properties.assetId);
  assert.deepEqual(restored.route.points[0].coordinate, expected.coordinate);
});

test('moving A within the configured tolerance auto-snaps and moving it away clears the connection', () => {
  const { asset, coordinate } = firstAssetTestLocation(0.00002);
  const store = new GasConfiguratorStore(clone(DEFAULT_STATE));

  assert.equal(store.movePoint('a', coordinate), true);
  assert.equal(store.get().connection.assetId, asset.properties.assetId);
  assert.equal(assessNetworkConnection(store.get()).connected, true);

  assert.equal(store.movePoint('a', DEFAULT_STATE.route.points[0].coordinate), true);
  assert.equal(store.get().connection.assetId, null);
  assert.equal(assessNetworkConnection(store.get()).connected, false);
});

test('the configured auto-snap tolerance controls whether A connects', () => {
  const { asset, coordinate } = firstAssetTestLocation(0.00002);
  const store = new GasConfiguratorStore(clone(DEFAULT_STATE));

  store.update('connection.snapToleranceM', 1);
  store.movePoint('a', coordinate);
  assert.equal(store.get().connection.assetId, null);
  assert.equal(assessNetworkConnection(store.get()).connected, false);

  store.update('connection.snapToleranceM', 5);
  store.movePoint('a', coordinate);
  assert.equal(store.get().connection.assetId, asset.properties.assetId);
  assert.equal(assessNetworkConnection(store.get()).connected, true);
});

test('the preliminary checks distinguish connected and unconnected route starts', () => {
  const unconnected = clone(DEFAULT_STATE);
  const unconnectedResult = buildValidationResults(
    unconnected,
    calculateProject(unconnected),
  ).find((result) => result.id === 'network-connection');
  assert.equal(unconnectedResult.status, 'warning');

  const { asset, coordinate } = firstAssetTestLocation();
  const store = new GasConfiguratorStore(unconnected);
  store.connectToNetwork(asset.properties.assetId, coordinate);
  const connectedResult = buildValidationResults(
    store.get(),
    calculateProject(store.get()),
  ).find((result) => result.id === 'network-connection');
  assert.equal(connectedResult.status, 'pass');
  assert.equal(connectedResult.detailVariables.asset, asset.properties.name);
});

test('the connection workflow is present and translated in every supported locale', () => {
  const root = { innerHTML: '' };
  renderGasLayout(root);
  assert.match(root.innerHTML, /id="networkConnectionCard"/);
  assert.match(root.innerHTML, /id="snapToNearestNetworkButton"/);
  assert.match(root.innerHTML, /id="connectionToleranceInput"/);

  ['en-US', 'ro-RO', 'de-DE'].forEach((locale) => {
    [
      'action.startRouteHere',
      'action.snapAtoNetwork',
      'connection.title',
      'connection.status.connected',
      'validation.networkConnection.warning',
    ].forEach((key) => assert.notEqual(gasT(locale, key), key));
  });
});
