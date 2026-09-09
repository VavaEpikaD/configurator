/** Glass-only studio reflection reference, not a live capture of scene objects.
 * Injects the host Three.js engine. No camera-locked overlay, color map, network
 * download, or change to scene.environment / the product's metal lighting.
 */
export const GLAZING_REFLECTION_VERSION = '20260909-glass-13';
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createGlazingProbe(THREE, width) {
  if (![256, 512, 1024].includes(width)) throw new RangeError('Unsupported glazing probe resolution.');
  const height = width / 2, data = new Uint16Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const theta = Math.PI * (y + .5) / height;
    for (let x = 0; x < width; x++) {
      // Inverse of Three.js equirectUv: u = atan2(z, x) / (2 PI) + 0.5.
      const phi = Math.PI * 2 * ((x + .5) / width - .5);
      const dx = Math.sin(theta) * Math.cos(phi), dy = -Math.cos(theta), dz = Math.sin(theta) * Math.sin(phi);
      // Soft horizon contrast and two broad luminous studio cards. Their world-
      // fixed position makes highlights slide across the pane when orbiting it.
      const sky = smoothstep(-.06, .32, dy);
      const base = .10 + .70 * sky;
      const azimuth = Math.atan2(dx, Math.abs(dz)); // same reference on both sides
      const cardA = (1 - smoothstep(.065, .11, Math.abs(azimuth + .52)))
        * (1 - smoothstep(.40, .52, Math.abs(dy + .02)));
      const cardB = (1 - smoothstep(.07, .12, Math.abs(azimuth - .70)))
        * (1 - smoothstep(.38, .50, Math.abs(dy - .10)));
      const radiance = base + 8.0 * cardA + 5.0 * cardB;
      const p = (y * width + x) * 4;
      data[p] = THREE.DataUtils.toHalfFloat(radiance);
      data[p + 1] = THREE.DataUtils.toHalfFloat(radiance + .018 * sky);
      data[p + 2] = THREE.DataUtils.toHalfFloat(radiance + .045 * sky);
      data[p + 3] = THREE.DataUtils.toHalfFloat(1);
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.name = '360:glazing-studio-source';
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export class GlazingEnvironment {
  constructor(THREE, renderer, materials, { enabled = false, materialId = 'glass.architectural' } = {}) {
    this.THREE = THREE; this.renderer = renderer; this.materials = materials;
    this.enabled = enabled === true; this.materialId = materialId;
    this.target = null; this.width = 0; this.attemptedWidth = 0;
    this.error = null; this.disposed = false; this.allocations = 0; this.contextLost = false;
    this.onLost = () => { this.contextLost = true; };
    this.onRestored = () => { this.contextLost = false; this.release(); this.error = null; this.attemptedWidth = 0; };
    if (this.enabled) {
      renderer.domElement?.addEventListener?.('webglcontextlost', this.onLost);
      renderer.domElement?.addEventListener?.('webglcontextrestored', this.onRestored);
    }
  }
  setQuality(profile) {
    if (!this.enabled || this.disposed || this.contextLost || !profile) return false;
    const width = profile.environmentWidth; // bounded by existing shared tiers
    if (this.width === width && this.target) return false;
    // A failed allocation never triggers an allocation loop in the render loop.
    if (this.error && this.attemptedWidth === width) return false;
    this.attemptedWidth = width;
    let source, generator, next;
    try {
      source = createGlazingProbe(this.THREE, width);
      generator = new this.THREE.PMREMGenerator(this.renderer);
      next = generator.fromEquirectangular(source);
      if (!next?.texture) throw new Error('No glazing reflection target was created.');
      next.texture.name = '360:glazing-studio-13';
      // Bind new target before disposing old: existing and future variants agree.
      this.materials.setReflectionEnvironment(this.materialId, next.texture);
      const old = this.target; this.target = next; this.width = width; this.error = null;
      this.allocations++; old?.dispose();
      return true;
    } catch (error) {
      if (next && next !== this.target) next.dispose?.();
      this.error = error?.message || String(error);
      // Retain previous successful probe, otherwise the normal scene environment.
      return false;
    } finally { source?.dispose(); generator?.dispose(); }
  }
  release() {
    if (this.target) {
      // Detach only the binding owned here, not a newer caller-installed probe.
      if (this.materials.reflectionEnvironments.get(this.materialId) === this.target.texture) {
        this.materials.setReflectionEnvironment(this.materialId, null);
      }
      this.target.dispose();
    }
    this.target = null; this.width = 0;
  }
  getDiagnostics() {
    return { version: GLAZING_REFLECTION_VERSION, enabled: this.enabled, active: !!this.target && !this.contextLost && !this.disposed,
      status: this.disposed ? 'disposed' : !this.enabled ? 'disabled' : this.contextLost ? 'context-lost' : this.error ? 'fallback' : this.target ? 'ready' : 'waiting',
      source: 'studio-reference', liveSceneReflections: false, materialId: this.materialId,
      environmentWidth: this.width, targetCount: this.target ? 1 : 0, allocations: this.allocations, error: this.error };
  }
  dispose() {
    if (this.disposed) return;
    this.release(); this.disposed = true;
    this.renderer.domElement?.removeEventListener?.('webglcontextlost', this.onLost);
    this.renderer.domElement?.removeEventListener?.('webglcontextrestored', this.onRestored);
  }
}
