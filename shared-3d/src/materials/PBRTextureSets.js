/** Asynchronous, scene-owned PBR assets. A complete set replaces its fallback
 * atomically. Texture instances belong to a UV-scale variant; decoded images are
 * shared by URL. Retired requests may finish, but can never attach to a material.
 * No renderer, product state, remote service, or engine singleton is imported.
 */
const ROLES = ['color', 'normal', 'roughness'];

export class PBRTextureSets {
  constructor(THREE, { sets = {}, enabled = true, loadTexture = null, timeoutMs = 15000 } = {}) {
    this.THREE = THREE;
    this.enabled = enabled && (typeof loadTexture === 'function' || typeof globalThis.document?.createElementNS === 'function');
    this.loadTexture = loadTexture ?? (url => new THREE.TextureLoader().loadAsync(url));
    this.timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000;
    this.definitions = new Map();
    this.sources = new Map();
    this.entries = new Map();
    this.anisotropy = 1;
    this.disposed = false;
    for (const [id, definition] of Object.entries(sets)) this.register(id, definition);
  }

  register(id, definition) {
    if (this.disposed) throw new Error('PBR texture assets have been disposed.');
    if (!id || this.definitions.has(id)) throw new Error(`Invalid or duplicate texture set: ${id}`);
    if (!definition?.detail) throw new TypeError('A texture set requires a detail tier.');
    const result = {};
    for (const tier of ['low', 'detail']) {
      const source = definition[tier];
      if (!source) continue;
      const roles = Object.keys(source.maps ?? {});
      if (!roles.length || roles.some(role => !ROLES.includes(role))) throw new TypeError('Unsupported or empty PBR map roles.');
      if (roles.some(role => typeof source.maps[role] !== 'string' || !source.maps[role])) throw new TypeError('PBR maps require non-empty URL strings.');
      if (!Number.isInteger(source.size) || source.size < 1) throw new TypeError('A positive source image size is required.');
      if (tier === 'low' && roles.some(role => role !== 'color')) throw new TypeError('Low texture tier may contain only a color map.');
      result[tier] = Object.freeze({ size: source.size, flipY: source.flipY !== false, maps: Object.freeze({ ...source.maps }) });
    }
    this.definitions.set(id, Object.freeze(result));
    return this;
  }

  selection(id, quality, tile = [1, 1]) {
    if (!Array.isArray(tile) || tile.length !== 2 || !tile.every(n => Number.isFinite(n) && n > 0)) throw new RangeError('PBR tile dimensions must be positive metres.');
    if (!this.definitions.has(id)) throw new Error(`Unknown PBR texture set: ${id}`);
    const tier = quality === 'low' ? 'low' : 'detail';
    const definition = this.definitions.get(id)[tier];
    if (!this.enabled || this.disposed || !definition) return null;
    return { key: `${id}:${tier}:${tile.join(',')}`, id, tier, definition, tile: [...tile] };
  }

  // Shared source lease. Load failures resolve as data, never unhandled rejections.
  acquireSource(url) {
    let source = this.sources.get(url);
    if (!source) {
      source = { url, refs: 0, texture: null, retired: false, error: null };
      this.sources.set(url, source);
      source.promise = new Promise(resolve => {
        let settled = false;
        const finish = (texture, error = null) => {
          if (settled) { texture?.dispose(); return; }
          settled = true; clearTimeout(timer);
          source.texture = texture; source.error = error;
          resolve(source);
        };
        const timer = setTimeout(() => finish(null, `Texture load timed out: ${url}`), this.timeoutMs);
        source.cancel = () => finish(null, 'Texture request retired.');
        Promise.resolve().then(() => this.loadTexture(url)).then(texture => {
          if (!texture?.isTexture || !(texture.image?.width > 0 && texture.image?.height > 0)) {
            texture?.dispose?.(); finish(null, `Invalid texture image: ${url}`); return;
          }
          if (source.retired || this.disposed) { texture.dispose(); finish(null, 'Texture request retired.'); return; }
          finish(texture);
        }, error => finish(null, error?.message || `Texture load failed: ${url}`));
      });
    }
    source.refs++;
    let released = false;
    return {
      promise: source.promise,
      release: () => {
        if (released) return;
        released = true;
        if (--source.refs > 0) return;
        source.retired = true;
        if (this.sources.get(url) === source) this.sources.delete(url);
        source.cancel?.(); source.texture?.dispose(); source.texture = null;
      },
    };
  }

