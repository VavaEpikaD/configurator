import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRouteElevationLocations,
  decodeTerrariumRgb,
  interpolateElevationAtChainage,
  loadRouteElevationProfile,
  routeElevationKey,
  RouteElevationController,
  sampleTerrainTile,
  selectTerrainZoom,
  terrainAdjustedRouteLengthMeters,
  terrainTileReference,
} from '../src/elevation/routeElevation.js';
import { buildRouteSegments } from '../src/domain/geometry.js';

const ROUTE = [
  { id: 'a', kind: 'endpoint', label: 'A', coordinate: [26.0937, 44.4324] },
  { id: 'w1', kind: 'waypoint', label: '1', coordinate: [26.1011, 44.4301] },
  { id: 'b', kind: 'endpoint', label: 'B', coordinate: [26.1112, 44.4252] },
];

function constantTerrainTile(elevationM) {
  const encoded = elevationM + 32768;
  const red = Math.floor(encoded / 256);
  const green = Math.floor(encoded % 256);
  const blue = Math.floor((encoded - Math.floor(encoded)) * 256);
  return {
    width: 1,
    height: 1,
    imageData: {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([red, green, blue, 255]),
    },
  };
}

function nextTask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test('Terrarium RGB values decode to metre elevations', () => {
  assert.equal(decodeTerrariumRgb(137, 219, 68), 2523.265625);
});

test('terrain sampling scales nominal coordinates to the decoded tile dimensions', () => {
  const tile = constantTerrainTile(10);
  tile.width = 512;
  tile.height = 512;
  tile.imageData.width = 512;
  tile.imageData.height = 512;
  tile.imageData.data = new Uint8ClampedArray(512 * 512 * 4);
  const encoded = 125 + 32768;
  const offset = ((300 * 512) + 400) * 4;
  tile.imageData.data[offset] = Math.floor(encoded / 256);
  tile.imageData.data[offset + 1] = Math.floor(encoded % 256);
  tile.imageData.data[offset + 3] = 255;

  assert.equal(sampleTerrainTile(tile, 200, 150), 125);
});

test('route elevation locations include every route vertex in chainage order', () => {
  const locations = buildRouteElevationLocations(ROUTE);
  const segments = buildRouteSegments(ROUTE);
  const waypointChainage = segments[0].endChainageM;
  const waypoint = locations.find((sample) => Math.abs(sample.chainageM - waypointChainage) < 0.001);

  assert.ok(locations.length >= 24);
  assert.deepEqual(locations[0].coordinate, ROUTE[0].coordinate);
  assert.deepEqual(waypoint?.coordinate, ROUTE[1].coordinate);
  assert.deepEqual(locations.at(-1).coordinate, ROUTE.at(-1).coordinate);
  assert.ok(locations.every((sample, index) => index === 0 || sample.chainageM > locations[index - 1].chainageM));
});

test('terrain zoom selection respects the tile request cap', () => {
  const worldwideLocations = Array.from({ length: 80 }, (_, index) => ({
    coordinate: [(-175 + index * 4.4), -70 + (index % 15) * 10],
  }));
  const zoom = selectTerrainZoom(worldwideLocations, 8);
  const tileCount = new Set(worldwideLocations.map((sample) => (
    terrainTileReference(sample.coordinate, zoom).key
  ))).size;

  assert.ok(zoom >= 0 && zoom <= 15);
  assert.ok(tileCount <= 8);
});

test('route profile loader samples terrain tiles and reports provenance', async () => {
  let tileLoads = 0;
  const profile = await loadRouteElevationProfile(ROUTE, {
    tileTemplate: 'test://terrain/{z}/{x}/{y}.png',
    loadTile: async () => {
      tileLoads += 1;
      return constantTerrainTile(91.25);
    },
  });

  assert.equal(profile.status, 'ready');
  assert.equal(profile.routeKey, routeElevationKey(ROUTE));
  assert.equal(profile.startElevationM, 91.25);
  assert.equal(profile.endElevationM, 91.25);
  assert.equal(profile.minElevationM, 91.25);
  assert.equal(profile.repairedCount, 0);
  assert.equal(tileLoads, profile.tileCount);
  assert.ok(profile.samples.length >= 24);
  assert.ok(Math.abs(
    profile.terrainAdjustedLengthM - profile.samples.at(-1).chainageM
  ) < 1e-9);
});

test('station elevation is interpolated between terrain samples', () => {
  const samples = [
    { chainageM: 0, elevationM: 80 },
    { chainageM: 100, elevationM: 90 },
    { chainageM: 200, elevationM: 70 },
  ];
  assert.equal(interpolateElevationAtChainage(samples, 50), 85);
  assert.equal(interpolateElevationAtChainage(samples, 150), 80);
  assert.equal(interpolateElevationAtChainage(samples, 500), 70);
});

test('terrain-adjusted length sums three-dimensional profile intervals', () => {
  const samples = [
    { chainageM: 0, elevationM: 100 },
    { chainageM: 4, elevationM: 103 },
    { chainageM: 16, elevationM: 108 },
  ];

  assert.equal(terrainAdjustedRouteLengthMeters(samples), 18);
});

test('flat terrain-adjusted length equals the horizontal profile length', () => {
  const samples = [
    { chainageM: 0, elevationM: 91.25 },
    { chainageM: 100, elevationM: 91.25 },
  ];

  assert.equal(terrainAdjustedRouteLengthMeters(samples), 100);
  assert.ok(Number.isNaN(terrainAdjustedRouteLengthMeters(samples.slice(0, 1))));
  assert.ok(Number.isNaN(terrainAdjustedRouteLengthMeters([
    samples[1],
    samples[0],
  ])));
});

test('a newer route request supersedes an older elevation response', async () => {
  const requests = [];
  const states = [];
  const controller = new RouteElevationController({
    debounceMs: 0,
    timeoutMs: 1_000,
    onChange: (state) => states.push(state),
    loadProfile(points, { signal }) {
      return new Promise((resolve, reject) => {
        const request = { key: routeElevationKey(points), resolve, reject, signal };
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        requests.push(request);
      });
    },
  });

  const movedRoute = ROUTE.map((point, index) => (
    index === 1 ? { ...point, coordinate: [26.104, 44.431] } : point
  ));
  controller.request(ROUTE);
  await nextTask();
  controller.request(movedRoute);
  await nextTask();

  assert.equal(requests.length, 2);
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve({
    status: 'ready',
    routeKey: requests[1].key,
    samples: [{ chainageM: 0, elevationM: 90 }],
  });
  await nextTask();

  assert.equal(states.at(-1).status, 'ready');
  assert.equal(states.at(-1).routeKey, routeElevationKey(movedRoute));
  controller.destroy();
});
