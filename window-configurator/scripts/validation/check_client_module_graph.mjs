import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(import.meta.dirname, '..', '..');
const clientRoot = path.join(projectRoot, 'src', 'client');
const moduleCache = new Map();

const context = vm.createContext({
    console,
    URL,
    URLSearchParams,
    TextDecoder,
    TextEncoder,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    performance,
});
context.globalThis = context;

function resolveModuleSpecifier(specifier, referencingIdentifier) {
    if (specifier === 'three') {
        return pathToFileURL(path.join(clientRoot, 'lib', 'three.module.js')).href;
    }
    if (specifier.startsWith('three/addons/')) {
        const relativePath = specifier.slice('three/addons/'.length);
        return pathToFileURL(path.join(clientRoot, 'lib', relativePath)).href;
    }
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
        return new URL(specifier, referencingIdentifier).href;
    }
    throw new Error(
        `Unsupported browser module specifier "${specifier}" from ${referencingIdentifier}`
    );
}

async function loadModule(moduleUrl) {
    if (moduleCache.has(moduleUrl)) {
        return moduleCache.get(moduleUrl);
    }

    let filePath = fileURLToPath(moduleUrl);
    const shared3dPrefix = path.join(clientRoot, 'shared-3d') + path.sep;
    if (filePath.startsWith(shared3dPrefix)) {
        filePath = path.join(projectRoot, '..', 'shared-3d', filePath.slice(shared3dPrefix.length));
    }
    const source = fs.readFileSync(filePath, 'utf8');
    const module = new vm.SourceTextModule(source, {
        context,
        identifier: moduleUrl,
        initializeImportMeta(meta) {
            meta.url = moduleUrl;
        },
    });

    moduleCache.set(moduleUrl, module);
    await module.link((specifier, referencingModule) =>
        loadModule(resolveModuleSpecifier(specifier, referencingModule.identifier))
    );
    return module;
}

const sharedThreeModule = await loadModule(
    pathToFileURL(path.join(clientRoot, 'lib', 'three.module.js')).href
);
if (sharedThreeModule.status === 'linked') {
    await sharedThreeModule.evaluate();
}

const targetFiles = [
    'js/profile-catalog.js',
    'js/profile-compatibility.js',
    'js/accessory-controller.js',
    'js/profile-selection-controller.js',
    'js/profile-composition.js',
    'js/config.js',
    'js/profile-loader.js',
    'js/profile-controller.js',
    'js/materials.js',
    'js/window-builder.js',
    'js/window-summary.js',
];

for (const relativePath of targetFiles) {
    const module = await loadModule(pathToFileURL(path.join(clientRoot, relativePath)).href);
    if (module.status === 'linked') {
        await module.evaluate();
    }
}

console.log(
    `Client module graph valid: ${targetFiles.length} entry modules, `
    + `${moduleCache.size} total linked modules.`
);
