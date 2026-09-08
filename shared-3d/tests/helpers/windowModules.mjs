import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Load the native Window module graph with its actual browser path mappings. */
export function createWindowModuleLoader({ root = fileURLToPath(new URL('../../../', import.meta.url)), globals = {}, meshReuse = false } = {}) {
  const client = path.join(root, 'window-configurator/src/client');
  const context = vm.createContext({ console, URL, URLSearchParams, TextDecoder, TextEncoder,
    setTimeout, clearTimeout, queueMicrotask, performance, ...globals });
  context.globalThis = context;
  const cache = new Map();
  function load(url) {
    if (cache.has(url)) return cache.get(url);
    let local = fileURLToPath(url);
    const virtual = path.join(client, 'shared-3d') + path.sep;
    if (local.startsWith(virtual)) local = path.join(root, 'shared-3d', local.slice(virtual.length));
    const module = new vm.SourceTextModule(fs.readFileSync(local, 'utf8'), { context, identifier: url,
      initializeImportMeta(meta) { meta.url = url; } });
    cache.set(url, module);
    return module;
  }
  function resolve(specifier, parent) {
    if (specifier === 'three') return load(pathToFileURL(path.join(client, meshReuse ? 'js/three-mesh-reuse.js' : 'lib/three.module.js')).href);
    if (specifier.startsWith('three/addons/')) return load(pathToFileURL(path.join(client, 'lib', specifier.slice(13))).href);
    return load(new URL(specifier, parent.identifier).href);
  }
  return {
    context,
    async import(relativePath) {
      const module = load(new URL(relativePath, pathToFileURL(root + path.sep)).href);
      if (module.status === 'unlinked') await module.link(resolve);
      if (module.status === 'linked') await module.evaluate();
      return module.namespace;
    },
  };
}
