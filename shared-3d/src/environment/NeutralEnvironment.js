// A neutral, generated HDR reflection probe. It is not the visible background and
// does not pretend to contain dynamic objects from the user's scene.
function createProbe(THREE, width) {
  const height = width / 2;
  const data = new Uint16Array(width * height * 4);
  const positive = value => Math.max(0, value);
  // DataTexture row zero is v=0 (the lower hemisphere in Three equirectangular UVs).
  for (let y = 0; y < height; y += 1) {
    const theta = Math.PI * (y + 0.5) / height;
    for (let x = 0; x < width; x += 1) {
      const phi = Math.PI * 2 * (x + 0.5) / width;
      const dx = Math.sin(theta) * Math.cos(phi), dy = -Math.cos(theta), dz = Math.sin(theta) * Math.sin(phi);
      const base = 0.11 + 0.42 * positive(dy) + 0.06 * (1 - Math.abs(dy));
      const key = 3.0 * Math.pow(positive(dx * 0.65 + dy * 0.7 + dz * 0.3), 28);
      const rim = 1.9 * Math.pow(positive(-dx * 0.8 + dy * 0.5 - dz * 0.3), 36);
      const sky = 0.5 * Math.pow(positive(dy), 3);
      const p = (y * width + x) * 4;
      data[p] = THREE.DataUtils.toHalfFloat(base + key + rim + sky);
      data[p + 1] = THREE.DataUtils.toHalfFloat(base + key + rim + sky * 1.02);
      data[p + 2] = THREE.DataUtils.toHalfFloat(base + key + rim + sky * 1.05);
      data[p + 3] = THREE.DataUtils.toHalfFloat(1);
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export class NeutralEnvironment {
  constructor(THREE, renderer, scene) {
    this.THREE = THREE;
    this.renderer = renderer;
    this.scene = scene;
    this.previous = scene.environment;
    this.target = null;
    this.width = 0;
  }
  setQuality(profile) {
    if (this.width === profile.environmentWidth && this.target) return;
    const source = createProbe(this.THREE, profile.environmentWidth);
    let generator;
    try {
      generator = new this.THREE.PMREMGenerator(this.renderer);
      const next = generator.fromEquirectangular(source);
      next.texture.name = '360:neutral-reflections-v1';
      const old = this.target;
      this.target = next;
      this.scene.environment = next.texture;
      this.width = profile.environmentWidth;
      old?.dispose();
    } finally {
      source.dispose();
      generator?.dispose();
    }
  }
  dispose() {
    if (this.scene.environment === this.target?.texture) this.scene.environment = this.previous;
    this.target?.dispose();
    this.target = null;
  }
}
