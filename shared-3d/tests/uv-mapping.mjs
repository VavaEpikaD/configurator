import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../../window-configurator/src/client/lib/three.module.js';
import { GeometryLibrary, MaterialLibrary, applyGeometrySurfaceUVs, normalizeSurfaceMapping, declareSurfaceMapping } from '../src/index.js';
const near = (a, b, tolerance = 3e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const axisIndex = axis => ['x', 'y', 'z'].indexOf(axis);
const component = (a, i, axis) => a[['getX', 'getY', 'getZ'][axis]](i);
const protectedData = g => JSON.stringify({
  attributes: Object.fromEntries(Object.entries(g.attributes).filter(([name]) => name !== 'uv').map(([name, attr]) => [name, Array.from(attr.array)])),
  index: g.index && Array.from(g.index.array), groups: g.groups,
});
function section() {
  const s = new THREE.Shape(); s.moveTo(-.04, -.005); s.lineTo(.04, -.005); s.lineTo(.04, .005); s.lineTo(-.04, .005); s.closePath(); return s;
}
for (const axis of ['x', 'y', 'z']) test(`short member uses explicit ${axis} direction, not the longest dimension`, () => {
  const size = [.3, .25, .2]; size[axisIndex(axis)] = .02;
  const g = new THREE.BoxGeometry(...size).toNonIndexed(), before = protectedData(g);
  applyGeometrySurfaceUVs(THREE, g, { mode: 'extrusion', grainAxis: axis });
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, a = axisIndex(axis);
  for (let i = 0; i < p.count; i++) if (Math.abs(component(n, i, a)) < .01) near(uv.getX(i), component(p, i, a));
  assert.equal(protectedData(g), before); assert.equal(g.userData.surfaceUV.grainAxis, axis); g.dispose();
});
test('oblique profile walls and mitre caps have non-stretched metre-scale UVs', () => {
  const g = new THREE.ExtrudeGeometry(section(), { depth: .025, bevelEnabled: false }); g.rotateZ(Math.PI / 4);
  applyGeometrySurfaceUVs(THREE, g, { mode: 'extrusion', grainAxis: 'z' });
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i += 3) for (let j = 0; j < 3; j++) {
    const a = i + j, b = i + (j + 1) % 3;
    const length = Math.hypot(p.getX(a) - p.getX(b), p.getY(a) - p.getY(b), p.getZ(a) - p.getZ(b));
    near(Math.hypot(uv.getX(a) - uv.getX(b), uv.getY(a) - uv.getY(b)), length);
  }
  g.dispose();
});
test('projection does not switch inside a triangle when smoothing normals vary', () => {
  const g = new THREE.ExtrudeGeometry(section(), { depth: .4, bevelEnabled: false });
  const altered = g.clone(), n = altered.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, Math.sin(i), Math.cos(i), 0);
  for (const current of [g, altered]) applyGeometrySurfaceUVs(THREE, current, { mode: 'extrusion', grainAxis: 'z' });
  assert.deepEqual(g.attributes.uv.array, altered.attributes.uv.array); g.dispose(); altered.dispose();
});
for (const length of [.04, 1, 3.8]) test(`length ${length} changes the number of repeats, not grain width`, () => {
  const g = new THREE.ExtrudeGeometry(section(), { depth: length, bevelEnabled: false });
  applyGeometrySurfaceUVs(THREE, g, { mode: 'extrusion', grainAxis: 'z' });
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < p.count; i++) if (Math.abs(n.getZ(i)) < .01) {
    near(uv.getX(i), p.getZ(i)); min = Math.min(min, uv.getX(i)); max = Math.max(max, uv.getX(i));
  }
  near(max - min, length); g.dispose();
});
for (const axis of ['x', 'y', 'z']) test(`cylindrical ${axis} mapping unwraps the seam and caps without changing normals`, () => {
  const g = new THREE.CylinderGeometry(.025, .025, .7, 24);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  const before = protectedData(g);
  applyGeometrySurfaceUVs(THREE, g, { mode: 'cylindrical', grainAxis: axis, radius: .025, seamAngle: axis === 'x' ? Math.PI / 2 : axis === 'z' ? -Math.PI / 2 : 0 });
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, a = axisIndex(axis);
  let minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < p.count; i++) if (Math.abs(component(n, i, a)) < .01) {
    near(uv.getX(i), component(p, i, a)); minV = Math.min(minV, uv.getY(i)); maxV = Math.max(maxV, uv.getY(i));
  }
  near(maxV - minV, 2 * Math.PI * .025);
  const first = Array.from(uv.array); applyGeometrySurfaceUVs(THREE, g);
  assert.deepEqual(Array.from(g.attributes.uv.array), first, 'Reapplying never multiplies repeat again.');
  assert.equal(protectedData(g), before); g.dispose();
});
test('cylinder wall receives metre-scale rather than normalized radial mapping after a height change', () => {
  const lib = new GeometryLibrary(THREE), materials = new MaterialLibrary(THREE), mat = materials.create('aluminium.bare');
  const textureState = [mat.normalMap.repeat.toArray(), mat.roughnessMap.repeat.toArray()];
  for (const height of [.1, 4]) {
    const g = lib.create('primitive.cylinder', { radius: .02, height });
    lib.mesh(g, mat, { uv: true, mapping: { mode: 'cylindrical', grainAxis: 'y', radius: .02 } });
    near(g.attributes.uv.getX(0), height / 2);
  }
  assert.deepEqual([mat.normalMap.repeat.toArray(), mat.roughnessMap.repeat.toArray()], textureState); materials.dispose(); lib.dispose();
});
test('millimetre geometry, explicit dimensional scale, direction and offsets are applied once', () => {
  const g = new THREE.BoxGeometry(1000, 100, 200);
  const map = { mode: 'box', grainAxis: 'x', unitScale: .001, scale: [2, 1, 1], origin: [500, 0, 0], direction: -1, offset: [.3, .2] };
  applyGeometrySurfaceUVs(THREE, g, map);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) if (Math.abs(n.getX(i)) < .01) near(uv.getX(i), -(p.getX(i) - 500) * .002 + .3);
  const first = uv.array.slice(); applyGeometrySurfaceUVs(THREE, g); assert.deepEqual(g.attributes.uv.array, first); g.dispose();
});
test('planar floor and panel mapping declares both axes and is independent of face normals', () => {
  const g = new THREE.PlaneGeometry(2, 3); g.rotateX(-Math.PI / 2);
  applyGeometrySurfaceUVs(THREE, g, { mode: 'planar', grainAxis: 'z', normalAxis: 'y', offset: [.2, .4] });
  for (let i = 0; i < g.attributes.position.count; i++) {
    near(g.attributes.uv.getX(i), g.attributes.position.getZ(i) + .2);
    near(g.attributes.uv.getY(i), g.attributes.position.getX(i) + .4);
  }
  g.dispose();
});
test('rounded beams and accepted deck boards keep their authored perimeter UVs byte-identical', () => {
  const lib = new GeometryLibrary(THREE);
  for (const parameters of [{width:4,height:.02,depth:.15,axis:'x',radius:.001,uvOffset:[.731,.413]}, {width:.15,height:3,depth:.15,axis:'y'}]) {
    const g = lib.create('profile.roundedRectangle', parameters), before = g.attributes.uv.array.slice();
    lib.prepare(g, { uv: true }); assert.deepEqual(g.attributes.uv.array, before); assert.equal(g.userData.surfaceMapping.mode, 'authored');
  }
  lib.dispose();
});
test('cut and split results retain mapping direction but regenerate their own UVs after finalization', () => {
  const lib = new GeometryLibrary(THREE);
  const g = lib.create('profile.extrusion', { shape: section(), settings: { depth: .02 } });
  lib.prepare(g, { uv: true, mapping: { mode: 'extrusion', grainAxis: 'z', offset: [.2,.3] } });
  for (const op of ['splitAtScalarZero', 'clipToScalarHalfspace']) {
    const next = lib[op](g, p => p.x);
    assert.equal(next.getAttribute('uv'), undefined); assert.equal(next.userData.surfaceMapping.grainAxis, 'z');
    next.computeVertexNormals(); lib.prepare(next, { uv: true });
    assert.ok([...next.attributes.uv.array].every(Number.isFinite));
    next.userData.surfaceMapping.offset[0] = 99; assert.equal(g.userData.surfaceMapping.offset[0], .2);
  }
  lib.dispose();
});
test('mapping metadata is copied independently across geometry clone and mesh ownership', () => {
  const lib = new GeometryLibrary(THREE), g = lib.create('primitive.box', {width:1,height:.1,depth:.1});
  lib.prepare(g, { uv: true, mapping: {mode:'box',grainAxis:'x',offset:[.2,.3]} });
  const clone = lib.clone(g); clone.userData.surfaceMapping.offset[0] = 99;
  assert.equal(g.userData.surfaceMapping.offset[0], .2);
  lib.dispose(); assert.equal(lib.getDiagnostics().uvMapping.declared, 0);
});
test('mapping is local to the part: assembly translations and opening rotations do not make it swim', () => {
  const lib = new GeometryLibrary(THREE), g = lib.create('primitive.box', {width:1,height:.1,depth:.1});
  lib.prepare(g, {uv:true,mapping:{mode:'box',grainAxis:'x'}});
  const uv = g.attributes.uv.array.slice(), mesh = new THREE.Mesh(g), group = new THREE.Group(); group.add(mesh);
  group.position.set(4,5,6); group.rotation.set(.4,.6,.8); group.updateMatrixWorld(true);
  assert.deepEqual(g.attributes.uv.array, uv); mesh.material.dispose(); lib.dispose();
});
test('invalid mapping inputs fail atomically; welded seams are never repaired by moving CAD vertices', () => {
  const g = new THREE.BoxGeometry(.1,.1,.1), before = g.attributes.uv.array.slice();
  for (const options of [{mode:'auto',grainAxis:'x'}, {mode:'box',grainAxis:'auto'}, {mode:'box',grainAxis:'x',offset:[NaN,0]},
    {mode:'box',grainAxis:'x',unitScale:0}, {mode:'box',grainAxis:'x',scale:[1,0,1]}, {mode:'box',grainAxis:'x',direction:0},
    {mode:'planar',grainAxis:'x',normalAxis:'x'}, {mode:'cylindrical',grainAxis:'y',radius:-1},
    {mode:'cylindrical',grainAxis:'y',radius:.1,scale:[2,1,1]}]) assert.throws(()=>applyGeometrySurfaceUVs(THREE,g,options));
  assert.deepEqual(g.attributes.uv.array,before); assert.equal(g.userData.surfaceMapping,undefined);
  const welded = new THREE.BufferGeometry();
  welded.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,0,0,1],3));
  welded.setIndex([0,1,2,0,3,1]); const vertices=welded.attributes.position.array.slice();
  assert.throws(()=>applyGeometrySurfaceUVs(THREE,welded,{mode:'extrusion',grainAxis:'z'}),/seam/);
  assert.deepEqual(welded.attributes.position.array,vertices); assert.equal(welded.getAttribute('uv'),undefined);
  g.dispose();welded.dispose();
});
test('source-space CAD cannot be projected until its adapter has converted it', () => {
  const lib = new GeometryLibrary(THREE), g = lib.create('profile.extrusion',{shape:section(),settings:{depth:1}},{units:'source'});
  assert.throws(()=>lib.prepare(g,{units:'source',uv:true,mapping:{mode:'extrusion',grainAxis:'z'}}),/Transform source/);lib.dispose();
});
test('authored imported UVs are preserved and tangent-based maps cannot be silently reprojected', () => {
  const g = new THREE.BoxGeometry(); const original = g.attributes.uv.array.slice();
  declareSurfaceMapping(g,{mode:'authored',grainAxis:'x'});applyGeometrySurfaceUVs(THREE,g);assert.deepEqual(g.attributes.uv.array,original);
  g.setAttribute('tangent',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*4),4));
  assert.throws(()=>applyGeometrySurfaceUVs(THREE,g,{mode:'box',grainAxis:'x'}),/tangent/);g.dispose();
});

