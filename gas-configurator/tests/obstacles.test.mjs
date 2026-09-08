import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeRouteObstacles,
  buildObstacleOverpassQuery,
  loadRouteObstacleScreening,
  parseOverpassObstacleFeatures,
  routeObstacleQueryBounds,
  routeObstacleRequestKey,
  routeObstacleRouteKey,
  RouteObstacleController,
} from '../src/obstacles/routeObstacles.js';

const ROUTE = Object.freeze([
  { id: 'a', kind: 'endpoint', label: 'A', coordinate: [0, 0] },
  { id: 'b', kind: 'endpoint', label: 'B', coordinate: [0.01, 0] },
]);

function feature(overrides = {}) {
  return {
    id: 'osm-way-1',
    osmType: 'way',
    osmId: '1',
    type: 'road',
    subtype: 'primary',
    name: 'Test road',
    structure: 'at-grade',
    coordinates: [[0.005, -0.001], [0.005, 0.001]],
    tags: {},
    ...overrides,
  };
}

function nextTask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test('Overpass screening query covers the route and requests all supported obstacle types', () => {
  const bounds = routeObstacleQueryBounds(ROUTE, 100);
  assert.ok(bounds.minLon < 0);
  assert.ok(bounds.maxLon > 0.01);
  assert.ok(bounds.minLat < 0);
  assert.ok(bounds.maxLat > 0);

  const query = buildObstacleOverpassQuery(bounds);
  assert.match(query, /way\["highway"/);
  assert.match(query, /way\["railway"/);
  assert.match(query, /way\["waterway"/);
  assert.match(query, /out tags geom;/);
});

test('Overpass ways are normalized into typed obstacle features with provenance metadata', () => {
  const features = parseOverpassObstacleFeatures({
    elements: [
      {
        type: 'way',
        id: 11,
        tags: { highway: 'primary', name: 'DN 7', bridge: 'yes' },
        geometry: [{ lon: 0.005, lat: -0.001 }, { lon: 0.005, lat: 0.001 }],
      },
      {
        type: 'way',
        id: 12,
        tags: { railway: 'rail', ref: '201' },
        geometry: [{ lon: 0, lat: 0.0002 }, { lon: 0.01, lat: 0.0002 }],
      },
      {
        type: 'way',
        id: 13,
        tags: { waterway: 'stream', name: 'Valea Mică', tunnel: 'culvert' },
        geometry: [{ lon: 0.006, lat: -0.001 }, { lon: 0.006, lat: 0.001 }],
      },
      { type: 'node', id: 99, tags: { highway: 'crossing' }, lat: 0, lon: 0 },
      { type: 'way', id: 100, tags: { highway: 'service' }, geometry: [{ lon: 0, lat: 0 }] },
    ],
  });

  assert.equal(features.length, 3);
  assert.deepEqual(features.map(({ type }) => type), ['road', 'railway', 'waterway']);
  assert.equal(features[0].id, 'osm-way-11');
  assert.equal(features[0].name, 'DN 7');
  assert.equal(features[0].structure, 'bridge');
  assert.equal(features[1].name, '201');
  assert.equal(features[2].structure, 'tunnel');
});

test('an exact route intersection produces a crossing event with chainage and angle', () => {
  const result = analyzeRouteObstacles(ROUTE, [feature()], { proximityThresholdM: 25 });

  assert.equal(result.events.length, 1);
  const event = result.events[0];
  assert.equal(event.relation, 'crossing');
  assert.equal(event.type, 'road');
  assert.equal(event.segmentId, 'a:b');
  assert.ok(Math.abs(event.stationM - 555.98) < 1);
  assert.ok(Math.abs(event.angleDeg - 90) < 0.01);
  assert.ok(event.distanceM < 0.001);
  assert.ok(Math.abs(event.coordinate[0] - 0.005) < 1e-9);
  assert.equal(result.summary.crossingCount, 1);
  assert.equal(result.summary.proximityCount, 0);
  assert.equal(result.summary.byType.road.crossings, 1);
});

test('a nearby non-intersecting feature is reported only inside the configured buffer', () => {
  const nearbyRailway = feature({
    id: 'osm-way-2',
    osmId: '2',
    type: 'railway',
    subtype: 'rail',
    name: 'Line 201',
    coordinates: [[0.002, 0.0001], [0.008, 0.0001]],
  });

  const outside = analyzeRouteObstacles(ROUTE, [nearbyRailway], { proximityThresholdM: 10 });
  assert.equal(outside.events.length, 0);

  const inside = analyzeRouteObstacles(ROUTE, [nearbyRailway], { proximityThresholdM: 15 });
  assert.equal(inside.events.length, 1);
  assert.equal(inside.events[0].relation, 'proximity');
  assert.equal(inside.events[0].type, 'railway');
  assert.ok(inside.events[0].distanceM > 11 && inside.events[0].distanceM < 11.3);
  assert.equal(inside.summary.byType.railway.proximities, 1);
});

test('crossings at a route vertex are deduplicated for the same source feature', () => {
  const bentRoute = [
    { id: 'a', kind: 'endpoint', label: 'A', coordinate: [0, 0] },
    { id: 'w1', kind: 'waypoint', label: '1', coordinate: [0.005, 0] },
    { id: 'b', kind: 'endpoint', label: 'B', coordinate: [0.01, 0.005] },
  ];
  const crossingAtVertex = feature({
    coordinates: [[0.005, -0.001], [0.005, 0.001]],
  });

  const result = analyzeRouteObstacles(bentRoute, [crossingAtVertex]);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].relation, 'crossing');
});

test('the public loader posts an Overpass query and returns analyzed source information', async () => {
  let request = null;
  const payload = {
    elements: [{
      type: 'way',
      id: 21,
      tags: { waterway: 'stream', name: 'Test stream' },
      geometry: [{ lon: 0.007, lat: -0.001 }, { lon: 0.007, lat: 0.001 }],
    }],
  };
  const result = await loadRouteObstacleScreening(ROUTE, {
    endpoint: 'https://example.test/overpass',
    proximityThresholdM: 30,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        async json() { return payload; },
      };
    },
  });

  assert.equal(request.url, 'https://example.test/overpass');
  assert.equal(request.options.method, 'POST');
  assert.match(request.options.body.get('data'), /waterway/);
  assert.equal(result.status, 'ready');
  assert.equal(result.routeKey, routeObstacleRouteKey(ROUTE));
  assert.equal(result.requestKey, routeObstacleRequestKey(ROUTE, 30));
  assert.equal(result.proximityThresholdM, 30);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].type, 'waterway');
  assert.match(result.source, /OpenStreetMap/);
  assert.ok(Number.isFinite(result.fetchedAt));
});

