import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { GeometryLibrary, createRoundedRectangleShape, simplifySectionShape, disposeObjectResources,
  splitPositionGeometryAtScalarZero, clipPositionGeometryToScalarHalfspace } from '../src/index.js';

const moduleUrl = process.env.SURFACE_THREE_MODULE
  ? pathToFileURL(process.env.SURFACE_THREE_MODULE)
  : new URL('../../window-configurator/src/client/lib/three.module.js', import.meta.url);
const THREE = await import(moduleUrl.href);
console.log(`Geometry library tests: Three.js r${THREE.REVISION}`);

function snapshot(geometry) {
  return {
    attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([id, a]) => [id, Array.from(a.array)])),
    index: geometry.index ? Array.from(geometry.index.array) : null,
    groups: geometry.groups.map(g => ({ ...g })),
  };
}
function shapeWithHole() {
  const shape = createRoundedRectangleShape(THREE, 80, 55, 2);
  const hole = new THREE.Path();
  hole.moveTo(-30, -17); hole.lineTo(-30, 17); hole.lineTo(30, 17); hole.lineTo(30, -17); hole.closePath();
  shape.holes.push(hole);
  return shape;
}

for (const [id, params, previous] of [
  ['primitive.box', { width: 4.2, height: 0.16, depth: 0.14 }, () => new THREE.BoxGeometry(4.2, 0.16, 0.14)],
  ['panel.rectangular', { width: 1.13, height: 2.2, thickness: 0.024 }, () => new THREE.BoxGeometry(1.13, 2.2, 0.024)],
  ['primitive.cylinder', { radius: 0.024, height: 2.48, radialSegments: 12 }, () => new THREE.CylinderGeometry(0.024, 0.024, 2.48, 12)],
  ['primitive.cylinder', { radiusTop: 0.11, radiusBottom: 0.2, height: 2.3, radialSegments: 9 }, () => new THREE.CylinderGeometry(0.11, 0.2, 2.3, 9)],
  ['primitive.plane', { width: 50, height: 50 }, () => new THREE.PlaneGeometry(50, 50)],
]) test(`${id} preserves the previous vertices, normals, UVs, winding and groups`, () => {
  const lib = new GeometryLibrary(THREE), reference = previous();
  assert.deepEqual(snapshot(lib.create(id, params)), snapshot(reference));
  reference.dispose(); lib.dispose();
});

test('CAD extrusion preserves holes, caps, settings, section coordinates and source shapes', () => {
  const lib = new GeometryLibrary(THREE), shape = shapeWithHole();
  const sourceJSON = JSON.stringify(shape.toJSON());
  const settings = { depth: 1, steps: 1, curveSegments: 8, bevelEnabled: false };
  const beforeSettings = { ...settings };
  const actual = lib.create('profile.extrusion', { shape, settings }, { units: 'source' });
  const expected = new THREE.ExtrudeGeometry(shape, settings);
  assert.deepEqual(snapshot(actual), snapshot(expected));
  assert.equal(JSON.stringify(shape.toJSON()), sourceJSON); assert.deepEqual(settings, beforeSettings);
  assert.deepEqual(actual.userData.sharedGeometry.materialSlots, { caps: 0, walls: 1 });
  assert.equal(actual.userData.sharedGeometry.units, 'source');
  expected.dispose(); lib.dispose();
});

test('multi-island sections extrude without joining or dropping shapes', () => {
  const lib = new GeometryLibrary(THREE);
  const shapes = [shapeWithHole(), createRoundedRectangleShape(THREE, 8, 4, 1)];
  const options = { depth: 0.1, curveSegments: 3, bevelEnabled: false, steps: 1 };
  const a = lib.create('profile.extrusion', { shape: shapes, settings: options });
  const b = new THREE.ExtrudeGeometry(shapes, options);
  assert.deepEqual(snapshot(a), snapshot(b)); b.dispose(); lib.dispose();
});

test('new geometries and template clones do not share mutable buffers', () => {
  const lib = new GeometryLibrary(THREE), p = { width: 3, height: 0.16, depth: 0.1 };
  const a = lib.create('primitive.box', p), b = lib.create('primitive.box', p), clone = lib.clone(a);
  const bx = b.attributes.position.getX(0), cx = clone.attributes.position.getX(0);
  a.attributes.position.setX(0, 99);
  assert.equal(b.attributes.position.getX(0), bx); assert.equal(clone.attributes.position.getX(0), cx);
  a.dispose(); assert.equal(lib.getDiagnostics().geometryCount, 2); lib.dispose();
});

