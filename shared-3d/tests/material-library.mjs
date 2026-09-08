import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { MaterialLibrary, applySurfaceUVs, normalizeQuality, getQualityProfile } from '../src/index.js';
import { createSurfacePixels } from '../src/materials/SurfaceTextures.js';

// Defaults to Window's actual vendored engine. Re-run against Pergola's installed
// engine with SURFACE_THREE_MODULE=pergola-configurator/node_modules/three/build/three.module.js.
const moduleUrl = process.env.SURFACE_THREE_MODULE
  ? pathToFileURL(process.env.SURFACE_THREE_MODULE)
  : new URL('../../window-configurator/src/client/lib/three.module.js', import.meta.url);
const THREE = await import(moduleUrl.href);
console.log(`Surface unit tests: Three.js r${THREE.REVISION}`);

test('middle tier preserves existing balanced saves and accepts medium alias', () => {
  assert.equal(normalizeQuality('medium'), 'balanced');
  assert.equal(normalizeQuality('balanced'), 'balanced');
  assert.equal(normalizeQuality('unknown'), 'balanced');
  assert.equal(normalizeQuality('__proto__'), 'balanced');
});
test('phone caps raster budget without silently turning High materials into Low', () => {
  const q = getQualityProfile('high', { devicePixelRatio: 3, compact: true });
  assert.equal(q.quality, 'high'); assert.equal(q.pixelRatio, 1.5);
  assert.equal(q.shadowSize, 1024); assert.equal(q.transmission, true);
  assert.equal(getQualityProfile('high', { capture: true }).quality, 'low');
});
test('all four families produce independent material instances', () => {
  const library = new MaterialLibrary(THREE);
  const ids = ['aluminium.powderCoated', 'aluminium.bare', 'aluminium.anodized', 'glass.clear', 'wood.oak'];
  const materials = ids.map(id => library.create(id));
  assert.ok(materials.every(material => material.isMeshStandardMaterial));
  assert.equal(materials[0].metalness, 0); assert.equal(materials[1].metalness, 1);
  assert.equal(materials[3].metalness, 0); assert.equal(materials[3].ior, 1.5);
  assert.equal(materials[3].opacity, 1); assert.ok(materials[3].transmission > 0);
  assert.ok(materials[4].map);
  assert.notEqual(library.create(ids[0]), materials[0]);
  library.dispose();
});
test('same coating on two objects shares texture data, not color/opacity state', () => {
  const library = new MaterialLibrary(THREE);
  const a = library.create('aluminium.powderCoated', { color: '#ff0000' });
  const b = library.create('aluminium.powderCoated', { color: '#00ff00' });
  assert.equal(a.normalMap, b.normalMap);
  a.color.set('#0000ff'); assert.equal(b.color.getHexString(), '00ff00');
  a.dispose(); assert.ok(library.materials.has(b)); assert.ok(b.normalMap.image.data);
  library.dispose();
});
test('color maps are sRGB; normal and roughness maps remain non-color data', () => {
  const library = new MaterialLibrary(THREE);
  const wood = library.create('wood.oak');
  assert.equal(wood.map.colorSpace, THREE.SRGBColorSpace);
  assert.equal(wood.normalMap.colorSpace, THREE.NoColorSpace);
  assert.equal(wood.roughnessMap.colorSpace, THREE.NoColorSpace);
  assert.equal(wood.map.repeat.x, 1 / 2.4);
  assert.equal(wood.map.repeat.y, 1 / 0.24);
  library.dispose();
});
test('quality changes are in-place, reversible, and do not change product colors', () => {
  const library = new MaterialLibrary(THREE);
  const metal = library.create('aluminium.anodized', { color: '#907e61' });
  const glass = library.create('glass.clear');
  const wood = library.create('wood.oak');
  const normal = metal.normalMap;
  library.setQuality('low');
  assert.equal(metal.normalMap, null); assert.equal(metal.color.getHexString(), '907e61');
  assert.equal(glass.transmission, 0); assert.equal(glass.depthWrite, false);
  assert.ok(glass.transparent); assert.ok(wood.map);
  library.setQuality('high');
  assert.equal(metal.normalMap, normal); assert.ok(glass.transmission > 0);
  assert.equal(glass.opacity, 1); assert.equal(glass.transparent, false);
  assert.equal(library.setQuality('high'), false);
  library.dispose();
});
test('cloned managed materials retain tint and follow quality changes', () => {
  const library = new MaterialLibrary(THREE);
  const source = library.create('aluminium.powderCoated');
  const copy = library.clone(source); copy.color.set('#ffffff');
  library.setQuality('low'); assert.equal(copy.normalMap, null);
  library.setQuality('balanced'); assert.ok(copy.normalMap);
  assert.equal(copy.color.getHexString(), 'ffffff');
  source.dispose(); copy.dispose(); assert.equal(library.getDiagnostics().materialCount, 0);
  library.dispose();
});
test('new semantic materials can be registered without changing either configurator', () => {
  const library = new MaterialLibrary(THREE);
  library.register('steel.painted', { type: 'standard', metalness: 0, roughness: 0.6, color: '#444444' });
  assert.equal(library.create('steel.painted').roughness, 0.6);
  assert.throws(() => library.register('steel.painted', {}));
  assert.throws(() => library.create('unregistered'));
  library.dispose(); assert.throws(() => library.create('wood.oak'));
});
test('UV mapping keeps all positions, normals, indices, dimensions unchanged', () => {
  const geometry = new THREE.BoxGeometry(4, 0.2, 0.14);
  const positions = geometry.attributes.position.array.slice();
  const normals = geometry.attributes.normal.array.slice();
  const index = geometry.index.array.slice();
  applySurfaceUVs(THREE, geometry, { grainAxis: 'x' });
  assert.deepEqual(geometry.attributes.position.array, positions);
  assert.deepEqual(geometry.attributes.normal.array, normals);
  assert.deepEqual(geometry.index.array, index);
  assert.equal(geometry.boundingBox.max.x - geometry.boundingBox.min.x, 4);
  assert.ok([...geometry.attributes.uv.array].every(Number.isFinite));
  geometry.dispose();
});
test('wood grain follows long dimension and uses metres, not normalized stretch UVs', () => {
  const a = applySurfaceUVs(THREE, new THREE.BoxGeometry(2, 0.1, 0.16), { grainAxis: 'x' });
  const b = applySurfaceUVs(THREE, new THREE.BoxGeometry(4, 0.1, 0.16), { grainAxis: 'x' });
  const uSpanOnTop = g => {
    const values = [];
    for (let i = 0; i < g.attributes.position.count; i++) {
      if (g.attributes.normal.getY(i) > 0.9) values.push(g.attributes.uv.getX(i));
    }
    return Math.max(...values) - Math.min(...values);
  };
  assert.equal(uSpanOnTop(a), 2); assert.equal(uSpanOnTop(b), 4);
  const mm = applySurfaceUVs(THREE, new THREE.BoxGeometry(2000, 100, 160), { unitScale: 0.001 });
  assert.equal(uSpanOnTop(mm), 2);
  a.dispose(); b.dispose(); mm.dispose();
});
test('procedural source maps are deterministic across scenes and reloads', () => {
  const a = createSurfacePixels('oak', 32), b = createSurfacePixels('oak', 32);
  assert.deepEqual(a.color, b.color); assert.deepEqual(a.normal, b.normal);
  assert.ok(new Set(a.color).size > 50);
});
test('repeated product rebuilds unregister disposed materials and reuse bounded textures', () => {
  const library = new MaterialLibrary(THREE);
  for (let i = 0; i < 30; i++) {
    const a = library.create('aluminium.powderCoated');
    const b = library.create('glass.clear');
    a.dispose(); b.dispose();
  }
  assert.equal(library.materials.size, 0); assert.equal(library.textures.size, 2);
  library.dispose(); assert.equal(library.textures.size, 0);
});

test('a preloaded texture provider extends the catalog with library-owned texture variants', () => {
  const library = new MaterialLibrary(THREE);
  const loaded = new THREE.DataTexture(new Uint8Array([90, 50, 30, 255]), 1, 1);
  let sourceDisposals = 0;
  loaded.addEventListener('dispose', () => sourceDisposals++);
  library.textures.register('walnut-scanned', () => ({ color: loaded }));
  library.register('wood.walnut', {
    type: 'standard', texture: 'walnut-scanned', tile: [2, 0.25], roughness: 0.7,
  });
  const material = library.create('wood.walnut');
  assert.notEqual(material.map, loaded);
  assert.equal(material.map.image, loaded.image);
  assert.equal(material.map.repeat.x, 0.5);
  library.dispose(); assert.equal(sourceDisposals, 0);
  loaded.dispose();
});
test('a failed texture provider does not leave an orphan managed material', () => {
  const library = new MaterialLibrary(THREE);
  library.textures.register('broken-source', () => { throw new Error('asset not ready'); });
  library.register('test.failed', { type: 'standard', texture: 'broken-source' });
  assert.throws(() => library.create('test.failed'), /asset not ready/);
  assert.equal(library.materials.size, 0);
  library.dispose();
});
