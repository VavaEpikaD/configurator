import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const network = JSON.parse(readFileSync(
  new URL('../src/data/valcea-existing-network.json', import.meta.url),
  'utf8',
));
const servedUats = JSON.parse(readFileSync(
  new URL('../src/data/valcea-served-uats.json', import.meta.url),
  'utf8',
));

const EXPECTED_UATS = [
  'Alunu',
  'Berbești',
  'Brezoi',
  'Grădiștea',
  'Livezi',
  'Lungești',
  'Sinești',
  'Ștefănești',
];

function coordinatesOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Point') return [geometry.coordinates];
  return geometry.coordinates.flat(Infinity).reduce((pairs, value, index, flat) => {
    if (index % 2 === 0) pairs.push([value, flat[index + 1]]);
    return pairs;
  }, []);
}

test('company network overlay preserves every supplied line and point feature', () => {
  assert.equal(network.type, 'FeatureCollection');
  assert.equal(network.features.length, 156);
  assert.equal(network.features.filter(({ geometry }) => geometry.type === 'LineString').length, 94);
  assert.equal(network.features.filter(({ geometry }) => geometry.type === 'Point').length, 62);
  assert.equal(network.metadata.reportedNetworkKm, 151.341);

  const allowedGroups = new Set([
    'berbesti-sinesti-gradistea',
    'brezoi',
    'alunu',
    'livezi',
    'lungesti',
    'stefanesti',
  ]);
  network.features
    .filter(({ geometry }) => geometry.type === 'LineString')
    .forEach((feature) => {
      assert.ok(allowedGroups.has(feature.properties.groupId));
      assert.ok(feature.geometry.coordinates.length >= 2);
    });
});

test('served UAT overlay contains only the eight requested Vâlcea administrations', () => {
  assert.equal(servedUats.type, 'FeatureCollection');
  assert.deepEqual(
    servedUats.features.map(({ properties }) => properties.name),
    EXPECTED_UATS,
  );
  assert.equal(new Set(servedUats.features.map(({ properties }) => properties.siruta)).size, 8);
  assert.ok(servedUats.features.every(({ properties }) => properties.county === 'Vâlcea'));
  assert.ok(servedUats.features.every(({ geometry }) => geometry.type === 'Polygon'));

  const uniqueReportedNetworks = new Map();
  servedUats.features.forEach(({ properties }) => {
    uniqueReportedNetworks.set(properties.groupId, properties.reportedNetworkKm);
  });
  const reportedTotal = [...uniqueReportedNetworks.values()].reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(reportedTotal - 151.341) < 1e-9);

  const adiMembers = servedUats.features.filter(
    ({ properties }) => properties.groupId === 'berbesti-sinesti-gradistea',
  );
  assert.equal(adiMembers.length, 3);
  assert.ok(adiMembers.every(({ properties }) => properties.figuresScope === 'service-area'));
});

test('all overlay coordinates are finite and stay within the Vâlcea source extent', () => {
  const pairs = [...network.features, ...servedUats.features]
    .flatMap(({ geometry }) => coordinatesOf(geometry));
  assert.ok(pairs.length > 500);
  pairs.forEach(([longitude, latitude]) => {
    assert.ok(Number.isFinite(longitude));
    assert.ok(Number.isFinite(latitude));
    assert.ok(longitude >= 23.7 && longitude <= 24.4);
    assert.ok(latitude >= 44.5 && latitude <= 45.55);
  });
});
