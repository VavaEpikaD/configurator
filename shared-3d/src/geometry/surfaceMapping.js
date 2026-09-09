/** Geometry-owned texture coordinates. One UV unit is one physical metre.
 * Material repeat = 1 / material tile size; never bake the tile size into UVs.
 * No vertex welding, triangulation, normal regeneration, material mutation or
 * runtime/world-space projection. Mapping stays attached during opening/rotation.
 */
import { applySurfaceUVs } from './surfaceUVs.js?v=1';
export const UV_MAPPING_VERSION = '20260909-uv-8';
const AXES = ['x', 'y', 'z'];
const MODES = ['box', 'extrusion', 'planar', 'cylindrical', 'authored'];
const TAU = 2 * Math.PI;
function vector(value, size, name, positive = false) {
  if (!Array.isArray(value) || value.length !== size || !value.every(v => Number.isFinite(v) && (!positive || v > 0))) {
    throw new TypeError(`${name} requires ${size} ${positive ? 'positive ' : ''}finite values.`);
  }
  return [...value];
}
export function normalizeSurfaceMapping(value) {
  if (!value || !MODES.includes(value.mode)) throw new TypeError('Unknown surface mapping mode.');
  const grainAxis = value.grainAxis;
  if (!AXES.includes(grainAxis)) throw new TypeError('Declare a local grainAxis: x, y or z (not auto).');
  const unitScale = value.unitScale ?? 1;
  if (!Number.isFinite(unitScale) || unitScale <= 0) throw new RangeError('unitScale must be positive and finite.');
  const direction = value.direction ?? 1;
  if (direction !== 1 && direction !== -1) throw new RangeError('Grain direction must be 1 or -1.');
  const result = { version: UV_MAPPING_VERSION, mode: value.mode, grainAxis, direction, unitScale,
    origin: vector(value.origin ?? [0, 0, 0], 3, 'origin'),
    scale: vector(value.scale ?? [1, 1, 1], 3, 'scale', true),
    offset: vector(value.offset ?? [0, 0], 2, 'offset') };
  if (value.mode === 'planar') {
    if (!AXES.includes(value.normalAxis) || value.normalAxis === grainAxis) throw new TypeError('A planar normalAxis must differ from grainAxis.');
    result.normalAxis = value.normalAxis;
  }
  if (value.mode === 'cylindrical') {
    if (!Number.isFinite(value.radius) || value.radius <= 0) throw new RangeError('A cylindrical mapping requires its physical source radius.');
    result.radius = value.radius;
    result.seamAngle = value.seamAngle ?? 0;
    if (!Number.isFinite(result.seamAngle)) throw new RangeError('seamAngle must be finite radians.');
    const across = [0, 1, 2].filter(i => i !== AXES.indexOf(grainAxis));
    if (Math.abs(result.scale[across[0]] - result.scale[across[1]]) > 1e-10) throw new RangeError('Elliptical scaling needs an authored unwrap, not cylindrical projection.');
  }
  return result;
}

/** Copy plain metadata, never references to the material, scene, or source array. */
export function declareSurfaceMapping(geometry, value) {
  if (!geometry?.isBufferGeometry) throw new TypeError('A BufferGeometry is required.');
  const mapping = normalizeSurfaceMapping(value);
  geometry.userData.surfaceMapping = mapping;
  return geometry;
}

export function copySurfaceMapping(source, target) {
  if (source.userData?.surfaceMapping) declareSurfaceMapping(target, source.userData.surfaceMapping);
  return target;
}

function finish(THREE, geometry, mapping, values) {
  if (!values.every(Number.isFinite)) throw new RangeError('UV coordinates exceed finite Float32 storage.');
  const previous = geometry.getAttribute('uv');
  // Reuse compatible storage after validation. No partially updated UVs on error.
  if (previous?.itemSize === 2 && previous.array?.constructor?.name === 'Float32Array' && !previous.normalized && !previous.isInterleavedBufferAttribute && previous.count * 2 === values.length) {
    previous.array.set(values); previous.needsUpdate = true;
  } else geometry.setAttribute('uv', new THREE.Float32BufferAttribute(values, 2));
  // Tangents derived from old UVs are stale. These adapters don't supply tangent
  // attributes; reject them before entry rather than corrupting imported assets.
  geometry.userData.surfaceUV = { version: UV_MAPPING_VERSION, units: 'metres', grainAxis: mapping.grainAxis,
    mapping: mapping.mode, direction: mapping.direction, offset: [...mapping.offset], unitScale: mapping.unitScale };
  declareSurfaceMapping(geometry, mapping);
  return geometry;
}

/** Explicit mapping after CAD-to-metres conversion and final cuts. Authored
 * perimeter/handle UVs bypass projection. Imported/skinned/tangent-authored
 * assets are not automatically enrolled by either configurator adapter.
 */