test('linear drag UV deformer matches a fresh projection, is baseline-relative, and restores exactly', () => {
  const lib=new GeometryLibrary(THREE),g=lib.create('profile.extrusion',{shape:section(),settings:{depth:1}});
  lib.prepare(g,{uv:true,mapping:{mode:'extrusion',grainAxis:'z'}});
  const positions=g.attributes.position.array.slice(),uvs=g.attributes.uv.array.slice();
  const update=lib.captureSurfaceUVDeformation(g,positions);assert.ok(update);
  for(const length of [1.8,.6,2.2]) {
    const p=g.attributes.position;
    for(let i=0;i<p.count;i++)p.setZ(i,positions[i*3+2]*length);
    assert.equal(update.update(),true);
    const exact=g.clone();applyGeometrySurfaceUVs(THREE,exact);
    for(let i=0;i<uvs.length;i++)near(g.attributes.uv.array[i],exact.attributes.uv.array[i]);
    exact.dispose();
  }
  g.attributes.position.array.set(positions);update.restore();assert.deepEqual(g.attributes.uv.array,uvs);
  // A buffer replacement/exact rebuild must retire the old drag updater.
  g.setAttribute('uv',g.attributes.uv.clone());assert.equal(update.update(),false);lib.dispose();
});
test('authored curved surfaces opt out of linear UV deformation', () => {
  const lib=new GeometryLibrary(THREE),g=lib.create('profile.roundedRectangle',{width:1,height:.1,depth:.1});
  assert.equal(lib.captureSurfaceUVDeformation(g),null);lib.dispose();
});
