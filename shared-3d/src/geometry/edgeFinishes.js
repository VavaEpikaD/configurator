import { applySurfaceUVs } from './surfaceUVs.js?v=1';

/** Visual radii in metres, not manufacturing/tooling instructions. No quality
 * tier is allowed to change this policy, product state or fabrication output. */
export const EDGE_FINISH_PRESETS = Object.freeze({
  'aluminium.frame': Object.freeze({ radius: 0.0012, segments: 2 }),
  'aluminium.louver': Object.freeze({ radius: 0.0006, segments: 2 }),
  'aluminium.trim': Object.freeze({ radius: 0.0004, segments: 2 }),
  'aluminium.handle': Object.freeze({ radius: 0.0006, segments: 3 }),
  'wood.deck': Object.freeze({ radius: 0.001, segments: 2 }),
});

export function getEdgeFinish(id) {
  const definition = EDGE_FINISH_PRESETS[id];
  if (!Object.hasOwn(EDGE_FINISH_PRESETS, id)) throw new Error(`Unknown edge finish: ${id}`);
  return { ...definition };
}

function positive(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive and finite.`);
  return value;
}
function detail(radius, segments) {
  if (!Number.isFinite(radius) || radius < 0) throw new RangeError('Edge radius must be finite and non-negative.');
  if (!Number.isInteger(segments) || segments < 1 || segments > 8) throw new RangeError('Edge segments must be an integer between 1 and 8.');
}
function offsetPair(value) {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite)) throw new TypeError('UV offset must contain two finite metre values.');
  return value;
}

/** A filleted RECTANGULAR SECTION extruded between exact flat end planes.
 * Unlike an all-edge rounded box, it does not shorten beams or round their end
 * cuts away from a neighbouring member. The original six AABB limits survive.
 * Side UVs unwrap by perimeter distance; smoothing never switches projection
 * mid-triangle. U follows the extrusion, V follows the section in real metres.
 */
export function createRoundedPrismGeometry(THREE, {
  width, height, depth, axis = 'auto', radius = 0.001, segments = 4, uvOffset = [0, 0],
} = {}) {
  const sizes = [positive(width, 'width'), positive(height, 'height'), positive(depth, 'depth')];
  detail(radius, segments); offsetPair(uvOffset);
  const along = axis === 'auto' ? sizes.indexOf(Math.max(...sizes)) : ['x', 'y', 'z'].indexOf(axis);
  if (along < 0) throw new TypeError(`Unknown extrusion axis: ${axis}`);
  // The cyclic local basis is right-handed: U x V = extrusion axis.
  const u = (along + 1) % 3, v = (along + 2) % 3;
  const halfU = sizes[u] / 2, halfV = sizes[v] / 2, halfLength = sizes[along] / 2;
  // Leave a substantial flat face; a finish must never turn a thin louver into
  // a capsule. Expose requested/effective radius rather than hiding the clamp.
  const r = Math.min(radius, sizes[u] * 0.2, sizes[v] * 0.2);
  if (r === 0) return new THREE.BoxGeometry(width, height, depth);

  const contour = [];
  for (const [cx, cy, start] of [
    [halfU - r, halfV - r, 0], [-halfU + r, halfV - r, Math.PI / 2],
    [-halfU + r, -halfV + r, Math.PI], [halfU - r, -halfV + r, Math.PI * 1.5],
  ]) {
    for (let step = 0; step <= segments; step++) {
      const angle = start + step / segments * Math.PI / 2;
      const nx = Math.abs(Math.cos(angle)) < 1e-14 ? 0 : Math.cos(angle);
      const ny = Math.abs(Math.sin(angle)) < 1e-14 ? 0 : Math.sin(angle);
      contour.push({ x: cx + r * nx, y: cy + r * ny, nx, ny });
    }
  }
  // Split long, sub-millimetre bevel strips before projection. Extremely thin
  // full-length triangles can lose depth precision at grazing angles on mobile
  // and software rasterizers. The budget is fixed, never a quality-tier change.
  const lengthSegments = Math.min(64, Math.max(1, Math.ceil(sizes[along] / 0.75)));
  const positions = [], normals = [], uvs = [], groups = [];
  const world = (a, b, c) => { const out = [0, 0, 0]; out[u] = a; out[v] = b; out[along] = c; return out; };
  function emit(point, z, normal, uv) {
    positions.push(...world(point.x, point.y, z)); normals.push(...normal);
    uvs.push(uv[0] + uvOffset[0], uv[1] + uvOffset[1]);
  }
  function addGroup(start, count, materialIndex) {
    const previous = groups.at(-1);
    if (previous?.materialIndex === materialIndex && previous.start + previous.count === start) previous.count += count;
    else groups.push({ start, count, materialIndex });
  }
  let perimeter = 0;
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i], b = contour[(i + 1) % contour.length];
    const nextPerimeter = perimeter + Math.hypot(b.x - a.x, b.y - a.y);
    const na = world(a.nx, a.ny, 0), nb = world(b.nx, b.ny, 0);
    const midNormal = na.map((n, j) => (n + nb[j]) / 2);
    const face = midNormal.map(Math.abs).indexOf(Math.max(...midNormal.map(Math.abs)));
    const start = positions.length / 3;
    for (let segment = 0; segment < lengthSegments; segment++) {
      const z0 = -halfLength + sizes[along] * segment / lengthSegments;
      const z1 = -halfLength + sizes[along] * (segment + 1) / lengthSegments;
      emit(a, z0, na, [z0, perimeter]);
      emit(b, z0, nb, [z0, nextPerimeter]);
      emit(b, z1, nb, [z1, nextPerimeter]);
      emit(a, z0, na, [z0, perimeter]);
      emit(b, z1, nb, [z1, nextPerimeter]);
      emit(a, z1, na, [z1, perimeter]);
    }
    addGroup(start, lengthSegments * 6, face * 2 + (midNormal[face] < 0 ? 1 : 0));
    perimeter = nextPerimeter;
  }
  for (const sign of [-1, 1]) {
    const start = positions.length / 3, n = world(0, 0, sign);
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i], b = contour[(i + 1) % contour.length];
      // Separate cap vertices keep saw-cut end normals hard and flat.
      emit({ x: 0, y: 0 }, sign * halfLength, n, [0, 0]);
      for (const p of sign > 0 ? [a, b] : [b, a]) emit(p, sign * halfLength, n, [p.x, p.y]);
    }
    addGroup(start, contour.length * 3, along * 2 + (sign < 0 ? 1 : 0));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  groups.forEach(group => geometry.addGroup(group.start, group.count, group.materialIndex));
  geometry.userData.edgeFinish = { method: 'longitudinal-radius', radius: r, requestedRadius: radius,
    segments, lengthSegments, axis: ['x', 'y', 'z'][along], boundsPreserved: true, flatEndCuts: true };
  geometry.userData.surfaceUV = { units: 'metres', grainAxis: ['x', 'y', 'z'][along], mapping: 'perimeter', preserve: true };
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

function convexContour(shape, curveSegments) {
  const points = shape.extractPoints(curveSegments).shape;
  const clean = [];
  for (const p of points) if (!clean.length || p.distanceToSquared(clean.at(-1)) > 1e-20) clean.push(p);
  if (clean.length > 1 && clean[0].distanceToSquared(clean.at(-1)) < 1e-20) clean.pop();
  let winding = 0;
  for (let i = 0; i < clean.length; i++) {
    const a = clean[i], b = clean[(i + 1) % clean.length], c = clean[(i + 2) % clean.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-14) continue;
    if (winding && winding * cross < 0) return null;
    winding = Math.sign(cross);
  }
  return clean.length >= 3 && winding ? clean : null;
}

// Smooth the small bevel rings, not an entire flat face. Cap normals stay exact;
// the analytic axial component meets them tangentially. XY creases >=45 degrees
// remain hard. Positions, groups, winding and the already-projected UVs do not move.
function smoothSolidBevelNormals(geometry, radius, depth) {
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  const sideGroups = geometry.groups.filter(group => group.materialIndex === 1);
  const atPosition = new Map();
  const key = i => [position.getX(i), position.getY(i), position.getZ(i)].map(v => Math.round(v * 1e8)).join(',');
  const xy = i => {
    const x = normal.getX(i), y = normal.getY(i), length = Math.hypot(x, y);
    return length > 1e-10 ? [x / length, y / length] : [0, 0];
  };
  for (const group of sideGroups) for (let i = group.start; i < group.start + group.count; i++) {
    const list = atPosition.get(key(i)) ?? [], n = xy(i);
    if (!list.some(p => Math.abs(p[0] - n[0]) + Math.abs(p[1] - n[1]) < 1e-6)) list.push(n);
    atPosition.set(key(i), list);
  }
  for (const group of sideGroups) for (let i = group.start; i < group.start + group.count; i++) {
    const original = xy(i), list = atPosition.get(key(i));
    let x = 0, y = 0;
    for (const n of list) if (n[0] * original[0] + n[1] * original[1] > Math.SQRT1_2) { x += n[0]; y += n[1]; }
    const length = Math.hypot(x, y);
    const z = position.getZ(i);
    const nz = z < radius ? Math.max(-1, z / radius - 1) : z > depth - radius ? Math.min(1, (z - depth) / radius + 1) : 0;
    const scale = Math.sqrt(Math.max(0, 1 - nz * nz));
    if (length > 1e-10) normal.setXYZ(i, x / length * scale, y / length * scale, nz);
    else if (Math.abs(nz) > 0.999) normal.setXYZ(i, 0, 0, Math.sign(nz));
  }
  normal.needsUpdate = true;
}

/** Inset end bevel for intentionally authored, convex SOLID handle sections.
 * CAD/machined sections, holes, path extrusions and concave outlines are not
 * eligible. Unsupported input retains its original exact un-bevelled extrusion.
 * bevelOffset=-radius keeps the widest ring on the original contour; translating
 * by radius keeps the original 0..depth end planes (Three's default expands it).
 */
export function createBeveledSolidGeometry(THREE, { shape, settings = {}, radius = 0.0006, segments = 3 } = {}) {
  if (!shape?.extractPoints || !Array.isArray(shape.holes)) throw new TypeError('A single Three.js Shape is required.');
  const depth = positive(settings.depth, 'extrusion depth');
  detail(radius, segments);
  const curveSegments = settings.curveSegments ?? 12;
  if (!Number.isInteger(curveSegments) || curveSegments < 1 || curveSegments > 256) throw new RangeError('Invalid curve segment count.');
  const exact = reason => {
    const geometry = new THREE.ExtrudeGeometry(shape, { ...settings, bevelEnabled: false });
    geometry.userData.edgeFinish = { method: 'none', reason, radius: 0, requestedRadius: radius };
    return geometry;
  };
  if (radius === 0) return exact('zero-radius');
  if (shape.holes.length || settings.extrudePath || settings.UVGenerator) return exact('protected-section');
  const points = convexContour(shape, curveSegments);
  if (!points) return exact('non-convex-section');
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const centroid = points.reduce((a, p) => ({ x: a.x + p.x / points.length, y: a.y + p.y / points.length }), { x: 0, y: 0 });
  // A disk around an interior point gives a conservative inset budget even
  // for a very thin/acute convex outline; XY bounding size alone is not enough.
  const clearance = Math.min(...points.map((a, i) => {
    const b = points[(i + 1) % points.length];
    return Math.abs((b.x - a.x) * (centroid.y - a.y) - (b.y - a.y) * (centroid.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y);
  }));
  const r = Math.min(radius, depth * 0.2, clearance * 0.25, (Math.max(...xs) - Math.min(...xs)) * 0.1, (Math.max(...ys) - Math.min(...ys)) * 0.1);
  if (!(r > 1e-8)) return exact('thin-section');
  const geometry = new THREE.ExtrudeGeometry(shape, { ...settings, depth: depth - 2 * r, bevelEnabled: true,
    bevelThickness: r, bevelSize: r, bevelOffset: -r, bevelSegments: segments });
  geometry.translate(0, 0, r);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const z = positions.getZ(i);
    if (Math.abs(z) < 1e-8) positions.setZ(i, 0);
    else if (Math.abs(z - depth) < 1e-8) positions.setZ(i, depth);
  }
  // Texture projection uses faceted normals before bevel smoothing, preventing
  // a diagonal UV jump when a smoothed normal crosses the 45-degree boundary.
  applySurfaceUVs(THREE, geometry);
  smoothSolidBevelNormals(geometry, r, depth);
  geometry.userData.edgeFinish = { method: 'inset-solid-bevel', radius: r, requestedRadius: radius,
    segments, boundsPreserved: true, originalDepth: depth };
  geometry.userData.surfaceUV.preserve = true;
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