  acquire(id, quality, tile, onChange = () => {}) {
    const choice = this.selection(id, quality, tile);
    if (!choice) return null;
    let entry = this.entries.get(choice.key);
    if (!entry) {
      entry = { ...choice, status: 'loading', error: null, maps: null, subscribers: new Set(), sources: [], retired: false };
      this.entries.set(entry.key, entry);
      this.start(entry);
    }
    const subscriber = { onChange };
    entry.subscribers.add(subscriber);
    let released = false;
    return {
      key: entry.key,
      get status() { return entry.status; },
      get maps() { return entry.maps; },
      get error() { return entry.error; },
      release: () => {
        if (released) return;
        released = true; entry.subscribers.delete(subscriber);
        if (!entry.subscribers.size) this.retire(entry);
      },
    };
  }

  start(entry) {
    const roles = Object.keys(entry.definition.maps);
    entry.sources = roles.map(role => this.acquireSource(entry.definition.maps[role]));
    entry.promise = Promise.all(entry.sources.map(source => source.promise)).then(sources => {
      if (entry.retired || this.disposed) return;
      try {
        const failed = sources.find(source => source.error || !source.texture);
        if (failed) throw new Error(failed.error || 'Texture source is unavailable.');
        const maps = {};
        try {
          roles.forEach((role, index) => {
            const texture = sources[index].texture.clone();
            maps[role] = texture;
            if (texture.image.width !== entry.definition.size || texture.image.height !== entry.definition.size) {
              throw new Error(`Unexpected dimensions for ${entry.id}:${role}`);
            }
            texture.name = `360:pbr:${entry.id}:${entry.tier}:${role}`;
            texture.colorSpace = role === 'color' ? this.THREE.SRGBColorSpace : this.THREE.NoColorSpace;
            texture.flipY = entry.definition.flipY;
            texture.wrapS = texture.wrapT = this.THREE.RepeatWrapping;
            texture.repeat.set(1 / entry.tile[0], 1 / entry.tile[1]);
            texture.magFilter = this.THREE.LinearFilter;
            texture.minFilter = this.THREE.LinearMipmapLinearFilter;
            texture.generateMipmaps = true;
            texture.anisotropy = this.anisotropy;
            texture.needsUpdate = true;
          });
        } catch (error) { Object.values(maps).forEach(texture => texture.dispose()); throw error; }
        entry.maps = maps; entry.status = 'ready';
      } catch (error) {
        entry.status = 'failed'; entry.error = error?.message || String(error);
        entry.sources.forEach(source => source.release()); entry.sources = [];
      }
      // A listener may release a lease or dispose the scene; use a snapshot.
      for (const subscriber of [...entry.subscribers]) {
        if (!entry.subscribers.has(subscriber)) continue;
        try { subscriber.onChange(); } catch (error) { console.warn('PBR texture listener failed.', error); }
      }
    });
  }

  retire(entry) {
    if (entry.retired) return;
    entry.retired = true;
    this.entries.delete(entry.key);
    Object.values(entry.maps ?? {}).forEach(texture => texture.dispose());
    entry.maps = null;
    entry.sources.forEach(source => source.release()); entry.sources = [];
    entry.subscribers.clear();
  }

  setAnisotropy(value) {
    this.anisotropy = Math.max(1, Number(value) || 1);
    for (const entry of this.entries.values()) for (const texture of Object.values(entry.maps ?? {})) {
      if (texture.anisotropy === this.anisotropy) continue;
      texture.anisotropy = this.anisotropy; texture.needsUpdate = true;
    }
  }

  async whenIdle() {
    while (!this.disposed) {
      const pending = [...this.entries.values()].filter(entry => entry.status === 'loading');
      if (!pending.length) break;
      await Promise.all(pending.map(entry => entry.promise));
    }
    return this.getDiagnostics();
  }

  getDiagnostics() {
    const sets = [...this.entries.values()].map(entry => ({ id: entry.id, tier: entry.tier, size: entry.definition.size,
      tileMetres: [...entry.tile], status: entry.status, error: entry.error, consumers: entry.subscribers.size,
      roles: Object.keys(entry.definition.maps) }));
    return { enabled: this.enabled && !this.disposed, status: this.disposed ? 'disposed' : !this.enabled ? 'disabled' :
      sets.some(set => set.status === 'loading') ? 'loading' : sets.some(set => set.status === 'failed') ? 'fallback' : 'ready',
      pendingSets: sets.filter(set => set.status === 'loading').length, failedSets: sets.filter(set => set.status === 'failed').length,
      sourceImageCount: this.sources.size, textureCount: [...this.entries.values()].reduce((n, entry) => n + Object.keys(entry.maps ?? {}).length, 0), sets };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const entry of [...this.entries.values()]) this.retire(entry);
  }
}