test('finalizing deformed geometry refreshes bounds and UVs without changing exact CAD vertices', () => {
  const lib = new GeometryLibrary(THREE);
  const g = lib.create('primitive.box', { width: 1, height: 0.1, depth: 0.06 });
  g.computeBoundingBox(); g.scale(4, 1, 1);
  const before = snapshot(g);
  lib.prepare(g, { uv: { grainAxis: 'x' } });
  const after = snapshot(g);
  assert.deepEqual(after.attributes.position, before.attributes.position);
  assert.deepEqual(after.attributes.normal, before.attributes.normal);
  assert.deepEqual(after.index, before.index); assert.deepEqual(after.groups, before.groups);
  assert.equal(g.boundingBox.max.x - g.boundingBox.min.x, 4);
  assert.ok(g.boundingSphere.radius >= 2); assert.equal(g.userData.surfaceUV.grainAxis, 'x'); lib.dispose();
});

test('normal regeneration is explicit and source-template UV mapping is rejected', () => {
  const lib = new GeometryLibrary(THREE);
  const g = lib.create('primitive.box', { width: 1, height: 1, depth: 1 });
  assert.throws(() => lib.prepare(g, { units: 'source', uv: true }), /Transform/);
  assert.throws(() => lib.prepare(g, { normals: 'smooth-everything' }), /normal policy/);
  g.deleteAttribute('normal'); lib.prepare(g, { normals: 'recompute', uv: true });
  assert.ok(g.attributes.normal); assert.ok([...g.attributes.uv.array].every(Number.isFinite)); lib.dispose();
});

test('geometry definitions can be registered without changing either configurator', () => {
  const a = new GeometryLibrary(THREE), b = new GeometryLibrary(THREE);
  a.register('profile.custom', (p, engine) => new engine.BoxGeometry(p.length, 0.03, 0.02), { face: 0 });
  assert.equal(a.create('profile.custom', { length: 2 }).userData.sharedGeometry.kind, 'profile.custom');
  assert.throws(() => a.register('profile.custom', () => null), /already registered/);
  assert.throws(() => b.create('profile.custom'), /Unknown/);
  assert.throws(() => a.register('broken', () => null, { face: -1 }), /slot/);
  a.register('bad-result', () => ({})); assert.throws(() => a.create('bad-result'), /BufferGeometry/);
  a.dispose(); b.dispose();
});

test('invalid dimensions fail before allocating a geometry', () => {
  const lib = new GeometryLibrary(THREE);
  for (const width of [NaN, Infinity, 0, -1, '3']) assert.throws(() => lib.create('primitive.box', { width, height: 1, depth: 1 }));
  assert.throws(() => lib.create('primitive.cylinder', { radius: -1, height: 1 }));
  assert.throws(() => lib.create('primitive.cylinder', { radius: 1, height: 1, radialSegments: 2 }));
  assert.throws(() => lib.create('profile.extrusion', { shape: {}, settings: { depth: 1 } }));
  assert.throws(() => lib.create('primitive.box', { width: 1, height: 1, depth: 1 }, { units: 'mm' }));
  assert.equal(lib.getDiagnostics().geometryCount, 0); lib.dispose();
});

test('rounded sections stay inside nominal size and preserve holes during opt-in simplification', () => {
  const source = shapeWithHole();
  const reduced = simplifySectionShape(THREE, source, { tolerance: 0.04, curveSegments: 3 });
  assert.equal(reduced.holes.length, 1); assert.notEqual(reduced, source);
  assert.ok(reduced.userData.optimizedPointCount <= reduced.userData.sourcePointCount);
  const g = new THREE.ExtrudeGeometry(reduced, { depth: 1, bevelEnabled: false }); g.computeBoundingBox();
  assert.equal(g.boundingBox.max.x - g.boundingBox.min.x, 80);
  assert.equal(g.boundingBox.max.y - g.boundingBox.min.y, 55); g.dispose();
  assert.throws(() => createRoundedRectangleShape(THREE, 1, 2, -1));
  assert.throws(() => simplifySectionShape(THREE, source, { tolerance: NaN }));
});

