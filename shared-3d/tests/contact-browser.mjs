/** Local-only rendered acceptance checks. No account UI, production requests or writes.
 * Window uses the real client entry point and its production CAD SVG/JSON inputs.
 * Pergola uses the real PergolaScene, store and local GLB assets.
 * Test-only main.js instrumentation exposes scene references and pauses the loop;
 * production sources, cameras, builders, materials and GLSL are not substituted.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('playwright');
const pergolaRequire = createRequire(new URL('../../pergola-configurator/package.json', import.meta.url));
const pergolaThree = path.dirname(path.dirname(pergolaRequire.resolve('three')));
const output = process.env.VISUAL_OUTPUT_DIR;
const server = createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    let relative = decodeURIComponent(u.pathname).slice(1);
    if (relative === 'api/cad-screenshots') {
      const profile = u.searchParams.get('profile');
      if (!/^[A-Za-z0-9_ -]+$/.test(profile || '')) { res.writeHead(400).end(); return; }
      relative = `window-configurator/src/client/cad_screenshots/${profile}/images.json`;
    }
    if (relative === 'window-app/' || relative === 'window-app') relative = 'window-app/index.html';
    if (relative.startsWith('window-app/shared-3d/')) relative = relative.slice('window-app/'.length);
    else if (relative.startsWith('window-app/shared-ui/')) relative = relative.slice('window-app/'.length);
    else if (relative.startsWith('window-app/')) relative = `window-configurator/src/client/${relative.slice('window-app/'.length)}`;
    const file = path.resolve(root, relative);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    let body = await readFile(file);
    if (relative === 'window-configurator/src/client/index.html') {
      body = body.toString().replace(/<script src="https:\/\/cdn\.jsdelivr[^"]*"><\/script>/g, '').replace(/<link[^>]*https:\/\/fonts[^>]*>/g, '')
        .replace(/<script type="module" src="\.\/shared-shell\.js[^>]*><\/script>/, '')
        .replace(/<script type="module">\s*import \{ applyConfiguratorSeo \}[\s\S]*?<\/script>/, '');
    }
    if (relative === 'window-configurator/src/client/js/main.js') {
      body = body.toString().replace('const pageParams = new URLSearchParams(window.location.search);', "const pageParams = new URLSearchParams('debug_colors=0&outside_finish_type=coated&outside_colour=%23dde2e5');").replace('renderer.setAnimationLoop(renderFrame);',
        'window.__CONTACT_TEST = {renderer,scene,camera,surfaceSystem,controls,windowBuilder,materialManager,renderFrame};');
    }
    const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
      '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Access-Control-Allow-Origin': '*' }); res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const url = file => `${base}/${file.replaceAll(path.sep, '/')}`;
let browser;
const results = [];
async function pixels(page, enabled) {
  return page.evaluate(enabled => {
    const t = window.__CONTACT_TEST;
    t.surfaceSystem.render(t.camera, {contactShading:enabled});
    const gl = t.renderer.getContext(), data = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);
    // Return a PNG for visual review and compact counts computed later in-page.
    window.__lastPixels = data;
    return { png:t.renderer.domElement.toDataURL('image/png'), diagnostics:t.surfaceSystem.getDiagnostics(),
      linked:t.renderer.info.programs.every(p=>gl.getProgramParameter(p.program,gl.LINK_STATUS)), lost:gl.isContextLost() };
  }, enabled);
}
async function matchedPair(page, name) {
  const off = await pixels(page,false); await page.evaluate(()=>{ window.__offPixels = window.__lastPixels; });
  const on = await pixels(page,true);
  const metrics = await page.evaluate(()=>{
    const a=window.__offPixels,b=window.__lastPixels;
    let changed=0,darker=0,lighter=0,sum=0,max=0;
    for(let i=0;i<a.length;i+=4){
      const d=(a[i]+a[i+1]+a[i+2]-b[i]-b[i+1]-b[i+2])/3;
      if(Math.abs(d)>1){changed++;if(d>0)darker++;else lighter++;}
      sum+=Math.abs(d);max=Math.max(max,Math.abs(d));
    }
    return {changed,darker,lighter,meanAbsoluteChange:sum/(a.length/4),maxChannelMeanChange:max,pixels:a.length/4};
  });
  assert.equal(on.linked,true); assert.equal(on.lost,false); assert.equal(on.diagnostics.contactShading.status,'active');
  assert.equal(on.diagnostics.contactShading.error,null); assert.ok(metrics.changed>0, `${name}: effect must actually alter contact pixels`);
  assert.ok(metrics.meanAbsoluteChange<8, `${name}: avoid a global grading change`);
  if(output){await mkdir(output,{recursive:true});for(const [suffix,item] of [['off',off],['on',on]])
    await writeFile(path.join(output,`${name}-${suffix}.png`),Buffer.from(item.png.split(',')[1],'base64'));}
  results.push({name,...metrics,contactShading:on.diagnostics.contactShading});
}
try {
  browser=await chromium.launch({headless:process.env.HEADFUL_WEBGL!=='1',...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
    args:process.env.SOFTWARE_WEBGL==='1'?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']:[]});
  // A flat sloping receiver must not gain false relief/noise from depth sampling.
  {
    const page=await browser.newPage({viewport:{width:384,height:256}});
    await page.setContent(`<script type="module">
      const T=await import('${url('window-configurator/src/client/lib/three.module.js')}');
      const {ContactShading}=await import('${url('shared-3d/src/rendering/ContactShading.js?v=5')}');
      const {getQualityProfile}=await import('${url('shared-3d/src/quality.js?v=2')}');
      const scene=new T.Scene();scene.background=new T.Color('#edf1f4');scene.add(new T.AmbientLight(0xffffff,1));
      const camera=new T.PerspectiveCamera(45,384/256,.05,50);camera.position.set(.5,1.2,2);camera.lookAt(0,0,0);
      const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(384,256);document.body.appendChild(renderer.domElement);
      const material=new T.MeshStandardMaterial({color:'#cccccc',roughness:.7});
      const floor=new T.Mesh(new T.PlaneGeometry(30,30),material);floor.rotation.x=-Math.PI/2;scene.add(floor);
      const stage=new ContactShading(T,{renderer,scene,radius:.14});stage.setQuality(getQualityProfile('balanced').contactShading);
      const data=enabled=>{stage.render(camera,{enabled});const gl=renderer.getContext(),out=new Uint8Array(384*256*4);gl.readPixels(0,0,384,256,gl.RGBA,gl.UNSIGNED_BYTE,out);return out;};
      const compare=()=>{const a=data(false),b=data(true);let changed=0,max=0;for(let i=0;i<a.length;i+=4){const delta=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));if(delta>1)changed++;max=Math.max(max,delta);}return {changed,max};};
      const flat=compare();
      const box=new T.Mesh(new T.BoxGeometry(.3,.5,.3),material);box.position.y=.25;scene.add(box);
      const corner=compare();
      window.__flatTest={flat,corner,linked:renderer.info.programs.every(p=>renderer.getContext().getProgramParameter(p.program,renderer.getContext().LINK_STATUS))};
      stage.dispose();floor.geometry.dispose();box.geometry.dispose();material.dispose();renderer.dispose();
    </script>`);
    await page.waitForFunction(()=>!!window.__flatTest,null,{timeout:30000});
    const report=await page.evaluate(()=>window.__flatTest);
    assert.equal(report.linked,true);assert.equal(report.flat.changed,0,'A flat surface must not gain visible AO noise');
    assert.ok(report.corner.changed>20,'Adding a real contact must produce occlusion');
    results.push({name:'flat-surface-and-contact-calibration',...report});await page.close();
  }
  for(const name of ['window','pergola']) {
    const page=await browser.newPage({viewport:{width:960,height:720}}), errors=[];
    page.on('requestfailed',req=>console.error('[REQUEST]',req.url(),req.failure()?.errorText));
    page.on('pageerror',e=>{errors.push(e.message);console.error('[PAGE]',name,e.message);});
    page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error('[CONSOLE]',name,m.text());}});
    await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
    if(name==='window') {
      const html = await (await fetch(`${base}/window-app/`)).text();
      await page.setContent(html.replace('<head>', `<head><base href="${base}/window-app/">`));
      await page.waitForFunction(()=>!!window.__CONTACT_TEST,null,{timeout:90000});
      await page.evaluate(async()=>{
        const t=window.__CONTACT_TEST;t.controls.enableDamping=false;
        await window.WINDOW_CONFIGURATOR_API.restoreState({sectionView:false,showHouse:false,finishMode:'same',colour:'#dde2e5',debugColoursEnabled:false});
        t.surfaceSystem.setQuality('balanced');t.windowBuilder.applyCurrentPoseInstantly();
        window.__fabrication=JSON.stringify(t.windowBuilder.getFabricationSnapshot());
        const T = await import(new URL('js/three-mesh-reuse.js?v=1',document.baseURI).href);
        const box = new T.Box3().setFromObject(t.windowBuilder.mainGroup), centre = box.getCenter(new T.Vector3());
        const size = box.getSize(new T.Vector3()).length();
        t.controls.target.copy(centre); t.camera.position.copy(centre).add(new T.Vector3(size*.35,size*.16,size*1.05)); t.controls.update();
      });
    } else {
      const imports={three:url(path.relative(root,path.join(pergolaThree,'build/three.module.js'))),'three/addons/':url(`${path.relative(root,pergolaThree)}/examples/jsm/`)};
      // The harness document is local and the only substitutions are its DOM and account-free entry.
      await page.setContent(`<!doctype html><head><base href="${url('pergola-configurator/public/')}"><style>html,body,#scene{margin:0;width:100%;height:100%;overflow:hidden}.dimension-layer{display:none}</style><script type="importmap">${JSON.stringify({imports})}</script></head><body><div id="scene"></div><script type="module">
        const {PergolaScene}=await import('${url('pergola-configurator/src/scene/PergolaScene.js')}');
        const {ConfiguratorStore}=await import('${url('pergola-configurator/src/state.js')}');
        const store=new ConfiguratorStore({quality:'balanced',view:{dimensionsVisible:false}});
        const app=new PergolaScene(document.getElementById('scene'),store);
        cancelAnimationFrame(app.animationFrame);app.controls.enableDamping=false;
        await app.assets.ready; await new Promise(resolve=>setTimeout(resolve,200));
        cancelAnimationFrame(app.animationFrame);app.dimensionGroup.visible=false;app.controls.update();
        window.__CONTACT_TEST={app,store,renderer:app.renderer,scene:app.scene,camera:app.camera,surfaceSystem:app.surfaceSystem,controls:app.controls};
      </script></body>`);
      await page.waitForFunction(()=>!!window.__CONTACT_TEST,null,{timeout:90000});
    }
    await page.evaluate(() => window.__CONTACT_TEST.surfaceSystem.materials.whenTexturesReady());
    await matchedPair(page,`${name}-overview`);
    if(name==='window') {
      await page.evaluate(async()=>{
        const t=window.__CONTACT_TEST;
        const T=await import(new URL('js/three-mesh-reuse.js?v=1',document.baseURI).href);
        const objects=[];t.windowBuilder.mainGroup.traverse(o=>{if(o.userData.windowHandleCellId)objects.push(o);});
        const box=new T.Box3();objects.forEach(o=>box.expandByObject(o));const target=box.getCenter(new T.Vector3());
        t.controls.target.copy(target);t.camera.position.copy(target).add(new T.Vector3(.10,.055,.21));t.controls.update();
      });
    } else {
      await page.evaluate(()=>{
        const t=window.__CONTACT_TEST; t.controls.minDistance=.1; t.camera.position.set(3.1,.6,2.6);t.controls.target.set(2.5,.10,1.75);t.controls.update();
      });
    }
    for(const color of ['#dde2e5','#383e42','#80512f']) {
      await page.evaluate(color=>{
        const t=window.__CONTACT_TEST;
        // Change only the selected color in the comparison rig, not any material response.
        for(const [material,entry] of t.surfaceSystem.materials.materials) if(entry.id==='aluminium.powderCoated') material.color.set(color);
      },color);
      await matchedPair(page,`${name}-contact-${color.slice(1)}`);
    }
    const lifecycle=await page.evaluate(()=>{
      const t=window.__CONTACT_TEST,reports=[];
      for(const quality of ['high','low','balanced','high','balanced']){
        t.surfaceSystem.setQuality(quality);t.surfaceSystem.render(t.camera);reports.push(t.surfaceSystem.getDiagnostics());
      }
      const first=reports.at(-1).contactShading;
      for(let i=0;i<3;i++)t.surfaceSystem.render(t.camera);
      const last=t.surfaceSystem.getDiagnostics();
      return {reports,stable:first.allocationCount===last.contactShading.allocationCount,
        fabricationUnchanged:!t.windowBuilder||window.__fabrication===JSON.stringify(t.windowBuilder.getFabricationSnapshot())};
    });
    assert.equal(lifecycle.stable,true);assert.equal(lifecycle.fabricationUnchanged,true);
    assert.equal(lifecycle.reports[1].contactShading.targetCount,0);
    assert.ok(lifecycle.reports.every(r=>r.environmentError===null));
    assert.deepEqual(errors,[]);
    results.push({name:`${name}-lifecycle`,threeRevision:lifecycle.reports[0].threeRevision,stable:lifecycle.stable,
      fabricationUnchanged:lifecycle.fabricationUnchanged,tiers:lifecycle.reports.map(r=>({quality:r.quality,contactShading:r.contactShading}))});
    await page.close();
  }
  console.log(JSON.stringify(results,null,2));
  if(output)await writeFile(path.join(output,'contact-report.json'),JSON.stringify(results,null,2));
} finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
