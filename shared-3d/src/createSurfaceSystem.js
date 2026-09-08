import { MaterialLibrary } from './materials/MaterialLibrary.js?v=1';
import { NeutralEnvironment } from './environment/NeutralEnvironment.js?v=1';
import { getQualityProfile, normalizeQuality } from './quality.js?v=1';

export const SURFACE_SYSTEM_VERSION = '20260908-materials-1';

/** No renderer is created here. The host retains its camera, controls, scene and lifetime. */
export function createSurfaceSystem(THREE, { renderer, scene, shadowLights = [], quality = 'balanced', capture = false } = {}) {
  if (!renderer || !scene) throw new TypeError('A renderer and scene are required.');
  const library = new MaterialLibrary(THREE, {
    quality: capture ? 'low' : quality,
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
  });
  const environment = new NeutralEnvironment(THREE, renderer, scene);
  let currentSignature = '', currentProfile = null, disposed = false, environmentError = null;
  const legacyEnvironmentStrength = new WeakMap();
  let requestedQuality = normalizeQuality(quality);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.dataset.surfaceSystem = SURFACE_SYSTEM_VERSION;

  const controller = {
    materials: library,
    setQuality(value, { compact = false, devicePixelRatio = globalThis.devicePixelRatio || 1 } = {}) {
      if (disposed) return false;
      requestedQuality = normalizeQuality(value);
      const profile = getQualityProfile(value, { devicePixelRatio, compact, capture });
      const signature = JSON.stringify(profile);
      if (signature === currentSignature && !environmentError) return false;
      currentSignature = signature;
      currentProfile = profile;
      const shadowsChanged = renderer.shadowMap.enabled !== profile.shadows;
      renderer.setPixelRatio(profile.pixelRatio);
      renderer.shadowMap.enabled = profile.shadows;
      for (const light of shadowLights) {
        light.castShadow = profile.shadows;
        if (light.shadow.mapSize.x !== profile.shadowSize || light.shadow.mapSize.y !== profile.shadowSize) {
          light.shadow.map?.dispose();
          light.shadow.map = null;
          light.shadow.mapPass?.dispose?.();
          if ('mapPass' in light.shadow) light.shadow.mapPass = null;
          light.shadow.mapSize.set(profile.shadowSize, profile.shadowSize);
        }
        light.shadow.needsUpdate = true;
      }
      // r160 receivers need their shader variants refreshed when shadows are toggled.
      if (shadowsChanged) scene.traverse(object => {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) if (material) material.needsUpdate = true;
      });
      library.setQuality(profile.quality);
      try {
        environment.setQuality(profile);
        environmentError = null;
      } catch (error) {
        // Keep the previous probe (if any); a reflection allocation failure must
        // not make the whole configurator unusable on a constrained GPU.
        environmentError = error?.message || String(error);
        console.warn('Shared 3D reflection environment could not be updated.', error);
      }
      renderer.shadowMap.needsUpdate = true;
      renderer.domElement.dataset.visualQuality = profile.quality;
      return true;
    },
    // Day/night remains a configurator decision; prevent daylight reflections at night.
    setEnvironmentIntensity(value) {
      const intensity = Math.max(0, Number(value) || 0);
      library.setEnvironmentIntensity(intensity);
      // Contextual assets/accessories also inherit scene.environment. They must
      // not keep a full daylight reflection after switching Pergola to night.
      scene.traverse(object => {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!material?.isMeshStandardMaterial || library.materials.has(material)) continue;
          if (!legacyEnvironmentStrength.has(material)) legacyEnvironmentStrength.set(material, material.envMapIntensity);
          material.envMapIntensity = legacyEnvironmentStrength.get(material) * intensity;
        }
      });
    },
    getDiagnostics() {
      return { version: SURFACE_SYSTEM_VERSION, threeRevision: THREE.REVISION, requestedQuality, profile: { ...currentProfile }, environment: !!environment.target, environmentWidth: environment.width, environmentError, ...library.getDiagnostics() };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      environment.dispose();
      library.dispose();
      delete renderer.domElement.dataset.surfaceSystem;
      delete renderer.domElement.dataset.visualQuality;
    },
  };
  controller.setQuality(quality);
  return controller;
}
