import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { GeometryLibrary, MaterialLibrary, disposeObjectResources } from '../src/index.js';
import { buildPergola } from '../../pergola-configurator/src/scene/buildPergola.js';
import { createPergolaGeometry } from '../../pergola-configurator/src/scene/pergolaGeometry.js';
import * as stateAPI from '../../pergola-configurator/src/state.js';
import { pergolaCases } from './helpers/pergolaCases.mjs';
import { createWindowFixture } from './helpers/windowFixture.mjs';
import { WINDOW_CASES, applyWindowCase } from './helpers/windowCases.mjs';
import { productGeometrySnapshot } from './helpers/geometrySnapshot.mjs';
const requireFromPergola = createRequire(new URL('../../pergola-configurator/package.json', import.meta.url));
const THREE = await import(pathToFileURL(path.join(path.dirname(requireFromPergola.resolve('three')), 'three.module.js')).href);
function meshes(root) { const result = []; root.updateMatrixWorld(true); root.traverse(object => { if (object.isMesh) result.push(object); }); return result; }
function nearArray(a, b, tolerance = 2e-7) {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) < tolerance, `${a[i]} != ${b[i]} at ${i}`);
}
function compareMeshes(exact, finished) {
  const a = meshes(exact), b = meshes(finished); assert.equal(a.length, b.length);
  let changed = 0;
  for (let i = 0; i < a.length; i++) {
    const original = a[i].geometry, current = b[i].geometry;
    original.computeBoundingBox(); current.computeBoundingBox();
    nearArray(a[i].matrixWorld.toArray(), b[i].matrixWorld.toArray());
    nearArray(original.boundingBox.min.toArray(), current.boundingBox.min.toArray());
    nearArray(original.boundingBox.max.toArray(), current.boundingBox.max.toArray());
    assert.equal(a[i].castShadow, b[i].castShadow); assert.equal(a[i].receiveShadow, b[i].receiveShadow);
    if (current.userData.edgeFinish?.method && current.userData.edgeFinish.method !== 'none') {
      changed++;
      assert.ok(current.attributes.position.count > original.attributes.position.count);
      assert.equal(current.userData.edgeFinish.boundsPreserved, true);
      assert.equal(current.userData.surfaceUV.preserve, true);
    } else {
      for (const key of Object.keys(original.attributes)) {
        assert.deepEqual(Array.from(current.attributes[key].array), Array.from(original.attributes[key].array), `Untargeted ${key} buffer changed at mesh ${i}.`);
      }
      assert.deepEqual(current.index && Array.from(current.index.array), original.index && Array.from(original.index.array));
      assert.equal(JSON.stringify(current.groups), JSON.stringify(original.groups));
    }
  }
  return changed;
}

for (const { name, state } of pergolaCases(stateAPI)) test(`Pergola opt-in edges preserve dimensions, placement and all untargeted parts: ${name}`, () => {
  const materials = new MaterialLibrary(THREE), exactGeometry = new GeometryLibrary(THREE, { edgeDetails: false }), detailedGeometry = new GeometryLibrary(THREE);
  const beforeState = JSON.stringify(state);
  const exact = buildPergola(state, null, materials, exactGeometry), finished = buildPergola(state, null, materials, detailedGeometry);
  assert.ok(compareMeshes(exact, finished) > 0);
  assert.equal(JSON.stringify(state), beforeState);
  for (const mesh of meshes(finished)) if (['post', 'beam', 'louver'].includes(mesh.userData.geometryRole)) {
    assert.equal(mesh.geometry.userData.edgeFinish.method, 'longitudinal-radius');
    assert.ok(mesh.material.normalMap && mesh.material.roughnessMap);
    assert.equal(mesh.geometry.userData.surfaceUV.mapping, 'perimeter');
    assert.equal(mesh.material.userData.surface.id, 'aluminium.powderCoated');
  }
  disposeObjectResources([exact, finished], { materialFilter: () => true });
  assert.equal(exactGeometry.geometries.size + detailedGeometry.geometries.size, 0);
  assert.equal(materials.materials.size, 0); exactGeometry.dispose(); detailedGeometry.dispose(); materials.dispose();
});

