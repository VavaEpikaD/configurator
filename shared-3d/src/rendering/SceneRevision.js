// Observe render inputs without hashing, changing geometry, or patching Object3D.
// References and scalar values are compared exactly. GPU buffers follow Three's
// BufferAttribute.version contract. Unknown animated shaders are never cached.
class Values {
  constructor() { this.values = []; this.index = 0; this.changed = true; }
  begin() { this.index = 0; this.changed = false; }
  put(value) {
    if (!Object.is(this.values[this.index], value) || this.index >= this.values.length) this.changed = true;
    this.values[this.index++] = value;
  }
  array(values, tolerance = 0) {
    this.put(values?.length);
    if (values) for (let i = 0; i < values.length; i++) {
      if (tolerance && this.index < this.values.length && Math.abs(this.values[this.index] - values[i]) <= tolerance) this.index++;
      else this.put(values[i]);
    }
  }
  vector(v) { this.put(v?.x); this.put(v?.y); this.put(v?.z); this.put(v?.w); }
  color(c) { this.put(c?.r); this.put(c?.g); this.put(c?.b); }
  end() { if (this.index !== this.values.length) this.changed = true; this.values.length = this.index; return this.changed; }
  clear() { this.values.length = 0; }
}
const MATERIAL_VALUES = ['version', 'visible', 'side', 'transparent', 'opacity', 'alphaTest', 'alphaHash', 'alphaToCoverage',
  'depthWrite', 'depthTest', 'colorWrite', 'wireframe', 'roughness', 'metalness', 'transmission', 'thickness', 'ior',
  'attenuationDistance', 'envMapIntensity', 'emissiveIntensity', 'normalMapType', 'bumpScale', 'displacementScale',
  'displacementBias', 'clearcoat', 'clearcoatRoughness', 'specularIntensity', 'shininess', 'reflectivity', 'refractionRatio',
  'blending', 'blendSrc', 'blendDst', 'blendEquation', 'premultipliedAlpha', 'polygonOffset', 'polygonOffsetFactor',
  'polygonOffsetUnits', 'toneMapped', 'fog', 'flatShading', 'vertexColors', 'clipping', 'clipIntersection', 'clipShadows',
  'linewidth', 'size', 'sizeAttenuation', 'rotation', 'stencilWrite', 'stencilFunc', 'stencilRef', 'stencilZPass', 'forceSinglePass'];
const MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'emissiveMap', 'aoMap', 'lightMap',
  'envMap', 'transmissionMap', 'thicknessMap', 'bumpMap', 'displacementMap', 'clearcoatMap', 'clearcoatNormalMap',
  'clearcoatRoughnessMap', 'specularMap', 'specularColorMap', 'specularIntensityMap'];
function planes(stream, list) {
  stream.put(list?.length);
  if (list) for (const plane of list) { stream.vector(plane.normal); stream.put(plane.constant); }
}
function attribute(stream, a) {
  stream.put(a); stream.put(a?.version); stream.put(a?.data?.version); stream.put(a?.count);
}
function texture(stream, t) {
  stream.put(t);
  if (!t) return false;
  stream.put(t.version); stream.put(t.source?.version); stream.vector(t.offset); stream.vector(t.repeat);
  stream.vector(t.center); stream.put(t.rotation); stream.put(t.matrixAutoUpdate);
  if (t.matrixAutoUpdate === false) stream.array(t.matrix?.elements);
  stream.put(t.colorSpace); stream.put(t.mapping); stream.put(t.wrapS); stream.put(t.wrapT);
  return !!t.isVideoTexture;
}
function geometry(stream, g) {
  stream.put(g);
  if (!g) return;
  for (const key in g.attributes) { stream.put(key); attribute(stream, g.attributes[key]); }
  attribute(stream, g.index); stream.put(g.drawRange?.start); stream.put(g.drawRange?.count);
  stream.put(g.groups?.length);
  if (g.groups) for (const group of g.groups) { stream.put(group.start); stream.put(group.count); stream.put(group.materialIndex); }
}
function material(stream, m) {
  stream.put(m);
  if (!m) return false;
  for (const key of MATERIAL_VALUES) stream.put(m[key]);
  stream.color(m.color); stream.color(m.emissive); stream.color(m.attenuationColor); stream.color(m.specularColor); stream.color(m.specular);
  stream.vector(m.normalScale); stream.vector(m.clearcoatNormalScale);
  stream.put(m.aoMapIntensity); stream.put(m.lightMapIntensity); stream.put(m.userData?.contactShading);
  planes(stream, m.clippingPlanes);
  let animated = !!m.isShaderMaterial;
  for (const key of MAPS) animated = texture(stream, m[key]) || animated;
  return animated;
}

