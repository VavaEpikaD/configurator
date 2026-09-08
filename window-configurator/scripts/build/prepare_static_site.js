const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const projectRoot = path.resolve(__dirname, '..', '..');
const workspaceRoot = path.resolve(projectRoot, '..');
const sourceRoot = path.join(projectRoot, 'src', 'client');
const distRoot = path.join(projectRoot, 'dist', 'site');
const headersSource = path.join(workspaceRoot, 'netlify', '_headers');
const sharedUiSource = path.join(workspaceRoot, 'shared-ui');
const shared3dSource = path.join(workspaceRoot, 'shared-3d');

function gitShortHash() {
    try {
        return childProcess.execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
            cwd: projectRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    } catch (_error) {
        return 'nogit';
    }
}

const generatedAt = new Date();
const date = generatedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const hash = gitShortHash();
const build = `${date}-${hash}`;

const sourceIndex = path.join(sourceRoot, 'index.html');
if (!fs.existsSync(sourceIndex)) {
    throw new Error(`Missing client entry point: ${sourceIndex}`);
}

// Keep manually published fallback models across local rebuilds.
const preservedModels = path.join(projectRoot, '.dist-models-preserved');
const currentModels = path.join(distRoot, 'models');
fs.rmSync(preservedModels, { recursive: true, force: true });
if (fs.existsSync(currentModels)) {
    fs.cpSync(currentModels, preservedModels, { recursive: true, force: true });
}

fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(path.dirname(distRoot), { recursive: true });
fs.cpSync(sourceRoot, distRoot, { recursive: true, force: true });

if (fs.existsSync(sharedUiSource)) {
    fs.cpSync(sharedUiSource, path.join(distRoot, 'shared-ui'), { recursive: true, force: true });
}

if (!fs.existsSync(path.join(shared3dSource, 'src', 'index.js'))) {
    throw new Error('Missing shared-3d material library. Apply the complete material update at the repository root.');
}
fs.cpSync(path.join(shared3dSource, 'src'), path.join(distRoot, 'shared-3d', 'src'), { recursive: true });

if (fs.existsSync(preservedModels)) {
    fs.cpSync(preservedModels, path.join(distRoot, 'models'), { recursive: true, force: true });
    fs.rmSync(preservedModels, { recursive: true, force: true });
} else {
    fs.mkdirSync(path.join(distRoot, 'models'), { recursive: true });
    fs.writeFileSync(path.join(distRoot, 'models', '.gitkeep'), '');
}

let html = fs.readFileSync(path.join(distRoot, 'index.html'), 'utf8');
html = html.replace(
    /<meta name="app-build" content="[^"]*">/,
    `<meta name="app-build" content="${build}">`
);
fs.writeFileSync(path.join(distRoot, 'index.html'), html);

if (fs.existsSync(headersSource)) {
    fs.copyFileSync(headersSource, path.join(distRoot, '_headers'));
}

const version = {
    build,
    baseCommit: hash,
    channel: 'production-dual-platform-supabase-ar',
    generatedAt: generatedAt.toISOString(),
    architecture: 'production configurator -> selected GLB or USDZ browser export -> Netlify upload ticket -> direct Supabase Storage upload -> Scene Viewer or Quick Look'
};
fs.writeFileSync(path.join(distRoot, 'version.json'), `${JSON.stringify(version, null, 2)}\n`);
fs.writeFileSync(path.join(distRoot, '.nojekyll'), '');

console.log(`Prepared dist/site build ${build}`);
console.log('Source: src/client');
console.log('Output: dist/site');
