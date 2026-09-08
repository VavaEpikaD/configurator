import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { GeometryLibrary, MaterialLibrary, createRoundedPrismGeometry, createBeveledSolidGeometry,
  getEdgeFinish, createRoundedRectangleShape } from '../src/index.js';
import { createSurfacePixels } from '../src/materials/SurfaceTextures.js';
const THREE = await import(process.env.SURFACE_THREE_MODULE ? pathToFileURL(process.env.SURFACE_THREE_MODULE).href
  : new URL('../../window-configurator/src/client/lib/three.module.js', import.meta.url).href);
const close = (a, b, message = '') => assert.ok(Math.abs(a - b) < 2e-7, `${message}: ${a} != ${b}`);
function checkGeometry(geometry) {
  for (const attribute of Object.values(geometry.attributes)) assert.ok([...attribute.array].every(Number.isFinite));
  const n = geometry.attributes.normal;
  for (let i = 0; i < n.count; i++) close(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)), 1, 'unit normal');
  const p = geometry.attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    const cross = b.sub(a).cross(c.sub(a));
    assert.ok(cross.lengthSq() > 1e-26, 'No degenerate triangles.');
    normal.fromBufferAttribute(n, i);
    assert.ok(cross.dot(normal) > 0, 'Outward winding agrees with vertex normals.');
  }
}
function shape(points) {
  const s = new THREE.Shape(); s.moveTo(...points[0]); points.slice(1).forEach(p => s.lineTo(...p)); s.closePath(); return s;
}

for (const axis of ['x', 'y', 'z', 'auto']) test(`rounded member preserves exact bounding dimensions and flat cuts: ${axis}`, () => {
  const dimensions = { width: 3.5, height: 0.19, depth: 0.155 };
  const geometry = createRoundedPrismGeometry(THREE, { ...dimensions, axis, ...getEdgeFinish('aluminium.frame') });
  const actualAxis = geometry.userData.edgeFinish.axis;
  const side = ['x', 'y', 'z'].indexOf(actualAxis), size = Object.values(dimensions);
  for (let i = 0; i < 3; i++) { close(geometry.boundingBox.min.getComponent(i), -size[i] / 2); close(geometry.boundingBox.max.getComponent(i), size[i] / 2); }
  const p = geometry.attributes.position, n = geometry.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    assert.ok(Math.abs(p.getComponent(i, side)) <= size[side] / 2 + 1e-7, 'No extended bevel layer.');
    if (Math.abs(n.getComponent(i, side)) > 0.9) {
      close(Math.abs(n.getComponent(i, side)), 1, 'cap is flat');
      close(Math.abs(p.getComponent(i, side)), size[side] / 2, 'The end cut is not shortened.');
    }
  }
  checkGeometry(geometry);
  assert.equal(geometry.userData.surfaceUV.grainAxis, actualAxis);
  assert.equal(geometry.userData.surfaceUV.preserve, true);
  geometry.dispose();
});

test('rounded members are watertight and all triangles retain a valid original box-face material slot', () => {
  const geometry = createRoundedPrismGeometry(THREE, { width: 0.15, height: 2.7, depth: 0.15, axis: 'y' });
  const p = geometry.attributes.position, edges = new Map();
  const key = i => [p.getX(i), p.getY(i), p.getZ(i)].map(x => Math.round(x * 1e7)).join(',');
  for (let i = 0; i < p.count; i += 3) for (const [a, b] of [[i, i + 1], [i + 1, i + 2], [i + 2, i]]) {
    const id = [key(a), key(b)].sort().join('|'); edges.set(id, (edges.get(id) ?? 0) + 1);
  }
  assert.ok([...edges.values()].every(count => count === 2));
  assert.equal(geometry.groups.reduce((sum, group) => sum + group.count, 0), p.count);
  assert.ok(geometry.groups.every(group => group.materialIndex >= 0 && group.materialIndex <= 5));
  geometry.dispose();
});

test('perimeter UVs are continuous across bevel triangles and scale in metres along the member', () => {
  const geometry = createRoundedPrismGeometry(THREE, { width: 5, height: 0.2, depth: 0.15, axis: 'x', uvOffset: [0.25, 0.6] });
  const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
  let sideVertices = 0;
  for (let i = 0; i < p.count; i++) if (Math.abs(n.getX(i)) < 0.1) {
    close(uv.getX(i), p.getX(i) + 0.25, 'U follows member length'); sideVertices++;
  }
  // Each six-vertex strip shares the same values along its triangulation seam.
  for (let i = 0; i < sideVertices; i += 6) {
    close(uv.getX(i), uv.getX(i + 3)); close(uv.getY(i), uv.getY(i + 3));
    close(uv.getX(i + 2), uv.getX(i + 4)); close(uv.getY(i + 2), uv.getY(i + 4));
  }
  geometry.dispose();
});