export class SceneRevision {
  constructor(THREE) {
    this.THREE = THREE;
    this.sceneValues = new Values(); this.shadowValues = new Values(); this.cameraValues = new Values(); this.viewportValues = new Values();
    this.revision = 0; this.invalidated = true; this.count = 0; this.dynamic = false;
    this.size = new THREE.Vector2(); this.viewport = new THREE.Vector4(); this.clearColor = new THREE.Color();
    this.materialsSeen = new Set(); this.geometriesSeen = new Set();
    this.shadowMaterialsSeen = new Set(); this.shadowGeometriesSeen = new Set();
  }
  invalidate() { this.invalidated = true; }
  inspect(scene, camera, renderer) {
    const s = this.sceneValues, h = this.shadowValues, c = this.cameraValues, v = this.viewportValues;
    s.begin(); h.begin(); c.begin(); v.begin(); this.count = 0; this.dynamic = false;
    let manualShadowUpdate = false;
    this.materialsSeen.clear(); this.geometriesSeen.clear();
    this.shadowMaterialsSeen.clear(); this.shadowGeometriesSeen.clear();
    if (scene.matrixWorldAutoUpdate !== false) scene.updateMatrixWorld();
    camera.updateWorldMatrix(true, false);
    c.put(camera); c.array(camera.matrixWorld.elements, 1e-7); c.array(camera.projectionMatrix.elements, 1e-7); c.put(camera.layers.mask);
    c.put(camera.near); c.put(camera.far); h.put(camera.layers.mask);
    s.put(scene); s.put(scene.background); s.color(scene.background); texture(s, scene.background?.isTexture ? scene.background : null);
    texture(s, scene.environment); s.put(scene.environmentIntensity); s.put(scene.backgroundIntensity); s.put(scene.backgroundBlurriness);
    s.vector(scene.environmentRotation); s.vector(scene.backgroundRotation); s.color(scene.fog?.color);
    s.put(scene.fog?.near); s.put(scene.fog?.far); s.put(scene.fog?.density);
    s.put(renderer.toneMapping); s.put(renderer.toneMappingExposure); s.put(renderer.outputColorSpace);
    renderer.getClearColor?.(this.clearColor); s.color(this.clearColor); s.put(renderer.getClearAlpha?.());
    s.put(renderer.localClippingEnabled); planes(s, renderer.clippingPlanes); planes(h, renderer.clippingPlanes);
    h.put(renderer.localClippingEnabled); h.put(renderer.shadowMap.enabled); h.put(renderer.shadowMap.type);
    renderer.getDrawingBufferSize(this.size); v.vector(this.size);
    renderer.getViewport(this.viewport); v.vector(this.viewport); v.put(renderer.getPixelRatio?.());
    const visit = object => {
      s.put(object); s.put(object.visible); if (object.visible === false) return;
      this.count++;
      s.array(object.matrixWorld.elements); s.put(object.layers.mask); s.put(object.renderOrder);
      s.put(object.castShadow); s.put(object.receiveShadow); s.put(object.frustumCulled); s.vector(object.center);
      s.put(object.userData?.contactShading); s.put(object.userData?.continuousRendering);
      if (object.isLight) {
        s.color(object.color); s.color(object.groundColor); s.put(object.intensity); s.put(object.distance); s.put(object.decay);
        s.put(object.angle); s.put(object.penumbra); s.put(object.width); s.put(object.height);
        s.array(object.target?.matrixWorld?.elements); s.vector(object.target?.position);
        if (object.castShadow) {
          h.put(object); h.array(object.matrixWorld.elements); h.vector(object.target?.position); h.array(object.target?.matrixWorld?.elements);
          const shadow = object.shadow;
          manualShadowUpdate ||= shadow?.needsUpdate === true;
          h.vector(shadow?.mapSize); h.put(shadow?.bias); h.put(shadow?.normalBias); h.put(shadow?.radius); h.put(shadow?.intensity);
          h.put(shadow?.camera?.near); h.put(shadow?.camera?.far); h.put(shadow?.camera?.left); h.put(shadow?.camera?.right);
          h.put(shadow?.camera?.top); h.put(shadow?.camera?.bottom); h.put(shadow?.camera?.zoom); h.put(shadow?.camera?.fov);
        }
      }
      if (object.geometry) {
        s.put(object.geometry);
        if (!this.geometriesSeen.has(object.geometry)) { this.geometriesSeen.add(object.geometry); geometry(s, object.geometry); }
      }
      const sources = Array.isArray(object.material) ? object.material : null;
      const record = m => {
        s.put(m);
        if (m && !this.materialsSeen.has(m)) { this.materialsSeen.add(m); this.dynamic = material(s, m) || this.dynamic; }
      };
      if (sources) { s.put(sources.length); for (const m of sources) record(m); } else record(object.material);
      if (object.castShadow && object.geometry) {
        h.put(object); h.array(object.matrixWorld.elements); h.put(object.layers.mask); h.put(object.frustumCulled);
        h.put(object.geometry);
        if (!this.shadowGeometriesSeen.has(object.geometry)) {
          this.shadowGeometriesSeen.add(object.geometry); geometry(h, object.geometry);
        }
        const shadowSources = sources || [object.material];
        h.put(shadowSources.length);
        for (const source of shadowSources) {
          h.put(source);
          if (source && !this.shadowMaterialsSeen.has(source)) {
            this.shadowMaterialsSeen.add(source); material(h, source);
          }
        }
      }
      attribute(s, object.instanceMatrix); attribute(s, object.instanceColor); s.put(object.count);
      if (object.castShadow) { attribute(h, object.instanceMatrix); h.put(object.count); }
      // These paths can animate without changing matrices or attribute versions.
      if (object.isSkinnedMesh || object.morphTargetInfluences?.length || object.customDepthMaterial || object.customDistanceMaterial
        || object.userData?.continuousRendering === true
        || object.onBeforeRender !== this.THREE.Object3D.prototype.onBeforeRender) this.dynamic = true;
      for (const child of object.children) visit(child);
    };
    visit(scene);
    const sceneChanged = s.end(), shadowChanged = h.end(), cameraChanged = c.end(), viewportChanged = v.end();
    const forced = this.invalidated; this.invalidated = false;
    const externalRender = this.lastRendererFrame !== undefined && this.lastRendererFrame !== renderer.info?.render?.frame;
    const changed = forced || manualShadowUpdate || sceneChanged || shadowChanged || cameraChanged || viewportChanged || this.dynamic || externalRender || renderer.shadowMap.needsUpdate === true;
    if (changed) this.revision++;
    return { changed, sceneChanged, cameraChanged, viewportChanged, shadowChanged: forced || manualShadowUpdate || shadowChanged || this.dynamic || externalRender,
      dynamic: this.dynamic, forced, externalRender, revision: this.revision, visibleObjects: this.count };
  }
  commit(renderer) { this.lastRendererFrame = renderer.info?.render?.frame; }
  dispose() {
    for (const stream of [this.sceneValues, this.shadowValues, this.cameraValues, this.viewportValues]) stream.clear();
    this.materialsSeen.clear(); this.geometriesSeen.clear();
    this.shadowMaterialsSeen.clear(); this.shadowGeometriesSeen.clear();
  }
}
