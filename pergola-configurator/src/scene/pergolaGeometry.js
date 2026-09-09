import * as THREE from 'three';
import { GeometryLibrary, getEdgeFinish } from '../../../shared-3d/src/index.js?v=8';

/** Pergola-specific mesh policy; all primitive generation lives in shared-3d. */
export function createPergolaGeometry(library = null) {
  const geometry = library ?? new GeometryLibrary(THREE);
  const surfaceUV = material => (Array.isArray(material) ? material : [material])
    .some(entry => entry?.userData?.surface) ? {} : false;
  const mesh = (source, material, options = {}) => geometry.mesh(source, material, {
    uv: source.userData.surfaceUV?.preserve ? false : surfaceUV(material), castShadow: true, receiveShadow: true, ...options,
  });
  return {
    library: geometry,
    mesh,
    box(width, height, depth, material, options = {}) {
      const { edgeFinish = null, axis = 'auto', ...meshOptions } = options;
      const grainAxis = axis === 'auto' ? ['x', 'y', 'z'][[width, height, depth].indexOf(Math.max(width, height, depth))] : axis;
      const source = edgeFinish
        ? geometry.create('profile.roundedRectangle', { width, height, depth, axis, ...getEdgeFinish(edgeFinish) })
        : geometry.create('primitive.box', { width, height, depth });
      return mesh(source, material, {
        ...(source.userData.surfaceUV?.preserve ? {} : { mapping: { mode: 'box', grainAxis } }), ...meshOptions,
      });
    },
    cylinder(radius, height, material, radialSegments = 20) {
      return mesh(geometry.create('primitive.cylinder', { radius, height, radialSegments }), material, {
        mapping: { mode: 'cylindrical', grainAxis: 'y', radius },
      });
    },
    panel(width, height, thickness, material, options = {}) {
      return mesh(geometry.create('panel.rectangular', { width, height, thickness }), material, {
        castShadow: false, role: 'glazing', ...options,
      });
    },
    // Deck UVs are finalized in real metres, with U along each plank. No mesh
    // scaling is used to stretch a fixed-size wood texture across the platform.
    boardGeometry(width, height, depth, uv = {}, { edgeFinish = true } = {}) {
      const source = edgeFinish
        ? geometry.create('profile.roundedRectangle', { width, height, depth, axis: 'x',
          ...getEdgeFinish('wood.deck'), uvOffset: uv.offset ?? [0, 0] })
        : geometry.create('primitive.box', { width, height, depth });
      return geometry.prepare(source, {
        ...(source.userData.surfaceUV?.preserve ? {} : { mapping: { mode: 'box', grainAxis: 'x', ...uv } }),
        uv: source.userData.surfaceUV?.preserve ? false : true,
      });
    },
  };
}