export function applyGeometrySurfaceUVs(THREE, geometry, specification) {
  const mapping = normalizeSurfaceMapping(specification ?? geometry.userData?.surfaceMapping);
  if (mapping.mode === 'authored') {
    if (!geometry.getAttribute('uv')) throw new Error('Authored mapping requires existing UVs.');
    declareSurfaceMapping(geometry, mapping);
    return geometry;
  }
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
  if (!position || position.itemSize !== 3) throw new TypeError('Position triples are required.');
  if (geometry.getAttribute('tangent') || Object.keys(geometry.morphAttributes ?? {}).length) {
    throw new Error('Preserve imported tangent/morph UVs or provide an explicitly authored unwrap.');
  }
  const along = AXES.indexOf(mapping.grainAxis);
  const getters = ['getX', 'getY', 'getZ'];
  const points = new Float64Array(position.count * 3);
  for (let i = 0; i < position.count; i++) for (let a = 0; a < 3; a++) {
    const value = (position[getters[a]](i) - mapping.origin[a]) * mapping.scale[a] * mapping.unitScale;
    if (!Number.isFinite(value)) throw new RangeError('Non-finite position in surface mapping.');
    points[i * 3 + a] = value;
  }
  // Preserve the established box appearance while replacing only its guessed
  // length axis. Projection copies positions into scratch storage, never CAD.
  if (mapping.mode === 'box') {
    if (!normal || normal.count !== position.count) throw new TypeError('Box projection requires matching normals.');
    const scratch = new THREE.BufferGeometry();
    try {
      scratch.setAttribute('position', new THREE.BufferAttribute(points, 3));
      scratch.setAttribute('normal', normal);
      applySurfaceUVs(THREE, scratch, { grainAxis: mapping.grainAxis, offset: [0, 0] });
      const uv = scratch.getAttribute('uv'), values = new Float32Array(position.count * 2);
      for (let i = 0; i < position.count; i++) {
        values[i * 2] = uv.getX(i) * mapping.direction + mapping.offset[0];
        values[i * 2 + 1] = uv.getY(i) + mapping.offset[1];
      }
      return finish(THREE, geometry, mapping, values);
    } finally { scratch.dispose(); }
  }
  const values = new Float32Array(position.count * 2), written = new Uint8Array(position.count);
  const assign = (i, u, v) => {
    u = u * mapping.direction + mapping.offset[0]; v += mapping.offset[1];
    if (!Number.isFinite(u) || !Number.isFinite(v)) throw new RangeError('Non-finite generated UV.');
    // A welded vertex cannot store both sides of a seam. Never silently change
    // CAD topology to fix this: the geometry author must split that seam.
    if (written[i] && (Math.abs(values[i * 2] - u) > 2e-6 || Math.abs(values[i * 2 + 1] - v) > 2e-6)) {
      throw new Error('UV seam requires separate authored vertices; geometry was not modified.');
    }
    values[i * 2] = u; values[i * 2 + 1] = v; written[i] = 1;
  };
  if (mapping.mode === 'planar') {
    const across = [0, 1, 2].find(a => a !== along && a !== AXES.indexOf(mapping.normalAxis));
    for (let i = 0; i < position.count; i++) assign(i, points[i * 3 + along], points[i * 3 + across]);
    return finish(THREE, geometry, mapping, values);
  }
  const index = geometry.index, count = index ? index.count : position.count;
  if (count % 3) throw new TypeError('Triangle geometry is required.');
  const vertex = slot => index ? index.getX(slot) : slot;
  const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const n = new THREE.Vector3(), edge = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3();
  const axis = new THREE.Vector3().setComponent(along, 1);
  const crossAxes = [(along + 1) % 3, (along + 2) % 3];
  const radius = mapping.mode === 'cylindrical' ? mapping.radius * mapping.scale[crossAxes[0]] * mapping.unitScale : 0;
  for (let slot = 0; slot < count; slot += 3) {
    const ids = [vertex(slot), vertex(slot + 1), vertex(slot + 2)];
    ids.forEach((id, j) => {
      if (!Number.isInteger(id) || id < 0 || id >= position.count) throw new RangeError('Invalid geometry index.');
      p[j].fromArray(points, id * 3);
    });
    n.subVectors(p[1], p[0]).cross(edge.subVectors(p[2], p[0]));
    if (n.lengthSq() < 1e-28) continue; // legacy cut degenerates have no visible area
    n.normalize();
    if (mapping.mode === 'cylindrical' && Math.abs(n.getComponent(along)) < .9999) {
      // Cyclic cross axes: for a Y cylinder atan2(X,Z), matching Three's ring.
      const angles = p.map(point => {
        const radialDistance = Math.hypot(point.getComponent(crossAxes[0]), point.getComponent(crossAxes[1]));
        if (Math.abs(radialDistance - radius) > Math.max(1e-7, radius * 1e-5)) throw new RangeError('Cylindrical UVs require an undeformed constant-radius wall; use an authored unwrap for a taper.');
        let theta = Math.atan2(point.getComponent(crossAxes[1]), point.getComponent(crossAxes[0])) - mapping.seamAngle;
        theta = ((theta % TAU) + TAU) % TAU;
        if (theta < 1e-7 || TAU - theta < 1e-7) theta = 0;
        return theta;
      });
      if (Math.max(...angles) - Math.min(...angles) > Math.PI) {
        for (let j = 0; j < 3; j++) if (angles[j] < Math.PI) angles[j] += TAU;
      }
      ids.forEach((id, j) => assign(id, p[j].getComponent(along), angles[j] * radius));
    } else {
      // Flat per-face basis, independent of interpolated shading normals. On
      // extrusion walls U is the declared member length even for a short filler;
      // V is true cross-section distance, not a foreshortened XYZ projection.
      const wall = Math.abs(n.getComponent(along)) < 1e-4;
      if (wall) u.copy(axis);
      else {
        u.set(0, 0, 0).setComponent(crossAxes[0], 1);
        u.addScaledVector(n, -u.dot(n));
        if (u.lengthSq() < 1e-12) { u.set(0, 0, 0).setComponent(crossAxes[1], 1); u.addScaledVector(n, -u.dot(n)); }
        u.normalize();
      }
      v.crossVectors(n, u).normalize();
      ids.forEach((id, j) => assign(id, p[j].dot(u), p[j].dot(v)));
    }
  }
  return finish(THREE, geometry, mapping, values);
}
