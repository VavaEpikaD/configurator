import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../window-configurator/src/client/lib/three.module.js';
import { SceneRevision } from '../src/rendering/SceneRevision.js';
import { RenderPerformance } from '../src/rendering/RenderPerformance.js';
import { getQualityProfile } from '../src/quality.js';
import { createContactKernel } from '../src/rendering/ContactShading.js';
function fixture() {
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(50, 4/3, .05, 50);
  camera.position.set(0, 0, 3);
  const material = new T.MeshStandardMaterial(), mesh = new T.Mesh(new T.BoxGeometry(), material);mesh.castShadow = true;scene.add(mesh);
  const light = new T.DirectionalLight();light.castShadow = true;light.position.set(2,4,3);scene.add(light, light.target);
  const listeners = new Map();
  const renderer = { shadowMap:{enabled:true,type:T.PCFSoftShadowMap,needsUpdate:false}, xr:{isPresenting:false},
    ratio:1, width:800,height:600, info:{render:{frame:0}}, toneMappingExposure:1,
    domElement:{addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)},
    getPixelRatio(){return this.ratio;},setPixelRatio(x){this.ratio=x;},
    getDrawingBufferSize(out){return out.set(this.width*this.ratio,this.height*this.ratio);},
    getViewport(out){return out.set(0,0,this.width,this.height);},getRenderTarget(){return this.target||null;},getScissorTest(){return false;},
    getClearColor(out){return out.set('#fff');},getClearAlpha(){return 1;},
  };
  const revisions = new SceneRevision(T), p = new RenderPerformance(T,renderer,scene);
  p.setQuality(getQualityProfile('high', {devicePixelRatio:1}));
  const scan = () => {const s = revisions.inspect(scene,camera,renderer);revisions.commit(renderer);return s;};
  scan(); scan();
  return {scene,camera,material,mesh,light,renderer,revisions,p,listeners,scan};
}
test('idle scene is unchanged and orbit invalidates camera but not static shadows',()=>{
  const f=fixture();assert.equal(f.scan().changed,false);f.camera.position.x+=.1;
  const s=f.scan();assert.equal(s.cameraChanged,true);assert.equal(s.shadowChanged,false);assert.equal(s.sceneChanged,false);
});
for(const [name,mutate] of Object.entries({
  transform:f=>f.mesh.position.x+=.1, visibility:f=>f.mesh.visible=false, geometry:f=>f.mesh.geometry.attributes.position.needsUpdate=true,
  replacement:f=>f.mesh.geometry=new T.BoxGeometry(2,2,2), groups:f=>f.mesh.geometry.groups[0].count=0,
  color:f=>f.material.color.set('#123456'), opacity:f=>f.material.opacity=.5, clipping:f=>f.material.clippingPlanes=[new T.Plane()],
  normalStrength:f=>f.material.normalScale.x=.123, transmission:f=>f.material.transmission=1,
  texture:f=>f.material.map=new T.Texture(), removed:f=>f.scene.remove(f.mesh), added:f=>f.scene.add(new T.Mesh(new T.BoxGeometry(),f.material)),
  exposure:f=>f.renderer.toneMappingExposure=1.2, light:f=>f.light.position.x+=.2, lightTarget:f=>f.light.target.position.x+=.2,
  shadowSize:f=>f.light.shadow.mapSize.set(1024,1024), shadowBias:f=>f.light.shadow.bias=.001,
  projection:f=>{f.camera.fov=40;f.camera.updateProjectionMatrix();}, resized:f=>f.renderer.width=1200,
  layers:f=>f.camera.layers.set(1), groundColor:f=>{f.scene.background=new T.Color('#ccc');},
})) test(`render inputs invalidate the scene: ${name}`,()=>{const f=fixture();mutate(f);assert.equal(f.scan().changed,true);});
test('asynchronous texture upload and UV scrolling invalidate even without a material recompile',()=>{
  const f=fixture();f.material.map=new T.Texture();f.scan();f.material.map.needsUpdate=true;assert.equal(f.scan().changed,true);
  f.material.map.offset.x=.2;assert.equal(f.scan().changed,true);
});
test('tiny camera damping noise settles, cumulative movement is still detected',()=>{
  const f=fixture();f.camera.position.x+=1e-8;assert.equal(f.scan().changed,false);f.camera.position.x+=2e-7;assert.equal(f.scan().cameraChanged,true);
});
test('unrecognised animated rendering paths bypass idle/shadow reuse conservatively',()=>{
  for(const mutate of [f=>f.mesh.onBeforeRender=()=>{},f=>f.mesh.material=new T.ShaderMaterial(),f=>f.mesh.material.map=new T.VideoTexture({}),f=>f.mesh.morphTargetInfluences=[0]]) {
    const f=fixture();mutate(f);f.scan();const state=f.scan();assert.equal(state.dynamic,true);assert.equal(state.shadowChanged,true);
  }
});
test('material and geometry snapshots never modify geometry, colors, texture transforms or arrays',()=>{
  const f=fixture(), positions=f.mesh.geometry.attributes.position.array.slice(), color=f.material.color.toArray();
  for(let i=0;i<20;i++){f.camera.position.x+=.02;f.scan();}
  assert.deepEqual(f.mesh.geometry.attributes.position.array,positions);assert.deepEqual(f.material.color.toArray(),color);
});
test('only animation loops skip idle frames; explicit capture always draws',()=>{
  const f=fixture();let frame=f.p.begin(f.camera,{onDemand:true,now:0});assert.ok(frame);f.p.end(frame,2);
  assert.equal(f.p.begin(f.camera,{onDemand:true,now:16}),null);
  assert.ok(f.p.begin(f.camera,{onDemand:false,now:32}));assert.equal(f.p.getDiagnostics().skippedIdleFrames,1);
});
test('a slow moving view uses quantised resolution and restores full High after settling',()=>{
  const f=fixture();for(let i=0;i<48;i++){f.camera.position.x+=.01;const s=f.p.begin(f.camera,{onDemand:true,now:i*40});if(s)f.p.end(s,30);}
  assert.ok(f.renderer.ratio<1);assert.ok(f.renderer.ratio>=.66);
  let s=f.p.begin(f.camera,{onDemand:true,now:2600});assert.ok(s);f.p.end(s,10);
  assert.equal(f.renderer.ratio,1);assert.equal(f.p.getDiagnostics().motionResolutionScale,1);
});
test('rapid motion on a fast renderer retains full resolution',()=>{
  const f=fixture();for(let i=0;i<40;i++){f.camera.position.x+=.01;const s=f.p.begin(f.camera,{onDemand:true,now:i*16});if(s)f.p.end(s,5);}
  assert.equal(f.renderer.ratio,1);
});
test('explicit screenshot during slow motion restores full framebuffer',()=>{
  const f=fixture();for(let i=0;i<40;i++){f.camera.position.x+=.01;const s=f.p.begin(f.camera,{onDemand:true,now:i*40});if(s)f.p.end(s,30);}
  assert.ok(f.renderer.ratio<1);assert.ok(f.p.begin(f.camera,{onDemand:false,now:1620}));assert.equal(f.renderer.ratio,1);
});
test('native transmission budget is used only where available, with full quality restored',()=>{
  const f=fixture();assert.equal(f.p.getDiagnostics().nativeTransmissionScaleSupported,false);
  f.renderer.transmissionResolutionScale=1;
  for(let i=0;i<40;i++){f.camera.position.x+=.01;const s=f.p.begin(f.camera,{onDemand:true,now:i*40});if(s)f.p.end(s,30);}
  assert.equal(f.renderer.transmissionResolutionScale,.75);f.p.begin(f.camera,{onDemand:false,now:1620});assert.equal(f.renderer.transmissionResolutionScale,1);
});
test('AR and external targets bypass cached frame/quality changes',()=>{
  const f=fixture();f.renderer.xr.isPresenting=true;
  for(let i=0;i<10;i++){const s=f.p.begin(f.camera,{onDemand:true,now:i*40});assert.ok(s.special);f.p.end(s,1);}
  assert.equal(f.renderer.ratio,1);
});
test('out-of-band render, context restore and explicit invalidation trigger redraw',()=>{
  const f=fixture();let s=f.p.begin(f.camera,{onDemand:true,now:0});f.p.end(s,1);
  f.renderer.info.render.frame++;assert.ok(f.p.begin(f.camera,{onDemand:true,now:16}));
  f.listeners.get('webglcontextrestored')();assert.ok(f.p.begin(f.camera,{onDemand:true,now:32}));
  f.p.invalidate();assert.ok(f.p.begin(f.camera,{onDemand:true,now:48}));f.p.dispose();assert.equal(f.listeners.size,0);
});
test('hidden-page checks skip graphics and invalidate on resume',()=>{
  const f=fixture(), previous=globalThis.document;globalThis.document={hidden:true};
  try{assert.equal(f.p.begin(f.camera,{onDemand:true,now:0}),null);assert.equal(f.p.getDiagnostics().skippedHiddenFrames,1);}
  finally{globalThis.document=previous;}
  assert.ok(f.p.begin(f.camera,{onDemand:true,now:16}));
});
test('precomputed AO taps reproduce the original 12 and 20 sample patterns',()=>{
  for(const count of [12,20]){const kernel=createContactKernel(count);for(let i=0;i<count;i++){
    const rotation=.73, radius=(i%2===0?.4:1)*Math.sqrt((Math.floor(i*.5)+.5)/Math.ceil(count*.5));
    const actualX=Math.cos(rotation)*kernel[i*2]-Math.sin(rotation)*kernel[i*2+1];
    const actualY=Math.sin(rotation)*kernel[i*2]+Math.cos(rotation)*kernel[i*2+1];
    assert.ok(Math.abs(actualX-Math.cos(rotation+i*2.39996323)*radius)<1e-7);
    assert.ok(Math.abs(actualY-Math.sin(rotation+i*2.39996323)*radius)<1e-7);
  }}
  assert.throws(()=>createContactKernel(0));
});

test('explicit per-light shadow refresh invalidates an otherwise unchanged scene',()=>{
  const f=fixture();f.light.shadow.needsUpdate=true;const s=f.scan();
  assert.equal(s.changed,true);assert.equal(s.shadowChanged,true);
});
test('sustained very slow movement can reduce resolution without counting a single loading stall',()=>{
  const f=fixture();for(let i=0;i<12;i++){f.camera.position.x+=.01;const s=f.p.begin(f.camera,{onDemand:true,now:i*400});if(s)f.p.end(s,30);}
  assert.ok(f.renderer.ratio<1);f.p.begin(f.camera,{onDemand:true,now:5500});assert.equal(f.renderer.ratio,1);
});