for (const item of WINDOW_CASES) test(`Window handle bevels preserve CAD and fabrication: ${item.name}`, async () => {
  const options = { layout: item.layout, builderOptions: { getSelectedHandleSide: () => item.handle ?? 'right' } };
  const exact = await createWindowFixture({ ...options, edgeDetails: false }), finished = await createWindowFixture({ ...options, edgeDetails: true });
  for (const fixture of [exact, finished]) {
    for (const id of ['widthA', 'heightB', 'mBatant']) fixture.loader.context.document.getElementById(id);
    applyWindowCase(fixture, item);
  }
  const changed = compareMeshes(exact.builder.placementRoot, finished.builder.placementRoot);
  assert.ok(changed >= (item.name === 'three-fixed' ? 0 : 2));
  for (const mesh of meshes(finished.builder.placementRoot)) if (mesh.geometry.userData.edgeFinish?.method === 'inset-solid-bevel') {
    assert.ok(mesh.userData.windowHandleCellId, 'Only generated handle parts opt in.');
  }
  assert.deepEqual(JSON.parse(JSON.stringify(finished.builder.getFabricationSnapshot())), JSON.parse(JSON.stringify(exact.builder.getFabricationSnapshot())));
  // Each fixture has its own VM realm; normalize the snapshot, not its geometry values.
  assert.deepEqual(JSON.parse(JSON.stringify(productGeometrySnapshot(finished.builder.sectionGroup))), JSON.parse(JSON.stringify(productGeometrySnapshot(exact.builder.sectionGroup))));
  const before = productGeometrySnapshot(finished.builder.placementRoot);
  for (const quality of ['low', 'high', 'balanced']) finished.materials.setQuality(quality);
  assert.deepEqual(productGeometrySnapshot(finished.builder.placementRoot), before);
  applyWindowCase(finished, item);
  assert.deepEqual(productGeometrySnapshot(finished.builder.placementRoot), before, 'Repeated builds preserve rounded handle output.');
  for (const fixture of [exact, finished]) { fixture.builder.clearTemplateGeometryCache(); fixture.materials.dispose(); }
});

test('deck edge rounding retains board top/footprint and the explicitly unrounded substructure', () => {
  const library = new GeometryLibrary(THREE), adapter = createPergolaGeometry(library);
  const board = adapter.boardGeometry(7, .02, .15, { offset: [.2, .1] });
  const base = adapter.boardGeometry(7, .1, 5, {}, { edgeFinish: false });
  assert.equal(board.userData.edgeFinish.axis, 'x'); assert.equal(board.userData.edgeFinish.radius, .001);
  nearArray(board.boundingBox.min.toArray(), [-3.5, -.01, -.075]);
  nearArray(board.boundingBox.max.toArray(), [3.5, .01, .075]);
  assert.equal(base.userData.edgeFinish, undefined); assert.equal(base.userData.sharedGeometry.kind, 'primitive.box');
  library.dispose(); assert.equal(library.geometries.size, 0);
});

test('Window mesh reuse retains a surviving bevel buffer and its UV/finish metadata', async () => {
  const fixture = await createWindowFixture({ meshReuse: true });
  for (const id of ['widthA', 'heightB', 'mBatant']) fixture.loader.context.document.getElementById(id);
  applyWindowCase(fixture, {});
  const handlesBefore = meshes(fixture.builder.placementRoot).filter(m => m.geometry.userData.edgeFinish?.method === 'inset-solid-bevel');
  assert.ok(handlesBefore.length >= 2);
  applyWindowCase(fixture, { width: 1.4 });
  const handlesAfter = meshes(fixture.builder.placementRoot).filter(m => m.geometry.userData.edgeFinish?.method === 'inset-solid-bevel');
  assert.equal(handlesAfter.length, handlesBefore.length);
  for (const mesh of handlesAfter) { assert.equal(mesh.geometry.userData.surfaceUV.preserve, true); assert.ok(mesh.geometry.attributes.normal); }
  fixture.builder.clearTemplateGeometryCache(); fixture.materials.dispose();
});
