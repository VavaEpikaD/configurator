import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../window-configurator/src/client/lib/three.module.js';
import { ContactShading, contactTargetSize, isContactOccluderMaterial } from '../src/rendering/ContactShading.js';
import { getQualityProfile } from '../src/quality.js';
import { MaterialLibrary } from '../src/materials/MaterialLibrary.js';

// CPU renderer double verifies lifecycle and state restoration. GLSL and actual
// pixels are covered separately by contact-browser.mjs, not by these assertions.
function fixture({ enabled = true, supported = true, engine = THREE } = {}) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#aaccee');
  const camera = new THREE.PerspectiveCamera(40, 4 / 3, .05, 50); camera.position.z = 3;
  const material = new THREE.MeshStandardMaterial({ color: '#383e42', roughness: .58 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .1), material); scene.add(mesh);
  const listeners = new Map(), renders = [];
  const renderer = {
    capabilities: { isWebGL2: supported, maxTextures: 16 },
    shadowMap: { autoUpdate: true, needsUpdate: true }, autoClear: false, xr: { isPresenting: false },
    domElement: { addEventListener: (k, f) => listeners.set(k, f), removeEventListener: k => listeners.delete(k) },
    target: null, color: new THREE.Color('#445566'), alpha: .4, viewport: new THREE.Vector4(0, 0, 800, 600), scissor: new THREE.Vector4(0, 0, 800, 600),
    scissorTest: false, width: 800, height: 600, incomplete: false,
    getDrawingBufferSize(out) { return out.set(this.width, this.height); },
    getContext() { return { FRAMEBUFFER: 1, FRAMEBUFFER_COMPLETE: 2, checkFramebufferStatus: () => this.incomplete ? 0 : 2, isContextLost: () => false }; },
    getRenderTarget() { return this.target; }, setRenderTarget(v) { this.target = v; },
    getClearColor(out) { return out.copy(this.color); }, getClearAlpha() { return this.alpha; },
    setClearColor(v, a = 1) { this.color.set(v); this.alpha = a; },
    getViewport(out) { return out.copy(this.viewport); }, setViewport(v) { this.viewport.copy(v); },
    getScissor(out) { return out.copy(this.scissor); }, setScissor(v) { this.scissor.copy(v); },
    getScissorTest() { return this.scissorTest; }, setScissorTest(v) { this.scissorTest = v; },
    clear() {},
    render(scene, camera) {
      if (this.throwDepth && this.target?.texture.name === '360:contact-depth') throw new Error('Injected depth failure');
      const visible = []; scene.traverseVisible(o => { if (o.material) visible.push({ object: o, material: o.material }); });
      renders.push({ target: this.target, scene, camera, visible });
    },
  };
  const stage = new ContactShading(engine, { renderer, scene, enabled, radius: .04 });
  stage.setQuality(getQualityProfile('balanced').contactShading);
  return { scene, camera, material, mesh, stage, renderer, renders, listeners };
}
const lightingValues = m => JSON.stringify({ color: m.color.toArray(), metalness: m.metalness, roughness: m.roughness, envMapIntensity: m.envMapIntensity,
  normal: m.normalScale.toArray(), normalMap: m.normalMap?.uuid, roughnessMap: m.roughnessMap?.uuid, transparent: m.transparent, opacity: m.opacity });

test('contact buffers honor quality, framebuffer size, orientation and compact budgets', () => {
  assert.deepEqual(contactTargetSize(1600, 1200, getQualityProfile('balanced').contactShading), [800, 600]);
  assert.deepEqual(contactTargetSize(4000, 2000, getQualityProfile('high').contactShading), [1440, 720]);
  assert.deepEqual(contactTargetSize(2000, 4000, getQualityProfile('high', { compact: true }).contactShading), [360, 720]);
  assert.equal(getQualityProfile('low').contactShading.enabled, false);
  assert.equal(getQualityProfile('high', { capture: true }).contactShading.enabled, false);
  assert.throws(() => contactTargetSize(NaN, 100, getQualityProfile('balanced').contactShading));
});

