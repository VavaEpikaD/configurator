import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculateProject } from '../src/domain/calculations.js';
import { routeProfileSamples } from '../src/domain/geometry.js';
import { routeElevationKey } from '../src/elevation/routeElevation.js';
import { routeObstacleRouteKey } from '../src/obstacles/routeObstacles.js';
import { DEFAULT_STATE } from '../src/state.js';
import { profilePointerToDesign, renderCrossSection, renderProfile } from '../src/ui/renderers.js';
import { renderToolsMenu } from '../../shared-ui/src/components/toolsMenu.js';

class FakeSvgElement {
  constructor(name) {
    this.name = name;
    this.attributes = {};
    this.children = [];
    this.textContent = '';
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function collectAttributes(element) {
  return [
    ...Object.values(element.attributes),
    ...element.children.flatMap(collectAttributes),
  ];
}

function findByClass(element, className) {
  if (String(element.attributes.class || '').split(/\s+/).includes(className)) return element;
  return element.children.map((child) => findByClass(child, className)).find(Boolean) || null;
}

function findAllByClass(element, className) {
  const current = String(element.attributes.class || '').split(/\s+/).includes(className)
    ? [element]
    : [];
  return [...current, ...element.children.flatMap((child) => findAllByClass(child, className))];
}

test('profile and cross-section SVG attributes remain finite', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElementNS(_namespace, name) {
      return new FakeSvgElement(name);
    },
  };

  try {
    const state = clone(DEFAULT_STATE);
    state.crossing.enabled = true;
    const calculation = calculateProject(state);
    const profile = new FakeSvgElement('svg');
    const section = new FakeSvgElement('svg');
    const translate = (key) => key;

    const obstacleScreening = {
      status: 'ready',
      routeKey: routeObstacleRouteKey(state.route.points),
      events: [
        {
          id: 'road-crossing',
          type: 'road',
          relation: 'crossing',
          name: 'DN 7',
          stationM: calculation.routeLengthM * 0.25,
          distanceM: 0,
          angleDeg: 88,
        },
        {
          id: 'railway-proximity',
          type: 'railway',
          relation: 'proximity',
          name: 'Railway 201',
          stationM: calculation.routeLengthM * 0.5,
          distanceM: 12,
          angleDeg: 5,
        },
        {
          id: 'water-crossing',
          type: 'waterway',
          relation: 'crossing',
          name: 'Olt',
          stationM: calculation.routeLengthM * 0.75,
          distanceM: 0,
          angleDeg: 72,
        },
      ],
    };
    renderProfile(profile, state, calculation, null, obstacleScreening);
    renderCrossSection(section, state, calculation, translate);

    const attributes = [...collectAttributes(profile), ...collectAttributes(section)];
    assert.ok(attributes.length > 0);
    assert.ok(attributes.every((value) => !/NaN|Infinity/.test(value)));
    assert.ok(findByClass(profile, 'gas-profile-crossing-line'));
    assert.ok(findByClass(profile, 'gas-profile-crossing-point'));
    assert.ok(findByClass(profile, 'gas-profile-obstacle--road'));
    assert.ok(findByClass(profile, 'gas-profile-obstacle--railway'));
    assert.ok(findByClass(profile, 'gas-profile-obstacle--waterway'));
    assert.ok(findByClass(profile, 'gas-profile-obstacle--proximity'));
    assert.ok(findByClass(section, 'gas-section-rule-status--pass'));

    state.pipe.diameterMm = 110;
    state.trench.widthM = 0.3;
    renderCrossSection(section, state, calculateProject(state), translate);
    assert.ok(findByClass(section, 'gas-section-rule-status--blocked'));
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('a matching terrain profile renders as live rather than fallback data', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElementNS(_namespace, name) {
      return new FakeSvgElement(name);
    },
  };

  try {
    const state = clone(DEFAULT_STATE);
    const calculation = calculateProject(state);
    const profile = new FakeSvgElement('svg');
    const samples = routeProfileSamples(state.route.points, 24).map((sample, index) => ({
      chainageM: sample.chainageM,
      progress: sample.progress,
      coordinate: sample.coordinate,
      elevationM: 75 + index * 0.1,
    }));
    renderProfile(profile, state, calculation, {
      status: 'ready',
      routeKey: routeElevationKey(state.route.points),
      samples,
    });

    const ground = findByClass(profile, 'gas-profile-ground');
    assert.ok(ground);
    assert.equal(String(ground.attributes.class).includes('fallback'), false);
    assert.equal(String(ground.attributes.points).split(' ').length, samples.length);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});


test('editable depth controls render with a pipe envelope and pointer coordinates map to design values', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElementNS(_namespace, name) {
      return new FakeSvgElement(name);
    },
  };

  try {
    const state = clone(DEFAULT_STATE);
    const initial = calculateProject(state);
    state.depthPoints.push({
      id: 'depth-manual-test',
      routeId: 'main',
      stationM: initial.routeLengthM * 0.5,
      coverM: 1.45,
      source: 'manual',
      inheritsDefault: false,
      endpoint: null,
      routeEventId: null,
      zoneRole: null,
    });
    state.route.selectedDepthPointId = 'depth-manual-test';
    state.route.profileEditMode = true;

    const calculation = calculateProject(state);
    const profile = new FakeSvgElement('svg');
    profile.getBoundingClientRect = () => ({ left: 0, top: 0, width: 760, height: 260 });
    renderProfile(profile, state, calculation);

    assert.ok(findByClass(profile, 'gas-profile-pipe-envelope'));
    assert.equal(findAllByClass(profile, 'gas-profile-depth-control').length, 3);
    assert.ok(findByClass(profile, 'gas-profile-depth-cover-line'));
    assert.ok(findByClass(profile, 'gas-profile-depth-control--manual'));
    assert.ok(findByClass(profile, 'is-selected'));

    const design = profilePointerToDesign(profile, 380, 130);
    assert.ok(design);
    assert.ok(Number.isFinite(design.stationM));
    assert.ok(Number.isFinite(design.coverM));
    assert.ok(design.stationM > calculation.routeLengthM * 0.4);
    assert.ok(design.stationM < calculation.routeLengthM * 0.6);
    assert.ok(design.coverM >= 0.3 && design.coverM <= 5);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('an empty shared tool set renders no launcher', () => {
  assert.equal(renderToolsMenu(false, { items: [] }), '');
});

test('hidden map overlays cannot override their hidden state', () => {
  const stylesheet = readFileSync(
    new URL('../src/styles/gas.css', import.meta.url),
    'utf8',
  );
  assert.match(
    stylesheet,
    /\.gas-map-state\[hidden\]\s*\{[^}]*display:\s*none\s*!important;/,
  );
});


test('multiple configured route-event types render once and replace their promoted public marker', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElementNS(_namespace, name) {
      return new FakeSvgElement(name);
    },
  };

  try {
    const state = clone(DEFAULT_STATE);
    const calculation = calculateProject(state);
    state.routeEvents = [
      {
        id: 'utility-1', routeId: 'main', type: 'utility-crossing', stationM: calculation.routeLengthM * 0.2,
        source: 'manual', sourceFeatureId: null, confirmed: true, label: '',
        crossing: { angleDeg: 90, obstacleWidthM: 0, installationMethod: 'notSpecified', utilityType: 'water', gasPosition: 'above', verticalClearanceM: 0.25, protectiveSleeve: false, ownerApprovalDocumented: false },
      },
      {
        id: 'road-1', routeId: 'main', type: 'road-crossing', stationM: calculation.routeLengthM * 0.4,
        source: 'publicScreening', sourceFeatureId: 'osm-way-77', confirmed: false, label: 'DN 7',
        crossing: { angleDeg: 86, obstacleWidthM: 12, installationMethod: 'notSpecified', utilityType: 'water', gasPosition: 'above', verticalClearanceM: 0.25, protectiveSleeve: false, ownerApprovalDocumented: false },
      },
      {
        id: 'rail-1', routeId: 'main', type: 'railway-crossing', stationM: calculation.routeLengthM * 0.6,
        source: 'manual', sourceFeatureId: null, confirmed: true, label: '',
        crossing: { angleDeg: 82, obstacleWidthM: 8, installationMethod: 'trenchless', utilityType: 'water', gasPosition: 'above', verticalClearanceM: 0.25, protectiveSleeve: true, ownerApprovalDocumented: false },
      },
      {
        id: 'water-1', routeId: 'main', type: 'watercourse-crossing', stationM: calculation.routeLengthM * 0.8,
        source: 'manual', sourceFeatureId: null, confirmed: true, label: '',
        crossing: { angleDeg: 75, obstacleWidthM: 20, installationMethod: 'trenchless', utilityType: 'water', gasPosition: 'above', verticalClearanceM: 0.25, protectiveSleeve: true, ownerApprovalDocumented: false },
      },
    ];
    state.route.selectedEventId = 'road-1';
    state.crossing.enabled = false;

    const profile = new FakeSvgElement('svg');
    renderProfile(profile, state, calculation, null, {
      status: 'ready',
      routeKey: routeObstacleRouteKey(state.route.points),
      events: [{
        id: 'osm-way-77:crossing:400',
        featureId: 'osm-way-77',
        type: 'road',
        relation: 'crossing',
        name: 'DN 7',
        stationM: calculation.routeLengthM * 0.4,
        distanceM: 0,
        angleDeg: 86,
      }],
    });

    assert.equal(findAllByClass(profile, 'gas-profile-route-event').length, 4);
    assert.ok(findByClass(profile, 'gas-profile-route-event--utility-crossing'));
    assert.ok(findByClass(profile, 'gas-profile-route-event--road-crossing'));
    assert.ok(findByClass(profile, 'gas-profile-route-event--railway-crossing'));
    assert.ok(findByClass(profile, 'gas-profile-route-event--watercourse-crossing'));
    assert.equal(findAllByClass(profile, 'gas-profile-obstacle--road').length, 0);
    assert.ok(findByClass(profile, 'is-selected'));
    assert.ok(findByClass(profile, 'is-unconfirmed'));
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
