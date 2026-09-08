import { applySurfaceUVs } from './surfaceUVs.js?v=1';
import { splitPositionGeometryAtScalarZero, clipPositionGeometryToScalarHalfspace } from './scalarGeometry.js?v=2';

import { createRoundedPrismGeometry, createBeveledSolidGeometry } from './edgeFinishes.js?v=3';

export const GEOMETRY_SYSTEM_VERSION = '20260908-edges-3';

function positive(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number.`);
  }
  return value;
}
function segments(value, fallback, name) {
  const result = value ?? fallback;
  if (!Number.isInteger(result) || result < 1 || result > 4096) {
    throw new RangeError(`${name} must be an integer between 1 and 4096.`);
  }
  return result;
}

const BOX_SLOTS = Object.freeze({ positiveX: 0, negativeX: 1, positiveY: 2, negativeY: 3, positiveZ: 4, negativeZ: 5 });

/**
 * Engine-injected manufactured-geometry foundation. No scene, product catalog,
 * DOM, material, renderer or quality setting is imported here.
 *
 * Dimensions are metres unless a caller explicitly creates a source-space CAD
 * template. Every create/clone result is independent and caller-mutable. There
 * is deliberately no implicit geometry cache: resizing one profile must not
 * change another, and Window's existing mesh/storage pool remains authoritative.
 */
export class GeometryLibrary {
  constructor(THREE, { edgeDetails = true } = {}) {
    if (!THREE?.BufferGeometry || !THREE?.Mesh || !THREE?.ExtrudeGeometry) {
      throw new TypeError('The host Three.js namespace is required.');
    }
    this.THREE = THREE;
    // Explicit acceptance-test/rollback switch, never coupled to visual quality.
    this.edgeDetails = edgeDetails !== false;
    this.builders = new Map();
    this.geometries = new Set();
    this.disposed = false;
    this.registeredCount = 0;

    this.register('primitive.box', p => new THREE.BoxGeometry(
      positive(p.width, 'width'), positive(p.height, 'height'), positive(p.depth, 'depth'),
      segments(p.widthSegments, 1, 'widthSegments'), segments(p.heightSegments, 1, 'heightSegments'),
      segments(p.depthSegments, 1, 'depthSegments'),
    ), BOX_SLOTS);
    this.register('profile.roundedRectangle', p => this.edgeDetails
      ? createRoundedPrismGeometry(THREE, p)
      : new THREE.BoxGeometry(positive(p.width, 'width'), positive(p.height, 'height'), positive(p.depth, 'depth')), BOX_SLOTS);
    this.register('profile.beveledSolid', p => this.edgeDetails
      ? createBeveledSolidGeometry(THREE, p)
      : new THREE.ExtrudeGeometry(p.shape, { ...p.settings, bevelEnabled: false }), { caps: 0, walls: 1 });
    this.register('panel.rectangular', p => new THREE.BoxGeometry(
      positive(p.width, 'width'), positive(p.height, 'height'), positive(p.thickness, 'thickness'),
    ), BOX_SLOTS);
    this.register('primitive.plane', p => new THREE.PlaneGeometry(
      positive(p.width, 'width'), positive(p.height, 'height'),
      segments(p.widthSegments, 1, 'widthSegments'), segments(p.heightSegments, 1, 'heightSegments'),
    ), { surface: 0 });
    this.register('primitive.cylinder', p => {
      const top = p.radiusTop ?? p.radius;
      const bottom = p.radiusBottom ?? p.radius;
      if (![top, bottom].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0) || top + bottom <= 0) {
        throw new RangeError('Cylinder radii must be finite, non-negative and not both zero.');
      }
      const radial = segments(p.radialSegments, 20, 'radialSegments');
      if (radial < 3) throw new RangeError('radialSegments must be at least 3.');
      return new THREE.CylinderGeometry(top, bottom, positive(p.height, 'height'), radial,
        segments(p.heightSegments, 1, 'heightSegments'), p.openEnded ?? false);
    }, { wall: 0, top: 1, bottom: 2 });
    this.register('profile.extrusion', p => {
      const shapes = Array.isArray(p.shape) ? p.shape : [p.shape];
      if (!shapes.length || !shapes.every(shape => typeof shape?.extractPoints === 'function' && Array.isArray(shape.holes))) {
        throw new TypeError('profile.extrusion requires a Three.js Shape or non-empty Shape array.');
      }
      const settings = { ...p.settings };
      positive(settings.depth, 'extrusion depth');
      settings.bevelEnabled ??= false;
      settings.curveSegments = segments(settings.curveSegments, 8, 'curveSegments');
      settings.steps = segments(settings.steps, 1, 'steps');
      // No implicit bevel, simplification, centering or unit conversion. In
      // particular, a CAD source may mix mm cross-sections and unit-depth Z.
      return new THREE.ExtrudeGeometry(p.shape, settings);
    }, { caps: 0, walls: 1 });
  }

  assertActive() {
    if (this.disposed) throw new Error('GeometryLibrary has been disposed.');
  }

  /** Register a host-engine builder once, without overwriting existing types. */
  register(id, builder, materialSlots = {}) {
    this.assertActive();
    if (typeof id !== 'string' || !id.trim() || typeof builder !== 'function') {
      throw new TypeError('A non-empty geometry ID and builder function are required.');
    }
    if (this.builders.has(id)) throw new Error(`Geometry type already registered: ${id}`);
    for (const value of Object.values(materialSlots)) {
      if (!Number.isInteger(value) || value < 0) throw new TypeError('Material slot indices must be non-negative integers.');
    }
    this.builders.set(id, { builder, materialSlots: { ...materialSlots } });
    return this;
  }

  /** Own the resource lifetime, not its transforms or material. Never clone implicitly. */
  adopt(geometry, { kind, units, materialSlots } = {}) {
    this.assertActive();
    if (!geometry?.isBufferGeometry) throw new TypeError('A BufferGeometry is required.');
    const previous = geometry.userData.sharedGeometry ?? {};
    geometry.userData.sharedGeometry = {
      ...previous,
      version: GEOMETRY_SYSTEM_VERSION,
      kind: kind ?? previous.kind ?? 'custom.buffer',
      units: units ?? previous.units ?? 'metres',
      materialSlots: { ...(materialSlots ?? previous.materialSlots ?? {}) },
    };
    if (!this.geometries.has(geometry)) {
      this.geometries.add(geometry);
      this.registeredCount += 1;
      const onDispose = () => {
        this.geometries.delete(geometry);
        geometry.removeEventListener('dispose', onDispose);
      };
      geometry.addEventListener('dispose', onDispose);
    }
    return geometry;
  }

  create(id, parameters = {}, { units = 'metres' } = {}) {
    this.assertActive();
    if (!['metres', 'source'].includes(units)) throw new TypeError('Geometry units must be metres or source.');
    if (units !== 'metres' && ['profile.roundedRectangle', 'profile.beveledSolid'].includes(id)) {
      throw new Error('Visual edge finishes require metre-authored geometry, never CAD source templates.');
    }
    const entry = this.builders.get(id);
    if (!entry) throw new Error(`Unknown geometry type: ${id}`);
    return this.adopt(entry.builder(parameters, this.THREE), { kind: id, units, materialSlots: entry.materialSlots });
  }

  clone(geometry) {
    this.assertActive();
    if (!geometry?.isBufferGeometry) throw new TypeError('A BufferGeometry is required.');
    return this.adopt(geometry.clone());
  }

  /**
   * Finalize AFTER the adapter's CAD transform/cuts. UV projection never changes
   * vertices or normals. Recompute normals only when explicitly requested, so
   * hard CAD edges and authored smoothing remain intact.
   */
  prepare(geometry, { uv = false, normals = 'preserve', normalizeNormals = false, units = 'metres' } = {}) {
    this.assertActive();
    if (!geometry?.isBufferGeometry) throw new TypeError('A BufferGeometry is required.');
    if (!['preserve', 'recompute'].includes(normals)) throw new TypeError('Unknown normal policy.');
    if (!['metres', 'source'].includes(units)) throw new TypeError('Geometry units must be metres or source.');
    if (units === 'source' && uv) throw new Error('Transform source-space CAD into metres before surface UV mapping.');
    this.adopt(geometry, { units });
    if (normals === 'recompute') {
      geometry.deleteAttribute('normal');
      geometry.computeVertexNormals();
    }
    if (normalizeNormals) geometry.normalizeNormals();
    if (uv) applySurfaceUVs(this.THREE, geometry, uv === true ? {} : uv);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  /** The injected Mesh constructor preserves Window's existing reuse adapter. */
  mesh(geometry, material, { uv = false, castShadow = false, receiveShadow = false, name = '', role = null } = {}) {
    this.prepare(geometry, { uv });
    const mesh = new this.THREE.Mesh(geometry, material);
    // Window may return a pooled Mesh and dispose the candidate geometry during
    // construction. Track the ACTUAL surviving buffer rather than the candidate.
    this.adopt(mesh.geometry);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    if (name) mesh.name = name;
    if (role) mesh.userData.geometryRole = role;
    return mesh;
  }

  // Explicitly position-only intermediate operations. They do not pretend to be
  // general solid booleans: cuts are uncapped and normals/UVs must be finalized.
  splitAtScalarZero(geometry, resolver) {
    this.assertActive();
    const result = splitPositionGeometryAtScalarZero(this.THREE, geometry, resolver);
    return this.adopt(result, { kind: 'profile.split', units: geometry.userData.sharedGeometry?.units ?? 'source' });
  }
  clipToScalarHalfspace(geometry, resolver) {
    this.assertActive();
    const result = clipPositionGeometryToScalarHalfspace(this.THREE, geometry, resolver);
    return this.adopt(result, { kind: 'profile.clip', units: geometry.userData.sharedGeometry?.units ?? 'source' });
  }

  getDiagnostics() {
    const activeTypes = {}, edgeFinishes = {};
    for (const geometry of this.geometries) {
      const id = geometry.userData.sharedGeometry?.kind ?? 'custom.buffer';
      activeTypes[id] = (activeTypes[id] ?? 0) + 1;
      const method = geometry.userData.edgeFinish?.method;
      if (method) edgeFinishes[method] = (edgeFinishes[method] ?? 0) + 1;
    }
    return { version: GEOMETRY_SYSTEM_VERSION, geometryCount: this.geometries.size,
      registeredCount: this.registeredCount, activeTypes, edgeDetails: this.edgeDetails, edgeFinishes, registeredTypes: [...this.builders.keys()] };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const geometry of [...this.geometries]) geometry.dispose();
    this.geometries.clear();
    this.builders.clear();
  }
}
