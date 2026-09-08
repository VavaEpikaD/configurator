/** Local-only WebGL smoke test. It does not visit production or load account UI.
 * Requires Playwright + Chromium; see EDGE_FINISHES.md for software-render setup.
 * Window: real vendored engine, shared materials and generated edge components.
 * Pergola: real PergolaScene + local GLB assets, with its installed Three version.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../window-configurator/package.json', import.meta.url));
const { chromium } = require('playwright');
const pergolaRequire = createRequire(new URL('../../pergola-configurator/package.json', import.meta.url));
const pergolaThree = path.dirname(path.dirname(pergolaRequire.resolve('three')));
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Access-Control-Allow-Origin': '*' }); res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const url = file => `${base}/${file.replaceAll(path.sep, '/')}`;
const common = `${base}/shared-3d/src/index.js?v=4`;
const sources = {
  window: {
    imports: { three: url('window-configurator/src/client/js/three-mesh-reuse.js?v=1'), 'three/addons/': url('window-configurator/src/client/lib/') },
    base: url('window-configurator/src/client/'),
    code: `
      const THREE = await import('three');
      const {createSurfaceSystem, createRoundedRectangleShape, getEdgeFinish} = await import('${common}');
      const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf1f3f5);
      const camera = new THREE.PerspectiveCamera(35, innerWidth/innerHeight, .005, 10);
      camera.position.set(.12,.1,.32); camera.lookAt(0,0,0);
      const renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setSize(innerWidth,innerHeight); document.body.appendChild(renderer.domElement);
      const light = new THREE.DirectionalLight(0xffffff,3); light.position.set(2,3,4); scene.add(light);
      scene.add(new THREE.AmbientLight(0xffffff,.3));
      const system = createSurfaceSystem(THREE,{renderer,scene,shadowLights:[light]});
      const powder = system.materials.create('aluminium.powderCoated',{color:'#383e42'});
      const shape = createRoundedRectangleShape(THREE,.04,.1,.027);
      const geometry = system.geometry.create('profile.beveledSolid',{shape,settings:{depth:.005,curveSegments:20},...getEdgeFinish('aluminium.handle')});
      const plate = system.geometry.mesh(geometry,powder); plate.position.x=-.035;scene.add(plate);
      const post = system.geometry.create('profile.roundedRectangle',{width:.04,height:.15,depth:.025,axis:'y',...getEdgeFinish('aluminium.frame')});
      const mesh = system.geometry.mesh(post,powder);mesh.position.x=.035;scene.add(mesh);
      // Exercise physical-transmission shader compilation beside the opaque bevels.
      const pane = system.geometry.mesh(system.geometry.create('panel.rectangular',{width:.02,height:.08,thickness:.004}),system.materials.create('glass.clear'));
      pane.position.set(.08,0,-.02);scene.add(pane);
      window.smoke = {renderer,scene,camera,system,setQuality:q=>system.setQuality(q),dispose:()=>{system.dispose();renderer.dispose();}};
    `,
  },
  pergola: {
    imports: { three: url(path.relative(root, path.join(pergolaThree, 'build/three.module.js'))), 'three/addons/': url(`${path.relative(root, pergolaThree)}/examples/jsm/`) },
    base: url('pergola-configurator/public/'),
    code: `
      const {PergolaScene} = await import('${url('pergola-configurator/src/scene/PergolaScene.js')}');
      const {ConfiguratorStore} = await import('${url('pergola-configurator/src/state.js')}');
      const store = new ConfiguratorStore({quality:'balanced',view:{dimensionsVisible:false}});
      const app = new PergolaScene(document.getElementById('scene'),store);
      cancelAnimationFrame(app.animationFrame); app.controls.enableDamping=false;
      await app.assets.ready;
      await new Promise(resolve=>setTimeout(resolve,300));
      cancelAnimationFrame(app.animationFrame);app.dimensionGroup.visible=false;
      app.controls.update();
      window.smoke = {renderer:app.renderer,scene:app.scene,camera:app.camera,system:app.surfaceSystem,
        assetErrors:[...app.assets.errors.keys()],setQuality:q=>app.applyQuality(q),dispose:()=>app.dispose()};
    `,
  },
};
let browser;
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
    args: process.env.SOFTWARE_WEBGL === '1' ? ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] : [],
  });
  for (const [name, source] of Object.entries(sources)) {
    const page = await browser.newPage({viewport:{width:800,height:600}}), errors=[];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type()==='error') errors.push(message.text()); });
    await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    // setContent also works in restricted CI where top-level URL navigation is unavailable.
    await page.setContent(`<!doctype html><html><head><base href="${source.base}"><style>html,body,#scene{margin:0;width:100%;height:100%;overflow:hidden}#scene{position:relative}.dimension-layer{display:none}</style><script type="importmap">${JSON.stringify({imports:source.imports})}</script></head><body><div id="scene"></div><script type="module">${source.code}</script></body></html>`);
    await page.waitForFunction(()=>!!window.smoke,{}, {timeout:90000});
    const reports=[];
    for (const quality of ['low','balanced','high']) {
      const report = await page.evaluate(quality => {
        const s=window.smoke;s.setQuality(quality);s.renderer.render(s.scene,s.camera);
        const gl=s.renderer.getContext();
        return {diagnostics:s.system.getDiagnostics(),webgl2:s.renderer.capabilities.isWebGL2,
          programsLinked:s.renderer.info.programs.every(p=>gl.getProgramParameter(p.program,gl.LINK_STATUS)),
          contextLost:gl.isContextLost(),assetErrors:s.assetErrors??[],render:{...s.renderer.info.render}};
      }, quality);
      assert.equal(report.contextLost,false);assert.equal(report.programsLinked,true);
      assert.equal(report.diagnostics.environmentError,null);assert.equal(report.diagnostics.quality,quality);
      assert.equal(report.diagnostics.surfaceDetailEnabled,quality!=='low');
      assert.deepEqual(report.assetErrors,[]);reports.push(report);
      if (process.env.VISUAL_OUTPUT_DIR) {
        await mkdir(process.env.VISUAL_OUTPUT_DIR,{recursive:true});
        const png=await page.evaluate(()=>{const s=window.smoke;s.renderer.render(s.scene,s.camera);return s.renderer.domElement.toDataURL('image/png');});
        await writeFile(path.join(process.env.VISUAL_OUTPUT_DIR,`${name}-${quality}.png`),Buffer.from(png.split(',')[1],'base64'));
      }
    }
    assert.ok(reports.every(report=>report.diagnostics.geometry.geometryCount===reports[0].diagnostics.geometry.geometryCount));
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({scene:name,reports},null,2));
    // Closing the page tears down the context. Production cleanup has separate unit coverage.
    await page.close();
  }
} finally {
  await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
