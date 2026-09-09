import { CONTACT_VERTEX, CONTACT_FRAGMENT, CONTACT_DENOISE_FRAGMENT, CONTACT_PARS, CONTACT_APPLY } from './contactShaders.js?v=contact-14';

export const CONTACT_SHADING_VERSION = '20260909-contact-14';
const owners = new WeakMap();
const DEPTH_PROPERTIES = ['side', 'map', 'alphaMap', 'alphaTest', 'alphaHash', 'opacity',
  'displacementMap', 'displacementScale', 'displacementBias', 'clippingPlanes', 'clipIntersection'];

export function isContactOccluderMaterial(material) {
  return !!material && material.visible !== false && material.depthWrite !== false && material.depthTest !== false
    && material.colorWrite !== false && !material.transparent && (material.opacity ?? 1) >= 0.999
    && !(material.transmission > 0) && !material.wireframe && !material.isShaderMaterial
    && material.toneMapped !== false && material.userData?.contactShading !== false;
}
export function contactTargetSize(width, height, profile) {
  if (!(width > 0 && height > 0) || !Number.isFinite(width + height)) throw new RangeError('Invalid contact buffer size.');
  const scale = Math.min(profile.resolutionScale, profile.maxSize / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

/** Scene-owned, engine-injected contact AO. Never replaces the beauty renderer.
 * Opt-in by the host: render(camera) replaces only that host's main render call.
 * Three auxiliary passes on Balanced/High, none on Low/capture/XR/unsupported GPUs.
 * Only indirect light is modulated, not UI, glass, direct sun, emissive or background.
 */
export class ContactShading {
  constructor(THREE, { renderer, scene, enabled = true, radius = 0.08, intensity = 0.65, maxDarkening = 0.35 } = {}) {
    if (!(Number.isFinite(radius) && radius > 0 && radius <= 1)) throw new RangeError('Contact radius must be in (0, 1] metres.');
    if (!(Number.isFinite(intensity) && intensity >= 0 && intensity <= 1)) throw new RangeError('Contact intensity must be in [0, 1].');
    if (!(Number.isFinite(maxDarkening) && maxDarkening >= 0 && maxDarkening <= 0.5)) throw new RangeError('Contact darkening must be in [0, 0.5].');
    this.THREE = THREE; this.renderer = renderer; this.scene = scene;
    this.enabled = enabled; this.radius = radius; this.intensity = intensity; this.maxDarkening = maxDarkening;
    const source = THREE.ShaderLib?.standard?.fragmentShader || '';
    const gl = renderer?.getContext?.();
    const webgl2 = renderer?.capabilities?.isWebGL2 === true
      || (typeof gl?.texImage3D === 'function' && typeof gl?.createVertexArray === 'function');
    this.supported = webgl2
      && !renderer.capabilities.logarithmicDepthBuffer && !renderer.capabilities.reversedDepthBuffer
      && (renderer.capabilities.maxTextures ?? 0) >= 8
      && source.includes('#include <packing>') && source.includes('#include <aomap_fragment>');
    this.status = enabled ? (this.supported ? 'waiting-for-render' : 'unsupported') : 'disabled';
    this.error = null; this.failed = false; this.disposed = false; this.contextLost = false;
    this.profile = null; this.depthTarget = null; this.aoTarget = null; this.filteredTarget = null; this.screen = null;
    this.receivers = new Map(); this.depthMaterials = new Map(); this.occluderCount = 0;
    this.renderedFrames = 0; this.allocationCount = 0; this.mixedMaterialMeshes = 0; this.excludedMaterialSlots = 0;
    this.skipDepth = null;
    this.size = new THREE.Vector2(); this.viewport = new THREE.Vector4(); this.scissor = new THREE.Vector4();
    this.clearColor = new THREE.Color();
    this.uniforms = {
      cContactDepth: { value: null }, cContactAO: { value: null }, cContactProjection: { value: new THREE.Matrix4() },
      cContactTexel: { value: new THREE.Vector2(1, 1) }, cContactNear: { value: 0.05 }, cContactFar: { value: 100 },
      cContactOrthographic: { value: 0 }, cContactBias: { value: radius * 0.02 }, cContactEnabled: { value: 0 },
    };
    this.onLost = () => { this.contextLost = true; this.uniforms.cContactEnabled.value = 0; this.status = 'context-lost'; };
    this.onRestored = () => { this.contextLost = false; this.failed = false; this.error = null; this.releaseBuffers(); this.status = 'waiting-for-render'; };
    renderer.domElement?.addEventListener?.('webglcontextlost', this.onLost);
    renderer.domElement?.addEventListener?.('webglcontextrestored', this.onRestored);
  }

  setQuality(profile) {
    if (this.disposed) return;
    const changed = JSON.stringify(this.profile) !== JSON.stringify(profile);
    this.profile = profile ? { ...profile } : null;
    if (changed && this.failed) { this.failed = false; this.error = null; }
    if (!profile?.enabled || !this.enabled) {
      this.uniforms.cContactEnabled.value = 0; this.releaseBuffers(); this.releaseMaterials();
      this.status = this.enabled ? 'quality-disabled' : 'disabled';
    }
  }

  attach(material) {
    if (this.receivers.has(material) || (owners.has(material) && owners.get(material) !== this)) return;
    const stage = this;
    const original = material.onBeforeCompile, originalKey = material.customProgramCacheKey;
    const baseKey = originalKey.call(material);
    const hook = function(shader, renderer) {
      original.call(this, shader, renderer);
      if (!shader.fragmentShader.includes('#include <packing>') || !shader.fragmentShader.includes('#include <aomap_fragment>')) {
        stage.failed = true; stage.status = 'fallback'; stage.error = 'A material shader does not support the contact-lighting hook.';
        stage.uniforms.cContactEnabled.value = 0;
        return; // Leave the caller's shader intact, rather than generating invalid GLSL.
      }
      Object.assign(shader.uniforms, stage.uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <packing>', '#include <packing>\n' + CONTACT_PARS)
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + CONTACT_APPLY);
    };
    const key = () => `${baseKey}|360-contact-14`;
    const onDispose = () => this.detach(material, false);
    this.receivers.set(material, { original, originalKey, hook, key, onDispose }); owners.set(material, this);
    material.onBeforeCompile = hook; material.customProgramCacheKey = key;
    material.addEventListener('dispose', onDispose); material.needsUpdate = true;
  }
  detach(material, recompile = true) {
    const entry = this.receivers.get(material);
    if (!entry) return;
    // Do not overwrite a newer hook installed by another owner.
    if (material.onBeforeCompile === entry.hook) material.onBeforeCompile = entry.original;
    if (material.customProgramCacheKey === entry.key) material.customProgramCacheKey = entry.originalKey;
    material.removeEventListener('dispose', entry.onDispose);
    this.receivers.delete(material); if (owners.get(material) === this) owners.delete(material);
    if (recompile) material.needsUpdate = true;
  }
  releaseMaterials() {
    for (const material of [...this.receivers.keys()]) this.detach(material);
    for (const depth of this.depthMaterials.values()) depth.dispose();
    this.depthMaterials.clear(); this.occluderCount = 0; this.mixedMaterialMeshes = 0; this.excludedMaterialSlots = 0;
    this.skipDepth?.dispose(); this.skipDepth = null;
  }
  skippedDepthMaterial() {
    if (!this.skipDepth) {
      this.skipDepth = new this.THREE.MeshDepthMaterial();
      this.skipDepth.name = '360:contact-excluded-slot'; this.skipDepth.visible = false;
    }
    return this.skipDepth;
  }
  depthMaterial(source) {
    let depth = this.depthMaterials.get(source);
    if (!depth) {
      depth = new this.THREE.MeshDepthMaterial({ depthPacking: this.THREE.RGBADepthPacking, blending: this.THREE.NoBlending });
      depth.name = '360:contact-depth'; depth.toneMapped = false;
      this.depthMaterials.set(source, depth);
    }
    for (const key of DEPTH_PROPERTIES) {
      if (depth[key] === source[key]) continue;
      depth[key] = source[key]; depth.needsUpdate = true;
    }
    return depth;
  }

  allocate(width, height) {
    if (this.depthTarget?.width === width && this.depthTarget.height === height) return;
    this.releaseBuffers();
    const T = this.THREE;
    let material, geometry, filterMaterial;
    try {
      const options = { minFilter: T.NearestFilter, magFilter: T.NearestFilter,
        format: T.RGBAFormat, type: T.UnsignedByteType, stencilBuffer: false, generateMipmaps: false };
      this.depthTarget = new T.WebGLRenderTarget(width, height, { ...options, depthBuffer: true });
      this.aoTarget = new T.WebGLRenderTarget(width, height, { ...options, depthBuffer: false });
      this.filteredTarget = new T.WebGLRenderTarget(width, height, { ...options, depthBuffer: false });
      this.depthTarget.texture.name = '360:contact-depth'; this.aoTarget.texture.name = '360:contact-occlusion';
      this.filteredTarget.texture.name = '360:contact-filtered';
      this.depthTarget.texture.colorSpace = this.aoTarget.texture.colorSpace = this.filteredTarget.texture.colorSpace = T.NoColorSpace;
      this.uniforms.cContactDepth.value = this.depthTarget.texture; this.uniforms.cContactAO.value = this.filteredTarget.texture;
      this.uniforms.cContactTexel.value.set(1 / width, 1 / height);
      const uniforms = { cDepth: this.uniforms.cContactDepth, cProjection: this.uniforms.cContactProjection,
        cInverseProjection: { value: new T.Matrix4() }, cTexel: this.uniforms.cContactTexel,
        cRadius: { value: this.radius }, cBias: this.uniforms.cContactBias,
        cIntensity: { value: this.intensity }, cMaxDarkening: { value: this.maxDarkening },
        cOrthographic: this.uniforms.cContactOrthographic, cSamples: { value: this.profile.samples } };
      material = new T.ShaderMaterial({ uniforms, vertexShader: CONTACT_VERTEX, fragmentShader: CONTACT_FRAGMENT,
        depthTest: false, depthWrite: false, blending: T.NoBlending, toneMapped: false });
      geometry = new T.PlaneGeometry(2, 2);
      const scene = new T.Scene(); const mesh = new T.Mesh(geometry, material); mesh.frustumCulled = false; scene.add(mesh);
      filterMaterial = new T.ShaderMaterial({ uniforms: {
        cDepth: this.uniforms.cContactDepth, cRawAO: { value: this.aoTarget.texture },
        cProjection: this.uniforms.cContactProjection, cInverseProjection: uniforms.cInverseProjection,
        cTexel: this.uniforms.cContactTexel, cBias: this.uniforms.cContactBias,
        cOrthographic: this.uniforms.cContactOrthographic,
      }, vertexShader: CONTACT_VERTEX, fragmentShader: CONTACT_DENOISE_FRAGMENT,
        depthTest: false, depthWrite: false, blending: T.NoBlending, toneMapped: false });
      this.screen = { material, filterMaterial, mesh, geometry, scene, camera: new T.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
      this.allocationCount++;
    } catch (error) {
      if (!this.screen) { material?.dispose(); filterMaterial?.dispose(); geometry?.dispose(); }
      this.releaseBuffers(); throw error;
    }
  }
  releaseBuffers() {
    this.uniforms.cContactEnabled.value = 0;
    this.uniforms.cContactDepth.value = null; this.uniforms.cContactAO.value = null;
    this.depthTarget?.dispose(); this.aoTarget?.dispose(); this.filteredTarget?.dispose();
    this.screen?.material.dispose(); this.screen?.filterMaterial.dispose(); this.screen?.geometry.dispose();
    this.depthTarget = null; this.aoTarget = null; this.filteredTarget = null; this.screen = null;
  }

  bypassReason(camera, requested) {
    if (!this.enabled || !requested) return 'disabled';
    if (!this.profile?.enabled) return 'quality-disabled';
    if (!this.supported) return 'unsupported';
    if (this.contextLost || this.renderer.getContext?.().isContextLost?.()) return 'context-lost';
    if (this.failed) return 'fallback';
    if (this.renderer.xr?.isPresenting || camera?.isArrayCamera) return 'xr-bypass';
    if (!(camera?.isPerspectiveCamera || camera?.isOrthographicCamera)) return 'camera-bypass';
    if (this.renderer.getRenderTarget() || this.scene.overrideMaterial || this.renderer.getScissorTest()) return 'special-render-bypass';
    // A partial default-framebuffer viewport is not represented by our full-view
    // depth texture. Do not misproject contacts into split-screen/export views.
    const viewport = this.renderer.getViewport(this.viewport);
    this.renderer.getDrawingBufferSize(this.size);
    const pixelRatio = this.renderer.getPixelRatio?.() ?? 1;
    if (viewport.x !== 0 || viewport.y !== 0
        || Math.abs(viewport.z * pixelRatio - this.size.x) > 1
        || Math.abs(viewport.w * pixelRatio - this.size.y) > 1) return 'viewport-bypass';
    return null;
  }

  prepare(camera) {
    const r = this.renderer, scene = this.scene, T = this.THREE;
    r.getDrawingBufferSize(this.size);
    const [width, height] = contactTargetSize(this.size.x, this.size.y, this.profile);
    this.allocate(width, height);
    this.uniforms.cContactProjection.value.copy(camera.projectionMatrix);
    this.uniforms.cContactNear.value = camera.near; this.uniforms.cContactFar.value = camera.far;
    this.uniforms.cContactOrthographic.value = camera.isOrthographicCamera ? 1 : 0;
    this.screen.material.uniforms.cInverseProjection.value.copy(camera.projectionMatrixInverse);
    this.screen.material.uniforms.cSamples.value = this.profile.samples;

    const originalTarget = r.getRenderTarget(), clearAlpha = r.getClearAlpha(), autoClear = r.autoClear;
    const autoShadow = r.shadowMap.autoUpdate, needsShadow = r.shadowMap.needsUpdate;
    const background = scene.background, override = scene.overrideMaterial;
    r.getClearColor(this.clearColor); r.getViewport(this.viewport); r.getScissor(this.scissor);
    const scissorTest = r.getScissorTest();
    const changed = [], seenSources = new Set(), seenReceivers = new Set();
    this.occluderCount = 0; this.mixedMaterialMeshes = 0; this.excludedMaterialSlots = 0;
    try {
      scene.traverseVisible(object => {
        if (!object.material) return;
        const sources = Array.isArray(object.material) ? object.material : [object.material];
        const eligible = sources.map(isContactOccluderMaterial);
        // Keep eligible opaque groups in mixed glass/frame assets. The original
        // material array and all geometry groups are restored unmodified below.
        if (!object.isMesh || object.customDepthMaterial || object.userData?.contactShading === false
            || !eligible.some(Boolean)) {
          changed.push({ object, visible: object.visible }); object.visible = false; return;
        }
        if (!eligible.every(Boolean)) this.mixedMaterialMeshes++;
        this.excludedMaterialSlots += eligible.filter(value => !value).length;
        const depths = sources.map((source, index) => {
          if (!eligible[index]) return this.skippedDepthMaterial();
          seenSources.add(source);
          if (source.isMeshStandardMaterial) { seenReceivers.add(source); this.attach(source); }
          return this.depthMaterial(source);
        });
        changed.push({ object, material: object.material });
        object.material = Array.isArray(object.material) ? depths : depths[0];
        this.occluderCount++;
      });
      scene.background = null; scene.overrideMaterial = null;
      r.autoClear = true; r.shadowMap.autoUpdate = false; r.shadowMap.needsUpdate = false;
      r.setScissorTest(false); r.setClearColor(0xffffff, 1);
      r.setRenderTarget(this.depthTarget); r.clear(); r.render(scene, camera); this.checkFramebuffer();
      this.screen.mesh.material = this.screen.material;
      r.setRenderTarget(this.aoTarget); r.clear(); r.render(this.screen.scene, this.screen.camera); this.checkFramebuffer();
      this.screen.mesh.material = this.screen.filterMaterial;
      r.setRenderTarget(this.filteredTarget); r.clear(); r.render(this.screen.scene, this.screen.camera); this.checkFramebuffer();
      this.uniforms.cContactEnabled.value = this.failed ? 0 : 1;
    } finally {
      for (const entry of changed) {
        if ('material' in entry) entry.object.material = entry.material;
        if ('visible' in entry) entry.object.visible = entry.visible;
      }
      scene.background = background; scene.overrideMaterial = override;
      r.autoClear = autoClear; r.shadowMap.autoUpdate = autoShadow; r.shadowMap.needsUpdate = needsShadow;
      r.setClearColor(this.clearColor, clearAlpha); r.setRenderTarget(originalTarget);
      r.setViewport(this.viewport); r.setScissor(this.scissor); r.setScissorTest(scissorTest);
      // Rebuilds cannot retain old product materials or depth variants indefinitely.
      for (const material of [...this.receivers.keys()]) if (!seenReceivers.has(material)) this.detach(material);
      for (const [source, depth] of this.depthMaterials) if (!seenSources.has(source)) { depth.dispose(); this.depthMaterials.delete(source); }
    }
  }
  checkFramebuffer() {
    const gl = this.renderer.getContext();
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Contact render target is incomplete.');
  }

  render(camera, { enabled = true } = {}) {
    if (this.disposed) return;
    this.uniforms.cContactEnabled.value = 0;
    const reason = this.bypassReason(camera, enabled);
    if (reason) this.status = reason;
    else {
      try {
        this.prepare(camera);
        this.status = this.failed ? 'fallback' : 'active';
        if (!this.failed) this.renderedFrames++;
      } catch (error) {
        this.error = error?.message || String(error); this.failed = true; this.status = 'fallback';
        this.releaseBuffers(); this.releaseMaterials();
        console.warn('Shared 3D contact shading disabled; using the normal renderer.', error);
      }
    }
    // Keep errors in the host's actual beauty render observable, not silently swallowed.
    try { this.renderer.render(this.scene, camera); }
    finally {
      this.uniforms.cContactEnabled.value = 0;
      // A caller may reject the lighting hook during the beauty compilation.
      // Release the now-unused auxiliary resources rather than retaining them
      // until a later quality change. Never swallow errors from the beauty pass.
      if (this.failed) { this.status = 'fallback'; this.releaseBuffers(); this.releaseMaterials(); }
    }
  }
  getDiagnostics() {
    return { version: CONTACT_SHADING_VERSION, enabled: this.enabled && !!this.profile?.enabled, supported: this.supported, active: this.status === 'active',
      status: this.status, error: this.error, method: 'screen-space-indirect-occlusion', filter: 'depth-guided-bilateral-3x3', sampling: 'dual-radius', radiusMetres: this.radius,
      closeRadiusMetres: this.radius * 0.4,
      intensity: this.intensity, maxIndirectDarkening: this.maxDarkening, samples: this.profile?.enabled ? this.profile.samples : 0,
      bufferSize: this.depthTarget ? [this.depthTarget.width, this.depthTarget.height] : [0, 0],
      targetCount: [this.depthTarget, this.aoTarget, this.filteredTarget].filter(Boolean).length,
      auxiliaryPasses: this.status === 'active' ? 3 : 0, mixedMaterialMeshes: this.mixedMaterialMeshes, excludedMaterialSlots: this.excludedMaterialSlots, receiverMaterials: this.receivers.size, depthMaterials: this.depthMaterials.size,
      occluderMeshes: this.occluderCount, renderedFrames: this.renderedFrames, allocationCount: this.allocationCount };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.status = 'disposed'; this.releaseBuffers(); this.releaseMaterials();
    this.renderer.domElement?.removeEventListener?.('webglcontextlost', this.onLost);
    this.renderer.domElement?.removeEventListener?.('webglcontextrestored', this.onRestored);
  }
}