test('cuts preserve the input and winding while interpolating the exact scalar plane', () => {
  const source = new THREE.BufferGeometry();
  source.setAttribute('position', new THREE.Float32BufferAttribute([-2,0,0, 2,0,0, 2,1,0], 3));
  const before = snapshot(source);
  const split = splitPositionGeometryAtScalarZero(THREE, source, p => p.x);
  const clip = clipPositionGeometryToScalarHalfspace(THREE, source, p => p.x);
  assert.deepEqual(snapshot(source), before);
  const pos = clip.attributes.position;
  for (let i = 0; i < pos.count; i++) assert.ok(pos.getX(i) >= 0);
  assert.ok(Array.from(pos.array).includes(0));
  for (const geometry of [split, clip]) {
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1), c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
      assert.ok(b.sub(a).cross(c.sub(a)).z >= 0);
    }
    assert.equal(geometry.attributes.normal, undefined); geometry.dispose();
  }
  source.dispose();
});

test('indexed geometry cut releases temporary storage even when a resolver throws', () => {
  const g = new THREE.BoxGeometry(1, 1, 1);
  let temporaryDisposals = 0, originalDisposals = 0;
  g.addEventListener('dispose', () => originalDisposals++);
  const original = g.toNonIndexed.bind(g);
  g.toNonIndexed = () => { const tmp = original(); tmp.addEventListener('dispose', () => temporaryDisposals++); return tmp; };
  assert.throws(() => splitPositionGeometryAtScalarZero(THREE, g, () => NaN), /non-finite/);
  assert.throws(() => clipPositionGeometryToScalarHalfspace(THREE, g, () => { throw new Error('bad plane'); }), /bad plane/);
  assert.equal(temporaryDisposals, 2); assert.equal(originalDisposals, 0); g.dispose();
});

test('resource cleanup deduplicates shared geometry, leaves retained PBR maps and materials intact', () => {
  const lib = new GeometryLibrary(THREE), group = new THREE.Group(), texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture });
  const geo = lib.create('primitive.box', { width: 1, height: 1, depth: 1 });
  group.add(lib.mesh(geo, material), lib.mesh(geo, material));
  let disposedTextures = 0, disposedMaterials = 0, disposedGeometry = 0;
  texture.addEventListener('dispose', () => disposedTextures++); material.addEventListener('dispose', () => disposedMaterials++);
  geo.addEventListener('dispose', () => disposedGeometry++);
  assert.deepEqual(disposeObjectResources([group, group]), { geometries: 1, materials: 0, textures: 0 });
  assert.equal(disposedGeometry, 1); assert.equal(disposedMaterials, 0); assert.equal(disposedTextures, 0);
  assert.equal(group.children.length, 2); assert.equal(lib.getDiagnostics().geometryCount, 0);
  lib.dispose(); material.dispose(); texture.dispose();
});

test('explicit sprite/compass ownership disposes a shared texture only once', () => {
  const group = new THREE.Group(), map = new THREE.Texture(), mat = new THREE.SpriteMaterial({ map });
  group.add(new THREE.Sprite(mat), new THREE.Sprite(mat));
  let disposed = 0; map.addEventListener('dispose', () => disposed++);
  disposeObjectResources(group, { geometryFilter: () => false, materialFilter: () => true, ownedTextures: m => [m.map] });
  assert.equal(disposed, 1);
});

test('host Mesh constructors are used and pooled surviving geometries are tracked', () => {
  const surviving = new THREE.BoxGeometry(2, 1, 1), pooled = new THREE.Mesh(surviving);
  const engine = { ...THREE, Mesh: class { constructor(candidate, material) { candidate.dispose(); pooled.material = material; return pooled; } } };
  const lib = new GeometryLibrary(engine), mat = new THREE.MeshStandardMaterial();
  const candidate = lib.create('primitive.box', { width: 2, height: 1, depth: 1 });
  const mesh = lib.mesh(candidate, mat, { castShadow: true });
  assert.equal(mesh, pooled); assert.equal(mesh.castShadow, true);
  assert.ok(lib.geometries.has(surviving)); assert.equal(lib.geometries.has(candidate), false);
  assert.equal(lib.getDiagnostics().geometryCount, 1); lib.dispose(); mat.dispose();
});

test('scene geometry ownership ends cleanly and rejects creation after teardown', () => {
  const lib = new GeometryLibrary(THREE), geo = lib.create('primitive.box', { width: 1, height: 1, depth: 1 });
  let disposed = 0; geo.addEventListener('dispose', () => disposed++);
  lib.dispose(); lib.dispose(); assert.equal(disposed, 1); assert.equal(lib.getDiagnostics().geometryCount, 0);
  assert.throws(() => lib.create('primitive.box'), /disposed/);
  assert.throws(() => lib.prepare(geo), /disposed/);
});
