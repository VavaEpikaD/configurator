import { MATERIAL_PRESETS } from './presets.js?v=1';
import { SurfaceTextures } from './SurfaceTextures.js?v=1';
import { getQualityProfile, normalizeQuality } from '../quality.js?v=1';

/** One library per scene. Materials are owned by callers; texture maps by the library. */
export class MaterialLibrary {
  constructor(THREE, { quality = 'balanced', maxAnisotropy = 8 } = {}) {
    if (!THREE?.MeshStandardMaterial) throw new TypeError('Pass the configurator\'s Three.js namespace.');
    this.THREE = THREE;
    this.quality = normalizeQuality(quality);
    this.maxAnisotropy = Math.max(1, maxAnisotropy);
    this.presets = new Map(Object.entries(MATERIAL_PRESETS));
    this.textures = new SurfaceTextures(THREE);
    this.materials = new Map();
    this.environmentIntensity = 1;
    this.disposed = false;
  }
  register(id, definition) {
    if (this.disposed) throw new Error('Material library has been disposed.');
    if (!id || this.presets.has(id)) throw new Error(`Material ID already exists or is invalid: ${id}`);
    if (!['standard', 'glass'].includes(definition?.type)) throw new Error('Material type must be standard or glass.');
    this.presets.set(id, Object.freeze({
      ...definition,
      ...(definition.tile ? { tile: Object.freeze([...definition.tile]) } : {}),
    }));
    return this;
  }
  create(id, options = {}) {
    if (this.disposed) throw new Error('Material library has been disposed.');
    const definition = this.presets.get(id);
    if (!definition) throw new Error(`Unknown surface material: ${id}`);
    const THREE = this.THREE;
    const material = definition.type === 'glass'
      ? new THREE.MeshPhysicalMaterial()
      : new THREE.MeshStandardMaterial();
    material.name = `360:${id}`;
    material.color.set(options.color ?? definition.color ?? '#ffffff');
    material.metalness = options.metalness ?? definition.metalness ?? 0;
    material.roughness = options.roughness ?? definition.roughness ?? 0.7;
    material.side = options.side ?? THREE.FrontSide;
    material.userData.surface = { id, version: 1, uvUnits: 'metres', grainAxis: 'u' };
    this.track(material, id, { ...options });
    try {
      this.apply(material);
      return material;
    } catch (error) {
      material.dispose();
      throw error;
    }
  }
  track(material, id, options) {
    const onDispose = () => {
      material.removeEventListener('dispose', onDispose);
      this.materials.delete(material);
    };
    material.addEventListener('dispose', onDispose);
    this.materials.set(material, { id, options });
  }
  // Use instead of material.clone() for managed variants: keeps tier changes/disposal wired.
  clone(material) {
    const entry = this.materials.get(material);
    if (!entry) return material.clone();
    const clone = material.clone();
    this.track(clone, entry.id, { ...entry.options });
    try {
      this.apply(clone);
      return clone;
    } catch (error) {
      clone.dispose();
      throw error;
    }
  }
  apply(material) {
    const { id, options } = this.materials.get(material);
    const definition = this.presets.get(id);
    const profile = getQualityProfile(this.quality);
    const previousFeatures = `${!!material.normalMap}:${!!material.roughnessMap}:${!!material.map}:${material.transmission > 0}:${material.transparent}`;
    material.envMapIntensity = (options.envMapIntensity ?? 1) * this.environmentIntensity;
    if (definition.type === 'glass') {
      material.ior = definition.ior ?? 1.5;
      material.transmission = profile.transmission ? definition.transmission : 0;
      material.thickness = profile.transmission ? (options.thickness ?? definition.thickness ?? 0) : 0;
      material.attenuationColor.set('#ecf6f2');
      material.attenuationDistance = 2;
      material.transparent = !profile.transmission;
      material.opacity = profile.transmission ? 1 : 0.18;
      // Closed glazing is front-sided. Avoid opaque depth/shadow behavior for overlapping panes.
      material.depthWrite = false;
    } else if (definition.texture) {
      // Wood retains its colour map even on Low; microscopic maps can be switched off.
      const maps = (profile.surfaceDetail || definition.texture === 'oak')
        ? this.textures.get(definition.texture, definition.tile) : {};
      material.map = maps.color ?? null;
      material.normalMap = profile.surfaceDetail ? (maps.normal ?? null) : null;
      material.roughnessMap = profile.surfaceDetail ? (maps.roughness ?? null) : null;
      material.normalScale.setScalar(definition.normalStrength ?? 0.1);
      this.textures.setAnisotropy(Math.min(this.maxAnisotropy, profile.anisotropy));
    }
    const nextFeatures = `${!!material.normalMap}:${!!material.roughnessMap}:${!!material.map}:${material.transmission > 0}:${material.transparent}`;
    if (previousFeatures !== nextFeatures) material.needsUpdate = true;
  }
  setQuality(value) {
    const next = normalizeQuality(value);
    if (this.quality === next) return false;
    this.quality = next;
    for (const material of this.materials.keys()) this.apply(material);
    return true;
  }
  setEnvironmentIntensity(value) {
    this.environmentIntensity = Math.max(0, Number(value) || 0);
    for (const [material, { options }] of this.materials) {
      material.envMapIntensity = (options.envMapIntensity ?? 1) * this.environmentIntensity;
    }
  }
  getDiagnostics() {
    const activeMaterials = {};
    for (const { id } of this.materials.values()) activeMaterials[id] = (activeMaterials[id] || 0) + 1;
    return { quality: this.quality, materialCount: this.materials.size, textureCount: this.textures.size, availableMaterials: [...this.presets.keys()], activeMaterials };
  }
  dispose() {
    for (const material of [...this.materials.keys()]) material.dispose();
    this.textures.dispose();
    this.disposed = true;
  }
}