test('contact render adds three auxiliary passes and restores all scene/renderer state', () => {
  const f = fixture(); const initial = lightingValues(f.material), pos = Array.from(f.mesh.geometry.attributes.position.array);
  const background = f.scene.background, beforeCompile = f.material.onBeforeCompile;
  f.stage.render(f.camera);
  assert.equal(f.renders.length, 4); assert.equal(f.renders[0].visible[0].material.isMeshDepthMaterial, true);
  assert.equal(f.renders[3].visible[0].material, f.material); assert.equal(f.renderer.target, null);
  assert.equal(f.renderer.autoClear, false); assert.equal(f.renderer.alpha, .4); assert.equal(f.renderer.color.getHexString(), '445566');
  assert.equal(f.renderer.shadowMap.autoUpdate, true); assert.equal(f.renderer.shadowMap.needsUpdate, true);
  assert.equal(f.scene.background, background); assert.equal(f.scene.overrideMaterial, null);
  assert.deepEqual(f.renderer.viewport.toArray(), [0, 0, 800, 600]);
  assert.equal(lightingValues(f.material), initial); assert.deepEqual(Array.from(f.mesh.geometry.attributes.position.array), pos);
  assert.equal(f.stage.uniforms.cContactEnabled.value, 0, 'No AO leaks into a later direct/export render.');
  assert.equal(f.stage.getDiagnostics().active, true);
  f.stage.dispose(); assert.equal(f.material.onBeforeCompile, beforeCompile); assert.equal(f.listeners.size, 0);
});

test('glass, transparent screens, overlays and hidden objects do not occlude; opaque mixed slots remain', () => {
  const f = fixture(), library = new MaterialLibrary(THREE);
  const materials = [library.create('glass.clear'), new THREE.MeshStandardMaterial({ transparent: true, opacity: .5 }),
    new THREE.MeshStandardMaterial({ depthWrite: false }), new THREE.MeshStandardMaterial({ depthTest: false }),
    new THREE.MeshStandardMaterial({ toneMapped: false })];
  const objects = materials.map(m => new THREE.Mesh(new THREE.BoxGeometry(), m));
  objects.push(new THREE.Sprite(new THREE.SpriteMaterial()), new THREE.LineSegments(new THREE.BoxGeometry(), new THREE.LineBasicMaterial()));
  objects.push(new THREE.Mesh(new THREE.BoxGeometry(), [f.material, materials[0]]));
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(), f.material); hidden.visible = false; objects.push(hidden);
  objects.forEach(o => f.scene.add(o)); f.stage.render(f.camera);
  assert.equal(f.renders[0].visible.length, 2); assert.equal(f.stage.getDiagnostics().occluderMeshes, 2);
  assert.equal(f.stage.getDiagnostics().mixedMaterialMeshes, 1);
  const mixed = f.renders[0].visible[1].material;
  assert.equal(mixed[0].isMeshDepthMaterial, true); assert.equal(mixed[1].visible, false);
  assert.ok(objects.slice(0, -1).every(o => o.visible)); assert.equal(hidden.visible, false);
  for (const material of materials) assert.equal(isContactOccluderMaterial(material), false);
  assert.equal(f.stage.receivers.has(materials[0]), false);
  f.stage.dispose(); library.dispose();
});

test('alpha cutouts, side selection, displacement and clipping are mirrored without owning texture assets', () => {
  const f = fixture(), texture = new THREE.Texture(); let textureDisposed = false;
  texture.addEventListener('dispose', () => { textureDisposed = true; });
  Object.assign(f.material, { side: THREE.DoubleSide, map: texture, alphaMap: texture, alphaTest: .4,
    displacementMap: texture, displacementScale: .02, displacementBias: .01, clippingPlanes: [new THREE.Plane()] });
  f.stage.render(f.camera);
  const depth = f.stage.depthMaterials.get(f.material);
  for (const key of ['side', 'map', 'alphaMap', 'alphaTest', 'displacementMap', 'displacementScale', 'displacementBias', 'clippingPlanes']) assert.equal(depth[key], f.material[key]);
  f.stage.dispose(); assert.equal(textureDisposed, false);
});

