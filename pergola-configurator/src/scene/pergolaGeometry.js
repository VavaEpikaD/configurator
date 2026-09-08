import * as THREE from 'three';
import { GeometryLibrary } from '../../../shared-3d/src/index.js?v=2';

/** Pergola-specific mesh policy; all primitive generation lives in shared-3d. */
export function createPergolaGeometry(library = null) {
  const geometry = library ?? new GeometryLibrary(THREE);
  const surfaceUV = material => (Array.isArray(material) ? material : [material])
    .some(entry => entry?.userData?.surface) ? {} : false;
  const mesh = (source, material, options = {}) => geometry.mesh(source, material, {
    uv: surfaceUV(material), castShadow: true, receiveShadow: true, ...options,
  });
  return {
    library: geometry,
    mesh,
    box(width, height, depth, material, options = {}) {
      return mesh(geometry.create('primitive.box', { width, height, depth }), material, options);
    },
    cylinder(radius, height, material, radialSegments = 20) {
      return mesh(geometry.create('primitive.cylinder', { radius, height, radialSegments }), material);
    },
    panel(width, height, thickness, material, options = {}) {
      return mesh(geometry.create('panel.rectangular', { width, height, thickness }), material, {
        castShadow: false, role: 'glazing', ...options,
      });
    },
    // Deck UVs are finalized in real metres, with U along each plank. No mesh
    // scaling is used to stretch a fixed-size wood texture across the platform.
    boardGeometry(width, height, depth, uv = {}) {
      return geometry.prepare(geometry.create('primitive.box', { width, height, depth }), {
        uv: { grainAxis: 'x', ...uv },
      });
    },
  };
}
