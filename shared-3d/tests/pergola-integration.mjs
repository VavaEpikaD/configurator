import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Resolve from Pergola, not from the test folder: the library must use the same
// Three.js module as the actual builder, including after a normal npm ci there.
const requireFromPergola = createRequire(new URL('../../pergola-configurator/package.json', import.meta.url));
const enginePath = path.join(path.dirname(requireFromPergola.resolve('three')), 'three.module.js');
const THREE = await import(pathToFileURL(enginePath).href);
console.log(`Pergola geometry integration: installed Three.js r${THREE.REVISION}`);
import { MaterialLibrary } from '../src/index.js';
import { buildPergola } from '../../pergola-configurator/src/scene/buildPergola.js';
import { DEFAULT_STATE, getPoleGrid } from '../../pergola-configurator/src/state.js';

function dispose(group) {
  const materials = new Set();
  group.traverse(object => {
    object.geometry?.dispose();
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) if (material) materials.add(material);
  });
  materials.forEach(material => material.dispose());
}
function geometrySnapshot(group) {
  const meshes = [];
  group.updateMatrixWorld(true);
  group.traverse(object => {
    if (object.isMesh) meshes.push({
      positions: Array.from(object.geometry.attributes.position.array),
      matrix: object.matrixWorld.toArray(),
    });
  });
  return meshes;
}

test('Pergola surface mapping does not change any product vertices or placements', () => {
  const library = new MaterialLibrary(THREE);
  const state = structuredClone(DEFAULT_STATE);
  const originalMaterials = buildPergola(state);
  const sharedMaterials = buildPergola(state, null, library);
  assert.deepEqual(geometrySnapshot(sharedMaterials), geometrySnapshot(originalMaterials));
  assert.equal(library.getDiagnostics().activeMaterials['aluminium.powderCoated'], 3);
  dispose(originalMaterials); dispose(sharedMaterials); library.dispose();
});
test('Pergola side glazing uses shared glass and remains a non-shadow caster', () => {
  const library = new MaterialLibrary(THREE);
  const state = structuredClone(DEFAULT_STATE);
  const segment = getPoleGrid(state).segments[0];
  state.sideSegments[segment.id].type = 'glass';
  const group = buildPergola(state, null, library);
  let panes = 0;
  group.traverse(object => {
    if (object.material?.userData?.surface?.id === 'glass.clear') {
      panes++;
      assert.equal(object.castShadow, false);
      assert.equal(object.material.metalness, 0);
      assert.ok(object.material.transmission > 0);
    }
  });
  assert.ok(panes >= 2);
  dispose(group); assert.equal(library.materials.size, 0); library.dispose();
});
test('rebuilding a pergola without spotlights leaves no unattached managed materials', () => {
  const library = new MaterialLibrary(THREE);
  for (let i = 0; i < 20; i++) {
    const group = buildPergola(structuredClone(DEFAULT_STATE), null, library);
    dispose(group);
    assert.equal(library.materials.size, 0);
  }
  assert.equal(library.textures.size, 2); library.dispose();
});
