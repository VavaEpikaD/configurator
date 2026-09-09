/** Actual local clients, software/hardware renderer selectable by CI. Never uses
 * production accounts. Counters include all passes; gl.finish is BENCHMARK ONLY,
 * never shipped in the configurator. The wall-clock fields are command-submission
 * observations, not reliable GPU timings and not end-user FPS. Only draw-call
 * counts and matched rendered images are used for acceptance.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.env.PERFORMANCE_ROOT || fileURLToPath(new URL('../../', import.meta.url)));
const { chromium } = createRequire(path.join(root,'package.json'))('playwright');
const requireThree = createRequire(path.join(root,'pergola-configurator/package.json'));
const threePath = path.dirname(path.dirname(requireThree.resolve('three')));
const output = process.env.VISUAL_OUTPUT_DIR || '/tmp/performance-browser';
await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{
  try {
    const u=new URL(req.url,'http://localhost');let relative=decodeURIComponent(u.pathname).slice(1);
    if(relative==='api/cad-screenshots') {const p=u.searchParams.get('profile');if(!/^[A-Za-z0-9_ -]+$/.test(p||''))throw new Error();relative=`window-configurator/src/client/cad_screenshots/${p}/images.json`;}
    if(relative==='window-app/'||relative==='window-app')relative='window-app/index.html';
    if(relative.startsWith('window-app/shared-3d/')||relative.startsWith('window-app/shared-ui/'))relative=relative.slice('window-app/'.length);
    else if(relative.startsWith('window-app/'))relative=`window-configurator/src/client/${relative.slice('window-app/'.length)}`;
    const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))throw new Error();let body=await readFile(file);
    if(relative==='window-configurator/src/client/index.html')body=body.toString().replace(/<script src="https:\/\/cdn\.jsdelivr[^\"]*"><\/script>/g,'').replace(/<link[^>]*https:\/\/fonts[^>]*>/g,'').replace(/<script type="module" src="\.\/shared-shell\.js[^>]*><\/script>/,'').replace(/<script type="module">\s*import \{ applyConfiguratorSeo \}[\s\S]*?<\/script>/,'');
    if(relative==='window-configurator/src/client/js/main.js')body=body.toString().replace('const pageParams = new URLSearchParams(window.location.search);',"const pageParams = new URLSearchParams('debug_colors=0&outside_finish_type=coated&outside_colour=%23dde2e5');").replace('renderer.setAnimationLoop(renderFrame);','window.__PERF_TEST = {renderer,scene,camera,surfaceSystem,controls,windowBuilder,windowLayoutOverlay,renderFrame};');
    const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':mime,'Access-Control-Allow-Origin':'*'});res.end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
const url=rel=>`${base}/${rel.replaceAll(path.sep,'/')}`;
const browser=await chromium.launch({headless:process.env.HEADFUL_WEBGL!=='1',executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-gpu-watchdog']});
const reports=[];
try {
for(const name of ['window','pergola'].filter(n=>!process.env.PERFORMANCE_PRODUCT||process.env.PERFORMANCE_PRODUCT===n)) {
  const page=await browser.newPage({viewport:process.env.PERFORMANCE_INTERACTIONS==='1'?{width:400,height:300}:{width:800,height:600}});page.setDefaultTimeout(90000);
  const errors=[];page.on('pageerror',e=>{console.error(name,e.message);errors.push(e.message);});page.on('console',m=>{if(process.env.PERFORMANCE_DEBUG)console.log('console',m.type(),m.text());if(m.type()==='error'){errors.push(m.text());console.error(name,m.text());}});
  await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  if(name==='window'){
    const html=await(await fetch(`${base}/window-app/`)).text();await page.setContent(html.replace('<head>',`<head><base href="${base}/window-app/">`));
    try { await page.waitForFunction(()=>!!window.__PERF_TEST,null,{timeout:30000}); } catch(e){console.log('FAILED_START',await page.evaluate(()=>({text:document.body.innerText.slice(0,500),keys:Object.keys(window).filter(k=>k.includes('WINDOW')),resources:performance.getEntriesByType('resource').map(r=>r.name).slice(-30)})));throw e;}
    await page.evaluate(async()=>{
      const t=window.__PERF_TEST;t.controls.enableDamping=false;
      await window.WINDOW_CONFIGURATOR_API.restoreState({sectionView:false,showHouse:false,finishMode:'same',colour:'#dde2e5',debugColoursEnabled:false});
      t.windowBuilder.applyCurrentPoseInstantly();window.__fabrication=JSON.stringify(t.windowBuilder.getFabricationSnapshot());
      const T=await import(new URL('js/three-mesh-reuse.js?v=1',document.baseURI).href);
      const b=new T.Box3().setFromObject(t.windowBuilder.mainGroup),c=b.getCenter(new T.Vector3()),d=b.getSize(new T.Vector3()).length();
      t.controls.target.copy(c);t.camera.position.copy(c).add(new T.Vector3(d*.35,d*.16,d*1.05));t.controls.update();
      window.__initialCamera=t.camera.position.clone();
    });
  }else{
    const imports={three:url(path.relative(root,path.join(threePath,'build/three.module.js'))),'three/addons/':url(`${path.relative(root,threePath)}/examples/jsm/`)};
    await page.setContent(`<!doctype html><head><base href="${url('pergola-configurator/public/')}"><style>html,body,#scene{margin:0;width:100%;height:100%;overflow:hidden}.dimension-layer{display:none}</style><script type="importmap">${JSON.stringify({imports})}</script></head><body><div id="scene"></div><script type="module">
      const {PergolaScene}=await import('${url('pergola-configurator/src/scene/PergolaScene.js')}');
      const {ConfiguratorStore}=await import('${url('pergola-configurator/src/state.js')}');
      const store=new ConfiguratorStore({quality:'balanced',view:{dimensionsVisible:false}});const app=new PergolaScene(document.getElementById('scene'),store);
      cancelAnimationFrame(app.animationFrame);app.controls.enableDamping=false;await app.assets.ready;await new Promise(resolve=>setTimeout(resolve,200));cancelAnimationFrame(app.animationFrame);app.dimensionGroup.visible=false;
      window.__PERF_TEST={app,store,renderer:app.renderer,scene:app.scene,camera:app.camera,surfaceSystem:app.surfaceSystem,controls:app.controls,
        renderFrame:()=>{app.animate();cancelAnimationFrame(app.animationFrame);}};
      window.__initialCamera=app.camera.position.clone();
    </script></body>`);await page.waitForFunction(()=>!!window.__PERF_TEST,null,{timeout:90000});
  }
  console.log('READY',name);
  await page.evaluate(()=>window.__PERF_TEST.surfaceSystem.materials.whenTexturesReady());
  for(const quality of (process.env.PERFORMANCE_INTERACTIONS==='1'?[]:['balanced','high'])){
    console.log('QUALITY',name,quality);
    const data=await page.evaluate(async({quality,name})=>{
      const t=window.__PERF_TEST,r=t.renderer,gl=r.getContext();t.surfaceSystem.setQuality(quality,{devicePixelRatio:Number(window.__BENCH_DPR||1)});await t.surfaceSystem.materials.whenTexturesReady();
      t.camera.position.copy(window.__initialCamera);t.controls.update();r.info.autoReset=false;
      // Settle/compile before timing. All inspection time is outside the measured frame.
      for(let i=0;i<2;i++){t.surfaceSystem.render(t.camera);gl.finish();await new Promise(resolve=>setTimeout(resolve,40));}
      const shadowBefore=t.surfaceSystem.getDiagnostics().performance?.shadowUpdates;
      const sample=(move,force=false)=>{if(move){t.camera.position.x+=.018;t.controls.update();}r.info.reset();
        const start=performance.now();
        if(force)t.surfaceSystem.render(t.camera);else t.renderFrame(start);
        gl.finish();return {ms:performance.now()-start,calls:r.info.render.calls,triangles:r.info.render.triangles};};
      const idle=[];for(let i=0;i<3;i++){idle.push(sample(false));await new Promise(resolve=>setTimeout(resolve,20));}
      // Exact settled resolution during this benchmark: explicit frames bypass
      // adaptive motion, while still sharing static shadow maps and cheap kernels.
      const orbit=[];for(let i=0;i<3;i++){orbit.push(sample(true,true));await new Promise(resolve=>setTimeout(resolve,20));}
      const diagnostics=t.surfaceSystem.getDiagnostics();
      const summary=a=>{const times=a.map(x=>x.ms).sort((a,b)=>a-b);return {medianMs:times[Math.floor(times.length/2)],meanDrawCalls:a.reduce((s,x)=>s+x.calls,0)/a.length,meanTriangles:a.reduce((s,x)=>s+x.triangles,0)/a.length,samples:a.length};};
      t.camera.position.copy(window.__initialCamera);t.controls.update();t.surfaceSystem.render(t.camera);const png=r.domElement.toDataURL('image/png');
      const handles=[];if(name==='window')t.windowBuilder.mainGroup.traverse(o=>{if(o.isMesh&&o.userData.windowHandleCellId)handles.push(o);});
      return {quality,idle:summary(idle),orbit:summary(orbit),diagnostics,shadowBefore,
        handles:handles.length, fabricationPreserved:name!=='window'||JSON.stringify(t.windowBuilder.getFabricationSnapshot())===window.__fabrication,
        linked:r.info.programs.every(p=>gl.getProgramParameter(p.program,gl.LINK_STATUS)),contextLost:gl.isContextLost(),png};
    },{quality,name});
    console.log('CHECK',name,quality,{linked:data.linked,lost:data.contextLost,fabrication:data.fabricationPreserved,handles:data.handles,idle:data.idle,orbit:data.orbit});
    await writeFile(path.join(output,`${name}-${quality}-raw.json`),JSON.stringify({...data,png:undefined},null,2));
    await writeFile(path.join(output,`${name}-${quality}.png`),Buffer.from(data.png.split(',')[1],'base64'));
    assert.equal(data.linked,true,`${name} ${quality}: shader link`);assert.equal(data.contextLost,false);assert.equal(data.fabricationPreserved,true,`${name} ${quality}: fabrication`);if(name==='window')assert.equal(data.handles,3);
    if(data.diagnostics.performance){assert.ok(data.idle.meanDrawCalls<1,`${name} ${quality}: no redraw at rest`);assert.equal(data.diagnostics.performance.continuousContent,false);}
    await writeFile(path.join(output,`${name}-${quality}.png`),Buffer.from(data.png.split(',')[1],'base64'));delete data.png;
    reports.push({name,...data});console.log(JSON.stringify({name,...data}));
  }
  if(process.env.PERFORMANCE_INTERACTIONS==='1') {
    // Actual client, high-DPI framebuffer, controlled motion cadence. The fake
    // timestamps exercise hysteresis; they are NOT a hardware FPS benchmark.
    await page.evaluate(async()=>{
      const t=window.__PERF_TEST;t.surfaceSystem.setQuality('high',{devicePixelRatio:2});
      await t.surfaceSystem.materials.whenTexturesReady();t.surfaceSystem.render(t.camera);
      t.surfaceSystem.render(t.camera);t.renderer.info.autoReset=false;
      window.__adaptiveEvidence={scales:[],geometry:t.surfaceSystem.getDiagnostics().geometry.geometryCount};
    });
    for(let i=0;i<32;i++) await page.evaluate(i=>{
      const t=window.__PERF_TEST;t.camera.position.x+=.009;t.controls.update();
      t.surfaceSystem.render(t.camera,{onDemand:true,now:i*40});
      window.__adaptiveEvidence.scales.push(t.surfaceSystem.getDiagnostics().performance.motionResolutionScale);
    },i);
    const adaptive=await page.evaluate(async(name)=>{
      const t=window.__PERF_TEST,e=window.__adaptiveEvidence;
      const moving=t.surfaceSystem.getDiagnostics();
      t.surfaceSystem.render(t.camera,{onDemand:true,now:2200});
      const settled=t.surfaceSystem.getDiagnostics();
      const png=t.renderer.domElement.toDataURL('image/png');
      t.renderer.info.reset();t.surfaceSystem.render(t.camera,{onDemand:true,now:2240});
      t.renderer.info.reset();t.surfaceSystem.render(t.camera,{onDemand:true,now:2280});
      const idleCalls=t.renderer.info.render.calls;
      // A same-size resize can clear a canvas despite identical camera matrices.
      if(name==='pergola')t.app.resize();else window.dispatchEvent(new Event('resize'));
      t.renderer.info.reset();t.renderFrame(2600);const resizeCalls=t.renderer.info.render.calls;
      return {...e,movingRatio:moving.performance.currentPixelRatio,settledRatio:settled.performance.currentPixelRatio,
        settledScale:settled.performance.motionResolutionScale,settledGeometry:settled.geometry.geometryCount,
        idleCalls,resizeCalls,linked:t.renderer.info.programs.every(p=>t.renderer.getContext().getProgramParameter(p.program,t.renderer.getContext().LINK_STATUS)),
        contextLost:t.renderer.getContext().isContextLost(),png};
    },name);
    assert.ok(adaptive.scales.includes(.82));assert.ok(adaptive.scales.includes(.66));
    assert.equal(adaptive.settledRatio,2);assert.equal(adaptive.settledScale,1);
    assert.equal(adaptive.settledGeometry,adaptive.geometry);assert.equal(adaptive.idleCalls,0);
    assert.ok(adaptive.resizeCalls>0);assert.equal(adaptive.linked,true);assert.equal(adaptive.contextLost,false);
    await writeFile(path.join(output,`${name}-restored-high.png`),Buffer.from(adaptive.png.split(',')[1],'base64'));
    delete adaptive.png;reports.push({name,adaptive});console.log('ADAPTIVE',name,JSON.stringify(adaptive));
  }
  // Changes that an on-demand renderer must not miss: colors, visibility and a
  // geometry rebuild are driven through real public state/scene APIs.
  const changes=await page.evaluate(async(name)=>{
    const t=window.__PERF_TEST, r=t.renderer;r.info.autoReset=false;
    const render=()=>{r.info.reset();t.renderFrame(performance.now());return r.info.render.calls;};
    t.surfaceSystem.render(t.camera);render();render();
    const m=[...t.surfaceSystem.materials.materials.keys()].find(m=>m.userData.surface.id==='aluminium.powderCoated');m.color.set('#383e42');const color=render();
    let rebuild,hidden;
    if(name==='window'){
      t.windowBuilder.sectionGroup.visible=!t.windowBuilder.sectionGroup.visible;hidden=render();
      await window.WINDOW_CONFIGURATOR_API.restoreState({widthM:1.5,heightM:1.4});t.windowBuilder.applyCurrentPoseInstantly();rebuild=render();
    }else{t.app.dimensionGroup.visible=true;hidden=render();t.store.patch({dimensions:{...t.store.get().dimensions,width:5500}},{path:'dimensions.width'});rebuild=render();}
    return {color,hidden,rebuild};
  },name);assert.ok(changes.color>0);assert.ok(changes.hidden>0);assert.ok(changes.rebuild>0);reports.push({name,changes});console.log('CHANGES',name,JSON.stringify(changes));
  assert.deepEqual(errors,[]);await page.close();
}
await writeFile(path.join(output,'report.json'),JSON.stringify(reports,null,2));
} finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
