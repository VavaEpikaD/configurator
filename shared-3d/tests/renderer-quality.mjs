import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../../window-configurator/src/client/lib/three.module.js';
import { createSurfaceSystem } from '../src/index.js';
import { NeutralEnvironment } from '../src/environment/NeutralEnvironment.js';

// Tests renderer integration and resource ownership with a GPU-independent PMREM
// double. These are deliberately NOT advertised as a WebGL/rendered visual test.
function context() {
  const probes = [];
  class PMREMGenerator {
    fromEquirectangular(source) {
      const item = { texture: new THREE.Texture(), disposed: false, width: source.image.width };
      item.dispose = () => { item.disposed = true; };
      probes.push({ source, target: item });
      return item;
    }
    dispose() {}
  }
  const engine = { ...THREE, PMREMGenerator };
  const scene = new THREE.Scene();
  const light = new THREE.DirectionalLight(); scene.add(light);
  const renderer = {
    capabilities: { getMaxAnisotropy: () => 4 },
    domElement: { dataset: {} }, shadowMap: { enabled: false },
    setPixelRatio(value) { this.pixelRatio = value; },
  };
  const system = createSurfaceSystem(engine, { renderer, scene, shadowLights: [light] });
  return { scene, light, renderer, system, probes };
}

test('all three tiers update raster, shadows, reflections and material features', () => {
  const { renderer, light, system } = context();
  const glass = system.materials.create('glass.clear');
  system.setQuality('low', { devicePixelRatio: 3 });
  assert.equal(renderer.pixelRatio, 1); assert.equal(renderer.shadowMap.enabled, false);
  assert.equal(glass.transmission, 0);
  system.setQuality('high', { devicePixelRatio: 3 });
  assert.equal(renderer.pixelRatio, 2); assert.equal(light.shadow.mapSize.x, 2048);
  assert.equal(light.castShadow, true); assert.ok(glass.transmission > 0);
  assert.equal(system.getDiagnostics().profile.environmentWidth, 1024);
  system.dispose();
});
test('repeated same-tier/resize requests do not recreate environments', () => {
  const { system, probes } = context();
  const initialCount = probes.length;
  system.setQuality('balanced', { devicePixelRatio: 1 });
  assert.equal(probes.length, initialCount);
  system.setQuality('balanced', { devicePixelRatio: 1, compact: true });
  assert.equal(probes.length, initialCount);
  system.setQuality('high'); assert.ok(probes[0].target.disposed);
  system.dispose(); assert.ok(probes.at(-1).target.disposed);
});
test('resized shadow targets are disposed and nulled before the next render', () => {
  const { light, system } = context();
  let disposed = 0;
  light.shadow.map = { dispose() { disposed++; } };
  system.setQuality('high');
  assert.equal(disposed, 1); assert.equal(light.shadow.map, null);
  system.dispose();
});
test('HDR probe puts sky in the positive-Y hemisphere, not beneath the model', () => {
  const { system, probes } = context();
  const { image } = probes[0].source;
  const averageRow = row => {
    let result = 0;
    for (let x = 0; x < image.width; x++) result += THREE.DataUtils.fromHalfFloat(image.data[(row * image.width + x) * 4]);
    return result / image.width;
  };
  assert.ok(averageRow(image.height - 1) > averageRow(0) * 3);
  system.dispose();
});
test('night affects both new and legacy surfaces, then restores daylight without compounding', () => {
  const { scene, system } = context();
  const newMaterial = system.materials.create('aluminium.powderCoated');
  const legacyMaterial = new THREE.MeshStandardMaterial({ envMapIntensity: 0.8 });
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), newMaterial));
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), legacyMaterial));
  system.setEnvironmentIntensity(0.12); system.setEnvironmentIntensity(0.12);
  assert.equal(newMaterial.envMapIntensity, 0.12); assert.equal(legacyMaterial.envMapIntensity, 0.096);
  system.setEnvironmentIntensity(1);
  assert.equal(newMaterial.envMapIntensity, 1); assert.equal(legacyMaterial.envMapIntensity, 0.8);
  system.dispose();
});
test('dispose restores a pre-existing environment and prevents later mutations', () => {
  const { scene, system } = context();
  system.dispose();
  assert.equal(scene.environment, null);
  assert.equal(system.setQuality('high'), false);
  assert.equal(system.materials.getDiagnostics().materialCount, 0);
});

test('failed reflection allocation preserves the previous probe and can be retried', () => {
  let fail = false;
  const targets = [];
  class PMREMGenerator {
    fromEquirectangular() {
      if (fail) throw new Error('simulated allocation failure');
      const target = { texture: new THREE.Texture(), disposed: false, dispose() { this.disposed = true; } };
      targets.push(target); return target;
    }
    dispose() {}
  }
  const scene = new THREE.Scene();
  const original = new THREE.Texture(); scene.environment = original;
  const environment = new NeutralEnvironment({ ...THREE, PMREMGenerator }, {}, scene);
  environment.setQuality({ environmentWidth: 256 });
  fail = true;
  assert.throws(() => environment.setQuality({ environmentWidth: 512 }), /allocation failure/);
  assert.equal(scene.environment, targets[0].texture);
  assert.equal(targets[0].disposed, false);
  assert.equal(environment.width, 256);
  fail = false; environment.setQuality({ environmentWidth: 512 });
  assert.equal(targets[0].disposed, true);
  environment.dispose(); assert.equal(scene.environment, original);
});

test('scene teardown releases owned geometry once, without disposing it on a quality change', () => {
  const { scene, system } = context();
  const material = system.materials.create('aluminium.powderCoated');
  const geometry = system.geometry.create('primitive.box', { width: 2, height: 0.2, depth: 0.1 });
  const mesh = system.geometry.mesh(geometry, material, { uv: { grainAxis: 'x' } });
  scene.add(mesh);
  const before = Array.from(geometry.getAttribute('position').array);
  let disposed = 0;
  geometry.addEventListener('dispose', () => { disposed++; });
  for (const tier of ['low', 'balanced', 'high', 'low']) {
    system.setQuality(tier);
    assert.equal(mesh.geometry, geometry);
    assert.deepEqual(Array.from(geometry.getAttribute('position').array), before);
    assert.equal(system.getDiagnostics().geometry.geometryCount, 1);
    assert.equal(disposed, 0);
  }
  assert.equal(system.getDiagnostics().geometry.version, system.getDiagnostics().version);
  system.dispose(); system.dispose();
  assert.equal(disposed, 1);
  assert.equal(system.getDiagnostics().geometry.geometryCount, 0);
});

test('a manually disposed product buffer is not retained or disposed again at scene teardown', () => {
  const { system } = context();
  const geometry = system.geometry.create('panel.rectangular', { width: 1, height: 2, thickness: 0.02 });
  let disposed = 0;
  geometry.addEventListener('dispose', () => { disposed++; });
  geometry.dispose();
  assert.equal(system.geometry.getDiagnostics().geometryCount, 0);
  system.dispose();
  assert.equal(disposed, 1);
});
