/** Actual-client PBR acceptance (account-free, localhost only).
 * Window is served from its prepared static output to test image-copy paths.
 * Pergola uses the actual scene/store/GLBs with its installed Three engine.
 * Optional PBR_BASELINE_ROOT compares against a prepared, unmodified baseline.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(new URL('../../package.json',import.meta.url));
const {chromium}=require('playwright');
const before=process.env.PBR_BASELINE_ROOT;
const output=process.env.VISUAL_OUTPUT_DIR;
const rootFor=tag=>tag==='before'?before:root;
const sources={};
for(const tag of before?['before','after']:['after']){
 const fromPergola=createRequire(path.join(rootFor(tag),'pergola-configurator/package.json'));
 sources[tag]=path.relative(rootFor(tag),path.dirname(path.dirname(fromPergola.resolve('three'))));
}
const server=createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');const parts=decodeURIComponent(u.pathname).split('/').filter(Boolean);
  const tag=['before','after'].includes(parts[0])?parts.shift():'after';const work=rootFor(tag);
  if(!work)throw new Error('No baseline.');
  let rel=parts.join('/');
  if(rel==='window-app'||rel==='window-app/')rel='window-app/index.html';
  if(rel.startsWith('window-app/'))rel='window-configurator/dist/site/'+rel.slice(11);
  if(rel==='api/cad-screenshots'){
   const profile=u.searchParams.get('profile');if(!/^[A-Za-z0-9_ -]+$/.test(profile||''))throw new Error('Invalid profile.');
   rel=`window-configurator/src/client/cad_screenshots/${profile}/images.json`;
  }
  const file=path.resolve(work,rel);if(!file.startsWith(path.resolve(work)+path.sep))throw new Error('Outside root.');
  let body=await readFile(file);
  if(rel==='window-configurator/dist/site/index.html')body=body.toString()
   .replace(/<script src="https:\/\/cdn\.jsdelivr[^\"]*"><\/script>/g,'')
   .replace(/<link[^>]*https:\/\/fonts[^>]*>/g,'')
   .replace(/<script type="module" src="\.\/shared-shell\.js[^>]*><\/script>/,'')
   .replace(/<script type="module">\s*import \{ applyConfiguratorSeo \}[\s\S]*?<\/script>/,'');
  if(rel==='window-configurator/dist/site/js/main.js')body=body.toString()
   .replace('const pageParams = new URLSearchParams(window.location.search);',"const pageParams = new URLSearchParams('debug_colors=0&outside_finish_type=coated&outside_colour=%23dde2e5');")
   .replace('renderer.setAnimationLoop(renderFrame);','window.__PBR_TEST={renderer,scene,camera,surfaceSystem,controls,windowBuilder,materialManager,renderFrame};');
  const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary'}[path.extname(file)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':mime,'Access-Control-Allow-Origin':'*'});res.end(body);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;const reports=[],renders=new Map();
async function start(page,name,tag,fail=false){
 const prefix=`${base}/${tag}`;
 await page.route('**/*',route=>{
  if(!route.request().url().startsWith(base))return route.abort();
  if(fail&&route.request().url().includes('/assets/pbr/v1/'))return route.fulfill({status:404,body:'Deliberate test failure'});
  return route.continue();
 });
 if(name==='window'){
  const html=await(await fetch(`${prefix}/window-app/`)).text();
  await page.setContent(html.replace('<head>',`<head><base href="${prefix}/window-app/">`));
  await page.waitForFunction(()=>!!window.__PBR_TEST,null,{timeout:90000});
  await page.evaluate(async()=>{
   const t=window.__PBR_TEST;t.controls.enableDamping=false;
   await window.WINDOW_CONFIGURATOR_API.restoreState({sectionView:false,showHouse:false,finishMode:'same',colour:'#dde2e5',debugColoursEnabled:false});
   t.windowBuilder.applyCurrentPoseInstantly();t.surfaceSystem.setQuality('balanced');
   const T=await import(new URL('js/three-mesh-reuse.js?v=1',document.baseURI).href);
   const box=new T.Box3().setFromObject(t.windowBuilder.mainGroup),centre=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()).length();
   t.controls.target.copy(centre);t.camera.position.copy(centre).add(new T.Vector3(size*.35,size*.16,size*1.05));t.controls.update();
  });
 }else{
  const imports={three:`${prefix}/${sources[tag]}/build/three.module.js`,'three/addons/':`${prefix}/${sources[tag]}/examples/jsm/`};
  await page.setContent(`<!doctype html><head><base href="${prefix}/pergola-configurator/public/"><style>html,body,#scene{margin:0;width:100%;height:100%;overflow:hidden}.dimension-layer{display:none}</style><script type="importmap">${JSON.stringify({imports})}</script></head><body><div id="scene"></div><script type="module">
   const {PergolaScene}=await import('${prefix}/pergola-configurator/src/scene/PergolaScene.js');
   const {ConfiguratorStore}=await import('${prefix}/pergola-configurator/src/state.js');
   const store=new ConfiguratorStore({quality:'balanced',view:{dimensionsVisible:false}});
   const app=new PergolaScene(document.getElementById('scene'),store);cancelAnimationFrame(app.animationFrame);app.controls.enableDamping=false;
   await app.assets.ready;await new Promise(resolve=>setTimeout(resolve,200));cancelAnimationFrame(app.animationFrame);app.dimensionGroup.visible=false;app.controls.update();
   window.__PBR_TEST={app,store,renderer:app.renderer,scene:app.scene,camera:app.camera,surfaceSystem:app.surfaceSystem,controls:app.controls};
  </script></body>`);
  await page.waitForFunction(()=>!!window.__PBR_TEST,null,{timeout:90000});
 }
 await page.evaluate(async()=>{await window.__PBR_TEST.surfaceSystem.materials.whenTexturesReady?.();});
}
async function capture(page,name){
 const result=await page.evaluate(()=>{
  const t=window.__PBR_TEST;t.surfaceSystem.render(t.camera);const gl=t.renderer.getContext();
  return {png:t.renderer.domElement.toDataURL('image/png'),diagnostics:t.surfaceSystem.getDiagnostics(),lost:gl.isContextLost(),
   linked:t.renderer.info.programs.every(p=>gl.getProgramParameter(p.program,gl.LINK_STATUS)),
   fabrication:t.windowBuilder?JSON.stringify(t.windowBuilder.getFabricationSnapshot()):null};
 });
 assert.equal(result.lost,false);assert.equal(result.linked,true);assert.equal(result.diagnostics.environmentError,null);
 if(output){await mkdir(output,{recursive:true});await writeFile(path.join(output,`${name}.png`),Buffer.from(result.png.split(',')[1],'base64'));}
 return result;
}
try{
 browser=await chromium.launch({headless:process.env.HEADFUL_WEBGL!=='1',...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:process.env.SOFTWARE_WEBGL==='1'?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']:[]});
 for(const tag of before?['before','after']:['after'])for(const name of ['window','pergola']){
  const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(name,tag,e.message);});
  await start(page,name,tag);const overview=await capture(page,`${tag}-${name}-overview`);
  if(name==='window')await page.evaluate(async()=>{
   const t=window.__PBR_TEST,T=await import(new URL('js/three-mesh-reuse.js?v=1',document.baseURI).href),box=new T.Box3();
   t.windowBuilder.mainGroup.traverse(o=>{if(o.userData.windowHandleCellId)box.expandByObject(o);});
   const target=box.getCenter(new T.Vector3());t.controls.target.copy(target);t.camera.position.copy(target).add(new T.Vector3(.10,.055,.21));t.controls.update();
  });else await page.evaluate(()=>{const t=window.__PBR_TEST;t.controls.minDistance=.1;t.camera.position.set(3.1,.6,2.6);t.controls.target.set(2.5,.10,1.75);t.controls.update();});
  const closeup=await capture(page,`${tag}-${name}-closeup`);
  renders.set(`${tag}-${name}`,{overview,closeup});
  const tiers=[];
  for(const quality of ['low','balanced','high','balanced']){
   await page.evaluate(async quality=>{const t=window.__PBR_TEST;t.surfaceSystem.setQuality(quality);await t.surfaceSystem.materials.whenTexturesReady?.();},quality);
   const shot=await capture(page,`${tag}-${name}-${quality}`);tiers.push(shot.diagnostics);
   if(tag==='after'){
    assert.equal(shot.diagnostics.textureAssets.status,'ready');assert.equal(shot.diagnostics.textureAssets.failedSets,0);
    if(quality==='low')assert.ok(shot.diagnostics.textureAssets.sets.every(s=>s.roles.length===1&&s.roles[0]==='color'));
    else assert.ok(shot.diagnostics.textureAssets.sets.some(s=>s.roles.includes('normal')&&s.status==='ready'));
   }
  }
  assert.ok(tiers.every(t=>t.geometry.geometryCount===tiers[0].geometry.geometryCount));assert.deepEqual(errors,[]);
  reports.push({tag,name,overview:overview.diagnostics,tiers:tiers.map(t=>({quality:t.quality,textureAssets:t.textureAssets})),
   fabricationHash:overview.fabrication?createHash('sha256').update(overview.fabrication).digest('hex'):null});await page.close();
 }
 if(before){
  assert.equal(renders.get('before-window').overview.fabrication,renders.get('after-window').overview.fabrication,'Window fabrication must remain unchanged.');
  // PNG bytes may vary by platform; retain the matched pairs for pixel inspection.
 }
 for(const name of ['window','pergola']){
  const page=await browser.newPage({viewport:{width:640,height:480}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,name,'after',true);const shot=await capture(page,`failure-${name}`);
  assert.equal(shot.diagnostics.textureAssets.status,'fallback');assert.ok(shot.diagnostics.textureAssets.failedSets>0);
  assert.equal(shot.diagnostics.textureAssets.pendingSets,0);assert.deepEqual(errors,[]);
  reports.push({name,scenario:'missing-assets',diagnostics:shot.diagnostics});await page.close();
 }
 console.log(JSON.stringify(reports,null,2));if(output)await writeFile(path.join(output,'pbr-browser-report.json'),JSON.stringify(reports,null,2));
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
