import assert from 'node:assert/strict';
import test from 'node:test';
import { crossingLineCoordinates } from '../src/domain/geometry.js';
import { toLeafletBounds, toLeafletLatLng } from '../src/map/leafletCoordinates.js';

test('route coordinates are converted from longitude-latitude to Leaflet order', () => {
  assert.deepEqual(toLeafletLatLng([26.1025, 44.4268]), [44.4268, 26.1025]);
});

test('route bounds are converted to Leaflet southwest-northeast corners', () => {
  assert.deepEqual(toLeafletBounds({
    minLon: 26.08,
    minLat: 44.41,
    maxLon: 26.14,
    maxLat: 44.45,
  }), [
    [44.41, 26.08],
    [44.45, 26.14],
  ]);
});

test('a perpendicular declared crossing is centered on the route station', () => {
  const points = [
    { id: 'a', coordinate: [26.1, 44.42] },
    { id: 'b', coordinate: [26.12, 44.42] },
  ];
  const crossing = crossingLineCoordinates(points, 500, 90, 60);
  assert.ok(crossing);
  assert.ok(Math.abs(crossing.start[0] - crossing.end[0]) < 1e-8);
  assert.ok(crossing.start[1] < crossing.center[1]);
  assert.ok(crossing.end[1] > crossing.center[1]);
});