test('thin members clamp the radius and invalid settings fail before allocating a buffer', () => {
  const geometry = createRoundedPrismGeometry(THREE, { width: 1, height: 0.001, depth: 0.002, radius: 1, axis: 'x' });
  assert.equal(geometry.userData.edgeFinish.radius, 0.0002); checkGeometry(geometry); geometry.dispose();
  for (const override of [{ width: -1 }, { height: NaN }, { depth: Infinity }, { radius: -1 }, { radius: NaN }, { axis: 'banana' }, { segments: 99 }, { uvOffset: [Infinity, 0] }]) {
    assert.throws(() => createRoundedPrismGeometry(THREE, { width: 1, height: 1, depth: 1, ...override }));
  }
  assert.throws(() => getEdgeFinish('__proto__'));
});

test('inset handle bevel retains the source outline, end planes and caller shape/settings', () => {
  const section = createRoundedRectangleShape(THREE, 0.04, 0.1, 0.02);
  const settings = { depth: 0.005, bevelEnabled: false, curveSegments: 20 };
  const before = JSON.stringify(section.toJSON()), original = new THREE.ExtrudeGeometry(section, settings);
  original.computeBoundingBox();
  const geometry = createBeveledSolidGeometry(THREE, { shape: section, settings, ...getEdgeFinish('aluminium.handle') });
  assert.equal(geometry.userData.edgeFinish.method, 'inset-solid-bevel');
  assert.equal(JSON.stringify(section.toJSON()), before); assert.equal(settings.depth, 0.005);
  for (let i = 0; i < 3; i++) { close(geometry.boundingBox.min.getComponent(i), original.boundingBox.min.getComponent(i)); close(geometry.boundingBox.max.getComponent(i), original.boundingBox.max.getComponent(i)); }
  assert.equal(geometry.boundingBox.min.z, 0);
  checkGeometry(geometry); assert.equal(geometry.userData.surfaceUV.preserve, true);
  geometry.dispose(); original.dispose();
});

test('machined, holed or concave solids fall back to exact geometry instead of unsafe offsets', () => {
  const sections = [shape([[0,0],[1,0],[1,1],[0.5,0.4],[0,1]]), shape([[0,0],[1,0],[1,1],[0,1]])];
  sections[1].holes.push(new THREE.Path([new THREE.Vector2(.2,.2),new THREE.Vector2(.4,.2),new THREE.Vector2(.4,.4),new THREE.Vector2(.2,.4)]));
  for (const section of sections) {
    const original = new THREE.ExtrudeGeometry(section, { depth: .1, bevelEnabled: false });
    const geometry = createBeveledSolidGeometry(THREE, { shape: section, settings: { depth: .1 } });
    assert.equal(geometry.userData.edgeFinish.method, 'none');
    assert.deepEqual(geometry.attributes.position.array, original.attributes.position.array);
    geometry.dispose(); original.dispose();
  }
});

test('edge registry retains resource ownership and rejects CAD source units', () => {
  const library = new GeometryLibrary(THREE);
  assert.throws(() => library.create('profile.roundedRectangle', { width: 100, height: 100, depth: 100 }, { units: 'source' }));
  const source = library.create('profile.roundedRectangle', { width: 1, height: .1, depth: .1 });
  const copy = library.clone(source);
  assert.notEqual(source.attributes.position.array, copy.attributes.position.array);
  assert.equal(library.getDiagnostics().edgeFinishes['longitudinal-radius'], 2);
  source.dispose(); copy.dispose(); assert.equal(library.getDiagnostics().geometryCount, 0); library.dispose();
});

test('powder-coat detail diagnostics distinguish texture assignment from Low-quality suppression', () => {
  const library = new MaterialLibrary(THREE), material = library.create('aluminium.powderCoated', { color: '#383e42' });
  let diagnostics = library.getDiagnostics();
  assert.equal(diagnostics.surfaceDetailEnabled, true);
  assert.equal(diagnostics.surfaceDetails['aluminium.powderCoated'].normalMapped, 1);
  assert.deepEqual(diagnostics.surfaceDetails['aluminium.powderCoated'].tileMetres, [.035, .035]);
  assert.ok(material.normalScale.x > .1 && material.normalScale.x < .2); assert.equal(material.map, null, 'There is no fake colour/dirt overlay.');
  const maps = [material.normalMap, material.roughnessMap];
  library.setQuality('low'); diagnostics = library.getDiagnostics();
  assert.equal(diagnostics.surfaceDetailEnabled, false);
  assert.equal(diagnostics.surfaceDetails['aluminium.powderCoated'].normalMapped, 0);
  library.setQuality('high'); assert.equal(material.normalMap, maps[0]); assert.equal(material.roughnessMap, maps[1]);
  assert.equal(material.color.getHexString(), '383e42'); library.dispose();
});

test('powder maps contain deterministic broader-scale variation, not just single-pixel noise', () => {
  const pixels = createSurfacePixels('powder', 256), other = createSurfacePixels('powder', 256);
  assert.deepEqual(pixels.normal, other.normal); assert.equal(pixels.color, null);
  const blocks = [];
  for (let y = 0; y < 256; y += 16) for (let x = 0; x < 256; x += 16) {
    let sum = 0;
    for (let j = y; j < y + 16; j++) for (let i = x; i < x + 16; i++) sum += pixels.roughness[(j * 256 + i) * 4 + 1];
    blocks.push(sum / 256);
  }
  const spread = Math.max(...blocks) - Math.min(...blocks);
  assert.ok(spread > 1);
  assert.ok(spread < 20);
});
