// Small, deterministic, seamless starter maps. No remote assets, canvas dependencies,
// licensing downloads, or custom shaders. A future scanned set can replace a provider.
const TAU = Math.PI * 2;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
function hash(x, y, seed = 37) {
  let n = Math.imul(x + seed, 374761393) ^ Math.imul(y + seed, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function noise(u, v, fx, fy, seed = 37) {
  const x = u * fx, y = v * fy;
  const ix = Math.floor(x), iy = Math.floor(y);
  const wrap = (i, size) => ((i % size) + size) % size;
  const at = (a, b) => hash(wrap(a, fx), wrap(b, fy), seed);
  const smooth = t => t * t * (3 - 2 * t);
  const tx = smooth(x - ix), ty = smooth(y - iy);
  const a = at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx;
  const b = at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx;
  return a * (1 - ty) + b * ty;
}

export function createSurfacePixels(kind, size) {
  const height = new Float32Array(size * size);
  const color = kind === 'oak' ? new Uint8Array(size * size * 4) : null;
  const roughness = new Uint8Array(size * size * 4);
  const normal = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size, v = y / size, i = y * size + x, p = i * 4;
      let h, r;
      if (kind === 'oak') {
        // Grain runs along U. Periodic slow warping gives non-straight growth lines.
        const warp = 0.12 * Math.sin(TAU * u) + 0.045 * Math.sin(TAU * (u * 3 + v * 2));
        const broad = noise(u, v, 4, 13, 11);
        const rings = Math.sin(TAU * (v * 14 + warp));
        const pores = Math.pow(Math.max(0, Math.sin(TAU * (v * 58 + warp * 3))), 12);
        const fibre = noise(u, v, 12, 100, 19);
        h = 0.55 * broad + 0.18 * rings - 0.12 * pores + 0.08 * fibre;
        const tone = clamp(0.62 + broad * 0.23 + rings * 0.045 - pores * 0.075 + fibre * 0.05, 0.45, 0.98);
        color[p] = Math.round(220 * tone);
        color[p + 1] = Math.round(170 * tone);
        color[p + 2] = Math.round(113 * tone);
        color[p + 3] = 255;
        r = 0.86 + broad * 0.12 - pores * 0.04;
      } else if (kind === 'brushed') {
        h = noise(u, v, 3, 110) * 0.78 + noise(u, v, 12, 52, 73) * 0.22;
        r = 0.87 + h * 0.13;
      } else {
        h = noise(u, v, 62, 62) * 0.7 + noise(u, v, 110, 110, 19) * 0.3;
        r = 0.87 + h * 0.13;
      }
      height[i] = h;
      roughness[p] = roughness[p + 1] = roughness[p + 2] = Math.round(clamp(r, 0, 1) * 255);
      roughness[p + 3] = 255;
    }
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const p = (y * size + x) * 4;
      const dx = height[y * size + (x + 1) % size] - height[y * size + (x + size - 1) % size];
      const dy = height[((y + 1) % size) * size + x] - height[((y + size - 1) % size) * size + x];
      const length = Math.hypot(dx, dy, 1);
      normal[p] = Math.round((-dx / length * 0.5 + 0.5) * 255);
      normal[p + 1] = Math.round((-dy / length * 0.5 + 0.5) * 255);
      normal[p + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
      normal[p + 3] = 255;
    }
  }
  return { color, roughness, normal };
}

export class SurfaceTextures {
  constructor(THREE) {
    this.THREE = THREE;
    this.cache = new Map();
    this.providers = new Map();
    for (const kind of ['powder', 'brushed', 'oak']) {
      this.providers.set(kind, () => ({ size: kind === 'oak' ? 512 : 256, ...createSurfacePixels(kind, kind === 'oak' ? 512 : 256) }));
    }
  }
  register(name, provider) {
    if (this.providers.has(name)) throw new Error(`Texture provider already registered: ${name}`);
    if (typeof provider !== 'function') throw new TypeError('A texture provider must be a function.');
    this.providers.set(name, provider);
  }
  get(name, tile = [1, 1]) {
    if (!Array.isArray(tile) || tile.length !== 2 || !tile.every(value => Number.isFinite(value) && value > 0)) {
      throw new Error('Surface tile dimensions must be two positive metre values.');
    }
    const key = `${name}:${tile.join(',')}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Unknown texture provider: ${name}`);
    const { THREE } = this;
    const data = provider(THREE);
    const maps = {};
    for (const role of ['color', 'roughness', 'normal']) {
      if (!data[role]) continue;
      const texture = data[role].isTexture
        ? data[role].clone()
        : new THREE.DataTexture(data[role], data.size, data.size, THREE.RGBAFormat, THREE.UnsignedByteType);
      texture.name = `360:${name}:${role}`;
      texture.colorSpace = role === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1 / tile[0], 1 / tile[1]);
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
      maps[role] = texture;
    }
    this.cache.set(key, maps);
    return maps;
  }
  setAnisotropy(value) {
    for (const maps of this.cache.values()) {
      for (const texture of Object.values(maps)) {
        if (texture.anisotropy === value) continue;
        texture.anisotropy = value;
        texture.needsUpdate = true;
      }
    }
  }
  get size() { return [...this.cache.values()].reduce((sum, maps) => sum + Object.keys(maps).length, 0); }
  dispose() {
    for (const maps of this.cache.values()) Object.values(maps).forEach(texture => texture.dispose());
    this.cache.clear();
  }
}
