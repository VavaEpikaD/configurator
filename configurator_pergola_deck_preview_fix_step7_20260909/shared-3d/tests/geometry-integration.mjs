import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { GeometryLibrary, MaterialLibrary, disposeObjectResources } from '../src/index.js';
import { buildPergola } from '../../pergola-configurator/src/scene/buildPergola.js';
import * as stateAPI from '../../pergola-configurator/src/state.js';
import { pergolaCases } from './helpers/pergolaCases.mjs';
import { productGeometrySnapshot } from './helpers/geometrySnapshot.mjs';
import { createWindowModuleLoader } from './helpers/windowModules.mjs';
const requireFromPergola = createRequire(new URL('../../pergola-configurator/package.json', import.meta.url));
const THREE = await import(pathToFileURL(path.join(path.dirname(requireFromPergola.resolve('three')), 'three.module.js')).href);
const baseline = JSON.parse(fs.readFileSync(new URL('./fixtures/pergola-geometry-v1.json', import.meta.url)));

for (const { name, state } of pergolaCases(stateAPI)) test(`Pergola exact/no-edge baseline regression: ${name}`, () => {
  const materials = new MaterialLibrary(THREE), geometry = new GeometryLibrary(THREE, { edgeDetails: false });
  const beforeState = JSON.stringify(state);
  const group = buildPergola(state, null, materials, geometry);
  const actual = productGeometrySnapshot(group), expected = baseline.cases[name];
  assert.equal(JSON.stringify(state), beforeState, 'Building must not mutate product state.');
  assert.equal(actual.meshes.length, expected.meshes.length);
  // Physical dimensions, topology, placements and shadow policies are asserted
  // on every engine; byte-for-byte checks additionally cover the captured r160.
  assert.deepEqual(actual.meshes, expected.meshes);
  if (THREE.REVISION === baseline.threeRevision) assert.equal(actual.hash, expected.hash);
  let unowned = 0;
  group.traverse(object => { if (object.isMesh && !geometry.geometries.has(object.geometry)) unowned++; });
  assert.equal(unowned, 0, 'Every generated product primitive must use the shared library.');
  disposeObjectResources(group, { materialFilter: () => true });
  assert.equal(geometry.getDiagnostics().geometryCount, 0);
  assert.equal(materials.materials.size, 0);
  geometry.dispose(); materials.dispose();
});

test('a quality change never rebuilds, bevels or decimates product geometry', () => {
  const geometry = new GeometryLibrary(THREE), materials = new MaterialLibrary(THREE);
  const state = structuredClone(stateAPI.DEFAULT_STATE);
  const group = buildPergola(state, null, materials, geometry), before = productGeometrySnapshot(group);
  const registered = geometry.getDiagnostics().registeredCount;
  for (const quality of ['low', 'balanced', 'high', 'low']) materials.setQuality(quality);
  assert.deepEqual(productGeometrySnapshot(group), before);
  assert.equal(geometry.getDiagnostics().registeredCount, registered);
  disposeObjectResources(group, { materialFilter: () => true }); geometry.dispose(); materials.dispose();
});

test('repeated dimension rebuilds release shared geometry without discarding the surviving material library', () => {
  const geometry = new GeometryLibrary(THREE), materials = new MaterialLibrary(THREE);
  for (let i = 0; i < 25; i++) {
    const state = structuredClone(stateAPI.DEFAULT_STATE); state.dimensions.width += 25 * i;
    const group = buildPergola(state, null, materials, geometry);
    assert.ok(geometry.getDiagnostics().geometryCount > 0);
    disposeObjectResources(group, { materialFilter: () => true });
    assert.equal(geometry.getDiagnostics().geometryCount, 0); assert.equal(materials.materials.size, 0);
  }
  geometry.dispose(); materials.dispose();
});

test('Window adapter uses native runtime and existing mesh-reuse constructor for profiles and glass', async () => {
  const loader = createWindowModuleLoader({ meshReuse: true });
  const { createWindowGeometry } = await loader.import('window-configurator/src/client/js/window-geometry.js');
  const engine = await loader.import('window-configurator/src/client/js/three-mesh-reuse.js');
  const { MaterialLibrary: WindowMaterials } = await loader.import('shared-3d/src/index.js?v=7');
  const materials = new WindowMaterials(engine), adapter = createWindowGeometry();
  const mat = materials.create('aluminium.powderCoated');
  const pane = adapter.panel(1, 1.5, 0.024, materials.create('glass.clear'));
  assert.equal(pane.castShadow, false); assert.equal(pane.receiveShadow, true);
  assert.equal(pane.geometry.userData.sharedGeometry.kind, 'panel.rectangular');
  const source = adapter.library.create('primitive.box', { width: 1, height: 0.05, depth: 0.065 });
  const first = adapter.mesh(source, mat);
  const outer = new engine.Group(), inner = new engine.Group(); inner.add(first); outer.add(inner);
  adapter.disposeGenerated(outer); outer.clear();
  const nextSource = adapter.library.create('primitive.box', { width: 2, height: 0.05, depth: 0.065 });
  const second = adapter.mesh(nextSource, mat);
  assert.equal(second, first, 'The shared library must not bypass the existing Mesh pool.');
  assert.equal(second.geometry.boundingBox.max.x - second.geometry.boundingBox.min.x, 2);
  assert.equal(second.geometry.userData.sharedGeometry.kind, 'primitive.box');
  assert.ok(adapter.library.geometries.has(second.geometry));
  adapter.library.dispose(); materials.dispose();
});

test('Window CAD source units, rounded outlines and exact cuts pass through the adapter', async () => {
  const loader = createWindowModuleLoader();
  const { createWindowGeometry } = await loader.import('window-configurator/src/client/js/window-geometry.js');
  const { createRoundedRectShape, simplifyProfileShape } = await loader.import('window-configurator/src/client/js/geometry-utils.js');
  const adapter = createWindowGeometry(null, { captureMode: true });
  const shape = createRoundedRectShape(65, 57, 1.2);
  const simple = simplifyProfileShape(shape, 'alu');
  assert.equal(simple.userData.toleranceMm, 0.04);
  const template = adapter.profile(simple, { depth: 1, curveSegments: 8, steps: 1, bevelEnabled: false });
  assert.equal(template.userData.sharedGeometry.units, 'source');
  const transformed = adapter.clone(template); transformed.scale(0.001, 0.001, 2);
  adapter.prepare(transformed, null);
  assert.equal(transformed.userData.sharedGeometry.units, 'metres');
  assert.ok(Math.abs(transformed.boundingBox.max.x - transformed.boundingBox.min.x - 0.065) < 1e-8);
  const clipped = adapter.clip(template, p => p.x);
  for (let i = 0; i < clipped.attributes.position.count; i++) assert.ok(clipped.attributes.position.getX(i) >= -1e-10);
  adapter.library.dispose();
});