test('material hook preserves existing hooks, maps and AO chunk while touching only indirect light', () => {
  const f = fixture(); let called = 0;
  const original = function(shader) { assert.equal(this, f.material); called++; shader.uniforms.original = { value: 1 }; };
  const key = () => 'original-program'; f.material.onBeforeCompile = original; f.material.customProgramCacheKey = key;
  f.stage.render(f.camera);
  const shader = { uniforms: {}, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  f.material.onBeforeCompile(shader, f.renderer);
  assert.equal(called, 1); assert.equal(shader.uniforms.original.value, 1);
  assert.equal(shader.uniforms.cContactAO, f.stage.uniforms.cContactAO);
  assert.ok(shader.fragmentShader.includes('#include <aomap_fragment>'));
  assert.ok(shader.fragmentShader.includes('reflectedLight.indirectDiffuse *= cContactAmount'));
  assert.ok(!shader.fragmentShader.includes('reflectedLight.directDiffuse *='));
  assert.equal(f.material.customProgramCacheKey(), 'original-program|360-contact-14');
  f.stage.dispose(); assert.equal(f.material.onBeforeCompile, original); assert.equal(f.material.customProgramCacheKey, key);
});

test('shared material is not double-patched by two scene controllers', () => {
  const a = fixture(), b = fixture(); b.mesh.material = a.material;
  a.stage.render(a.camera); const hook = a.material.onBeforeCompile;
  b.stage.render(b.camera); assert.equal(a.material.onBeforeCompile, hook); assert.equal(b.stage.receivers.size, 0);
  b.stage.dispose(); assert.equal(a.material.onBeforeCompile, hook); a.stage.dispose();
});

test('same-quality frames reuse buffers; high/portrait resize reallocates; low releases everything', () => {
  const f = fixture(); f.stage.render(f.camera); const target = f.stage.depthTarget;
  for (let i = 0; i < 5; i++) f.stage.render(f.camera);
  assert.equal(f.stage.depthTarget, target); assert.equal(f.stage.getDiagnostics().allocationCount, 1);
  f.stage.setQuality(getQualityProfile('high').contactShading); f.renderer.width = 600; f.renderer.height = 1000; f.renderer.viewport.set(0, 0, 600, 1000);
  f.stage.render(f.camera); assert.deepEqual(f.stage.getDiagnostics().bufferSize, [450, 750]);
  const before = f.renders.length; f.stage.setQuality(getQualityProfile('low').contactShading); f.stage.render(f.camera);
  assert.equal(f.renders.length, before + 1); assert.equal(f.stage.getDiagnostics().targetCount, 0);
  assert.equal(f.stage.receivers.size, 0); assert.equal(f.stage.depthMaterials.size, 0);
  f.stage.setQuality(getQualityProfile('balanced').contactShading); f.stage.render(f.camera); assert.equal(f.stage.getDiagnostics().active, true);
  f.stage.dispose(); f.stage.dispose();
});

test('rebuild removes stale receivers and depth variants; disposal unregisters managed receiver', () => {
  const f = fixture(); f.stage.render(f.camera);
  const replacement = new THREE.MeshStandardMaterial(); f.mesh.material = replacement; f.stage.render(f.camera);
  assert.equal(f.stage.receivers.size, 1); assert.ok(!f.stage.receivers.has(f.material));
  assert.equal(f.stage.depthMaterials.size, 1); replacement.dispose(); assert.equal(f.stage.receivers.size, 0);
  f.stage.dispose();
});

test('per-frame bypass, unsupported GPU, render targets, scissor, override and XR use direct rendering', () => {
  for (const setup of [f => { f.renderer.xr.isPresenting = true; }, f => { f.renderer.target = new THREE.WebGLRenderTarget(8, 8); },
    f => { f.renderer.scissorTest = true; }, f => { f.scene.overrideMaterial = new THREE.MeshBasicMaterial(); }]) {
    const f = fixture(); setup(f); f.stage.render(f.camera); assert.equal(f.renders.length, 1); assert.equal(f.stage.depthTarget, null); f.stage.dispose();
  }
  for (const options of [{ supported: false }, { enabled: false }]) {
    const f = fixture(options); f.stage.render(f.camera); assert.equal(f.renders.length, 1); assert.equal(f.stage.depthTarget, null); f.stage.dispose();
  }
  const f = fixture(); f.stage.render(f.camera, { enabled: false }); assert.equal(f.renders.length, 1); f.stage.dispose();
});

test('depth-pass exceptions restore state and produce the normal beauty render without retry loops', () => {
  const f = fixture(); const warn = console.warn; console.warn = () => {};
  try {
    f.renderer.throwDepth = true; f.stage.render(f.camera);
    assert.equal(f.mesh.material, f.material); assert.equal(f.renderer.target, null); assert.equal(f.renderer.autoClear, false);
    assert.equal(f.stage.getDiagnostics().status, 'fallback'); assert.match(f.stage.getDiagnostics().error, /Injected/);
    assert.equal(f.stage.depthTarget, null); assert.equal(f.renders.length, 1);
    f.stage.render(f.camera); assert.equal(f.renders.length, 2);
    f.renderer.throwDepth = false; f.stage.setQuality(getQualityProfile('high').contactShading); f.stage.render(f.camera);
    assert.equal(f.stage.getDiagnostics().status, 'active');
  } finally { console.warn = warn; f.stage.dispose(); }
});

test('incomplete framebuffer falls back; incompatible material hook leaves source unmodified', () => {
  const f = fixture(); const warn = console.warn; console.warn = () => {};
  try {
    f.renderer.incomplete = true; f.stage.render(f.camera); assert.equal(f.stage.getDiagnostics().status, 'fallback');
    f.renderer.incomplete = false; f.stage.setQuality(getQualityProfile('high').contactShading); f.stage.render(f.camera);
    const shader = { uniforms: {}, fragmentShader: 'void main() {}' }; f.material.onBeforeCompile(shader, f.renderer);
    assert.equal(shader.fragmentShader, 'void main() {}'); assert.equal(f.stage.failed, true);
    f.stage.render(f.camera); assert.equal(f.stage.getDiagnostics().status, 'fallback');
  } finally { console.warn = warn; f.stage.dispose(); }
});

test('context loss bypasses passes; restoration clears stale targets and rebuilds on next frame', () => {
  const f = fixture(); f.stage.render(f.camera); const first = f.stage.depthTarget;
  f.listeners.get('webglcontextlost')(); const count = f.renders.length; f.stage.render(f.camera);
  assert.equal(f.renders.length, count + 1); assert.equal(f.stage.getDiagnostics().status, 'context-lost');
  f.listeners.get('webglcontextrestored')(); assert.equal(f.stage.depthTarget, null); f.stage.render(f.camera);
  assert.notEqual(f.stage.depthTarget, first); assert.equal(f.stage.getDiagnostics().active, true); f.stage.dispose();
});

test('contact options reject non-finite/unsafe radii or excessive darkening', () => {
  for (const params of [{ radius: NaN }, { radius: 0 }, { radius: -1 }, { intensity: Infinity }, { maxDarkening: .9 }])
    assert.throws(() => new ContactShading(THREE, params));
});

test('filtered AO is a separate read target, never a texture feedback loop', () => {
  const f = fixture(); f.stage.render(f.camera);
  assert.equal(f.stage.getDiagnostics().targetCount, 3);
  assert.equal(f.stage.getDiagnostics().filter, 'depth-guided-bilateral-3x3');
  assert.equal(f.stage.getDiagnostics().closeRadiusMetres, .016);
  assert.equal(f.stage.uniforms.cContactAO.value, f.stage.filteredTarget.texture);
  assert.equal(f.stage.screen.filterMaterial.uniforms.cRawAO.value, f.stage.aoTarget.texture);
  assert.equal(f.renders[1].target, f.stage.aoTarget);
  assert.equal(f.renders[2].target, f.stage.filteredTarget);
  assert.equal(f.renders[1].visible[0].material, f.stage.screen.material);
  assert.equal(f.renders[2].visible[0].material, f.stage.screen.filterMaterial);
  assert.notEqual(f.renders[2].target.texture, f.stage.screen.filterMaterial.uniforms.cRawAO.value);
  f.stage.dispose();
});

test('filter-pass failure restores the model and releases every buffer exactly once', () => {
  const f = fixture(), originalRender = f.renderer.render, released = [];
  f.renderer.render = function(scene, camera) {
    if (this.target && this.target === f.stage.filteredTarget) throw new Error('Injected denoise failure');
    return originalRender.call(this, scene, camera);
  };
  f.stage.allocate(400, 300);
  for (const resource of [f.stage.depthTarget, f.stage.aoTarget, f.stage.filteredTarget,
      f.stage.screen.material, f.stage.screen.filterMaterial, f.stage.screen.geometry]) {
    resource.addEventListener('dispose', () => released.push(resource));
  }
  const warn = console.warn; console.warn = () => {};
  try { f.stage.render(f.camera); } finally { console.warn = warn; }
  assert.equal(f.stage.getDiagnostics().status, 'fallback');
  assert.match(f.stage.error, /denoise/);
  assert.equal(f.stage.getDiagnostics().targetCount, 0);
  assert.equal(new Set(released).size, 6); assert.equal(released.length, 6);
  assert.equal(f.mesh.material, f.material); assert.equal(f.renderer.getRenderTarget(), null);
  assert.equal(f.renderer.autoClear, false); assert.equal(f.renderer.shadowMap.autoUpdate, true);
  assert.equal(f.stage.receivers.size, 0); f.stage.dispose(); assert.equal(released.length, 6);
});

test('mixed solid/glass material arrays keep draw groups, transforms and glass properties unchanged', () => {
  const f = fixture(); const glass = new THREE.MeshPhysicalMaterial({ transmission: 1, metalness: 0, roughness: .01 });
  const frame = f.material, geometry = new THREE.BoxGeometry(.3, .4, .005);
  const array = [frame, glass, frame, glass, glass, frame];
  const mesh = new THREE.Mesh(geometry, array); f.scene.add(mesh);
  const groups = JSON.stringify(geometry.groups), positions = geometry.attributes.position.array.slice();
  const originalHook = glass.onBeforeCompile;
  f.stage.render(f.camera);
  const duringDepth = f.renders[0].visible.find(entry => entry.object === mesh).material;
  assert.equal(duringDepth.length, 6);
  for (const i of [1, 3, 4]) assert.equal(duringDepth[i].visible, false);
  for (const i of [0, 2, 5]) assert.equal(duringDepth[i].isMeshDepthMaterial, true);
  assert.equal(mesh.material, array); assert.equal(glass.onBeforeCompile, originalHook);
  assert.equal(glass.transmission, 1); assert.equal(glass.metalness, 0);
  assert.equal(JSON.stringify(geometry.groups), groups); assert.deepEqual(geometry.attributes.position.array, positions);
  assert.equal(f.stage.receivers.has(glass), false);
  f.stage.dispose(); geometry.dispose(); glass.dispose();
});

test('partial viewports bypass contact shading without disabling the normal view', () => {
  const f = fixture(); f.stage.render(f.camera);
  f.renderer.viewport.set(40, 10, 400, 300); const count = f.renders.length;
  f.stage.render(f.camera);
  assert.equal(f.renders.length, count + 1); assert.equal(f.stage.status, 'viewport-bypass');
  assert.equal(f.stage.uniforms.cContactEnabled.value, 0);
  f.renderer.viewport.set(0, 0, 800, 600); f.stage.render(f.camera); assert.equal(f.stage.status, 'active');
  // WebGLRenderer stores its default viewport in CSS pixels.
  f.renderer.getPixelRatio = () => 2; f.renderer.width = 1600; f.renderer.height = 1200;
  f.stage.render(f.camera); assert.equal(f.stage.status, 'active'); f.stage.dispose();
});

test('an incompatible beauty hook leaves no retained filters after the fallback render', () => {
  const f = fixture(); f.stage.render(f.camera);
  const bad = { uniforms: {}, fragmentShader: 'void main() {}' };
  f.material.onBeforeCompile(bad, f.renderer);
  f.stage.render(f.camera);
  assert.equal(f.stage.status, 'fallback'); assert.equal(f.stage.getDiagnostics().targetCount, 0);
  assert.equal(f.stage.receivers.size, 0); assert.equal(f.stage.depthMaterials.size, 0);
  f.stage.dispose();
});

test('Low releases mixed-slot placeholders as well as all auxiliary render resources', () => {
  const f = fixture(); const glass = new THREE.MeshPhysicalMaterial({ transmission: 1 });
  f.mesh.material = [f.material, glass]; f.stage.render(f.camera);
  const skip = f.stage.skipDepth; let disposed = 0; skip.addEventListener('dispose', () => disposed++);
  f.stage.setQuality(getQualityProfile('low').contactShading);
  assert.equal(disposed, 1); assert.equal(f.stage.skipDepth, null); assert.equal(f.stage.getDiagnostics().targetCount, 0);
  f.stage.dispose(); assert.equal(disposed, 1); glass.dispose();
});

test('partial filter allocation does not leak the already created shader or fullscreen geometry', () => {
  const resources = [], record = resource => { resources.push(resource); resource.disposals=0; resource.addEventListener('dispose',()=>resource.disposals++); };
  const engine = { ...THREE,
    WebGLRenderTarget: class extends THREE.WebGLRenderTarget { constructor(...args) { super(...args); record(this); } },
    PlaneGeometry: class extends THREE.PlaneGeometry { constructor(...args) { super(...args); record(this); } },
    ShaderMaterial: class extends THREE.ShaderMaterial { constructor(parameters) {
      if (parameters.uniforms.cRawAO) throw new Error('Injected filter allocation failure');
      super(parameters); record(this);
    } },
  };
  const f = fixture({ engine }); const warn = console.warn; console.warn = () => {};
  try { f.stage.render(f.camera); } finally { console.warn = warn; }
  assert.equal(f.stage.status, 'fallback'); assert.equal(f.stage.getDiagnostics().targetCount, 0);
  assert.equal(resources.length, 5); assert.ok(resources.every(r=>r.disposals===1));
  f.stage.dispose(); assert.ok(resources.every(r=>r.disposals===1));
});