test('a newer route request supersedes an older obstacle-screening response', async () => {
  const requests = [];
  const states = [];
  const routeTwo = ROUTE.map((point) => ({
    ...point,
    coordinate: [point.coordinate[0] + 0.02, point.coordinate[1]],
  }));
  const controller = new RouteObstacleController({
    debounceMs: 0,
    timeoutMs: 1_000,
    onChange: (state) => states.push(state),
    loadScreening(points, { signal, proximityThresholdM }) {
      return new Promise((resolve, reject) => {
        const pending = {
          key: routeObstacleRouteKey(points),
          proximityThresholdM,
          resolve,
          reject,
          signal,
        };
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        requests.push(pending);
      });
    },
  });

  try {
    controller.request(ROUTE, { proximityThresholdM: 25 });
    await nextTask();
    assert.equal(requests.length, 1);

    controller.request(routeTwo, { proximityThresholdM: 25 });
    await nextTask();
    assert.equal(requests.length, 2);
    assert.equal(requests[0].signal.aborted, true);

    requests[1].resolve({
      status: 'ready',
      routeKey: requests[1].key,
      requestKey: routeObstacleRequestKey(routeTwo, 25),
      proximityThresholdM: 25,
      features: [],
      events: [],
      summary: {
        featureCount: 0,
        eventCount: 0,
        crossingCount: 0,
        proximityCount: 0,
        byType: {
          road: { features: 0, crossings: 0, proximities: 0 },
          railway: { features: 0, crossings: 0, proximities: 0 },
          waterway: { features: 0, crossings: 0, proximities: 0 },
        },
      },
    });
    await nextTask();

    assert.equal(states.at(-1).status, 'ready');
    assert.equal(states.at(-1).routeKey, routeObstacleRouteKey(routeTwo));
    assert.equal(states.at(-1).cacheStatus, 'live');
  } finally {
    controller.destroy();
  }
});

test('disabling screening cancels requests and clears derived events', async () => {
  let aborted = false;
  const states = [];
  const controller = new RouteObstacleController({
    debounceMs: 0,
    timeoutMs: 1_000,
    onChange: (state) => states.push(state),
    loadScreening(_points, { signal }) {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          aborted = true;
          reject(signal.reason);
        }, { once: true });
      });
    },
  });

  try {
    controller.request(ROUTE);
    await nextTask();
    controller.request(ROUTE, { enabled: false });
    await nextTask();

    assert.equal(aborted, true);
    assert.equal(states.at(-1).status, 'disabled');
    assert.deepEqual(states.at(-1).events, []);
  } finally {
    controller.destroy();
  }
});
