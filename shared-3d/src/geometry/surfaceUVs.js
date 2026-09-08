/**
 * Physical-size projection for manufactured profiles. Only UVs change: never
 * positions, indices, normals, CAD dimensions, mating clearances, or topology.
 * Call after deforming a profile, before making/sharing the mesh. Coordinates
 * must be in metres; use unitScale for imported millimetre geometry.
 */
export function applySurfaceUVs(THREE, geometry, { grainAxis = 'auto', unitScale = 1, offset = [0, 0] } = {}) {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  if (!position || !normal) return geometry;
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const size = [bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z];
  const along = grainAxis === 'auto'
    ? size.indexOf(Math.max(...size))
    : ['x', 'y', 'z'].indexOf(grainAxis);
  if (along < 0) throw new Error(`Unknown grain axis: ${grainAxis}`);
  if (!(unitScale > 0) || !Number.isFinite(unitScale)) throw new Error('unitScale must be a positive finite number.');
  const uv = geometry.getAttribute('uv') ?? new THREE.BufferAttribute(new Float32Array(position.count * 2), 2);
  const components = ['getX', 'getY', 'getZ'];
  for (let i = 0; i < position.count; i += 1) {
    const n = components.map(get => Math.abs(normal[get](i)));
    const faceNormal = n.indexOf(Math.max(...n));
    const uAxis = faceNormal === along ? (along + 1) % 3 : along;
    const vAxis = [0, 1, 2].find(axis => axis !== faceNormal && axis !== uAxis);
    uv.setXY(i, position[components[uAxis]](i) * unitScale + offset[0], position[components[vAxis]](i) * unitScale + offset[1]);
  }
  geometry.setAttribute('uv', uv);
  uv.needsUpdate = true;
  geometry.userData.surfaceUV = { units: 'metres', grainAxis: ['x', 'y', 'z'][along] };
  return geometry;
}
