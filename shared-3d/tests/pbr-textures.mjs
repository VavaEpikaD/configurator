import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../window-configurator/src/client/lib/three.module.js';
import { PBRTextureSets } from '../src/materials/PBRTextureSets.js';
import { MaterialLibrary } from '../src/materials/MaterialLibrary.js';
import { PBR_TEXTURE_SETS } from '../src/materials/textureSets.js';
const mock = { sample: { detail: {size: 256, maps: { color: 'c', normal: 'n', roughness: 'r' }}, low: {size: 256, maps: {color:'small'}} } };
const deferred = () => { let resolve, reject; const promise = new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function texture(size=256) { const t = new THREE.Texture({width:size,height:size}); t.disposedCount=0; t.addEventListener('dispose',()=>t.disposedCount++); return t; }
const immediate = url => Promise.resolve(texture(url.includes('512') ? 512 : 256));

 test('local manifest maps exist, match dimensions and checked-in hashes', () => {
  const root = new URL('../assets/pbr/v1/', import.meta.url);
  const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
  const urls = new Set(Object.values(PBR_TEXTURE_SETS).flatMap(set=>Object.values(set).flatMap(t=>Object.values(t.maps))));
  assert.equal(urls.size,8);
  for (const url of urls) {
    const name=fileURLToPath(url).split('/').at(-1), record=manifest.files[name], bytes=fs.readFileSync(new URL(url));
    assert.ok(record);assert.equal(bytes.length,record.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
    assert.ok(record.width===256||record.width===512);assert.equal(record.width,record.height);
  }
 });
 test('registering a catalog does not load any image', () => {
  let calls=0; const assets=new PBRTextureSets(THREE,{sets:mock,loadTexture:()=>{calls++;return immediate('c');}});
  assert.equal(calls,0);assert.equal(assets.getDiagnostics().textureCount,0);assets.dispose();
 });
 test('sets become visible atomically only after the last map has loaded', async () => {
  const requests = Object.fromEntries(['c','n','r'].map(k=>[k,deferred()]));let notifications=0;
  const assets=new PBRTextureSets(THREE,{sets:mock,loadTexture:url=>requests[url].promise});
  const lease=assets.acquire('sample','balanced',[1,1],()=>notifications++);await tick();
  requests.c.resolve(texture()); requests.n.resolve(texture());await tick();assert.equal(lease.maps,null);
  requests.r.resolve(texture());await assets.whenIdle();assert.equal(lease.status,'ready');
  assert.deepEqual(Object.keys(lease.maps),['color','normal','roughness']);assert.equal(notifications,1);lease.release();assets.dispose();
 });
 test('complete-set failure leaves no partially installed textures or retained source images', async () => {
  const source=texture();const assets=new PBRTextureSets(THREE,{sets:mock,loadTexture:url=>url==='n'?Promise.reject(new Error('404 normal')):Promise.resolve(source.clone())});
  const lease=assets.acquire('sample','high',[1,1]);await assets.whenIdle();
  assert.equal(lease.status,'failed');assert.equal(lease.maps,null);assert.equal(assets.getDiagnostics().sourceImageCount,0);
  assert.match(lease.error,/404/);lease.release();assets.dispose();
 });
 test('identical UV variants share a set; different scales share images, not repeat settings', async () => {
  const calls=[];const assets=new PBRTextureSets(THREE,{sets:mock,loadTexture:url=>{calls.push(url);return immediate(url);}});
  const a=assets.acquire('sample','balanced',[1,1]), b=assets.acquire('sample','high',[1,1]), c=assets.acquire('sample','balanced',[2,.5]);
  await assets.whenIdle();assert.equal(calls.length,3);assert.equal(a.maps,b.maps);assert.notEqual(a.maps,c.maps);
  assert.equal(a.maps.color.source,c.maps.color.source);assert.deepEqual(a.maps.color.repeat.toArray(),[1,1]);assert.deepEqual(c.maps.color.repeat.toArray(),[.5,2]);
  a.release();assert.equal(assets.getDiagnostics().textureCount,6);b.release();assert.equal(assets.getDiagnostics().textureCount,3);
  c.release();assert.equal(assets.getDiagnostics().sourceImageCount,0);assets.dispose();
 });
 test('low requests only the low color asset, never detail maps', async () => {
  const calls=[];const assets=new PBRTextureSets(THREE,{sets:mock,loadTexture:url=>{calls.push(url);return immediate(url);}});
  const lease=assets.acquire('sample','low',[1,1]);await assets.whenIdle();assert.deepEqual(calls,['small']);assert.deepEqual(Object.keys(lease.maps),['color']);assets.dispose();
 });
 test('disabled/headless mode keeps synchronous procedural materials without image requests', () => {
  let calls=0;const lib=new MaterialLibrary(THREE,{textureAssets:false,loadTexture:()=>{calls++;return immediate('');}});
  const metal=lib.create('aluminium.powderCoated'), deck=lib.create('wood.deck');
  assert.ok(metal.normalMap&&deck.map);assert.equal(calls,0);assert.equal(lib.getDiagnostics().textureAssets.status,'disabled');lib.dispose();
 });
 test('PBR color/data encodings, flipY and metre-scale repeats are explicit', async () => {
  const lib=new MaterialLibrary(THREE,{loadTexture:immediate});const metal=lib.create('aluminium.powderCoated'),deck=lib.create('wood.deck');
  await lib.whenTexturesReady();assert.equal(deck.map.colorSpace,THREE.SRGBColorSpace);assert.equal(deck.normalMap.colorSpace,THREE.NoColorSpace);
  assert.equal(deck.roughnessMap.colorSpace,THREE.NoColorSpace);assert.equal(metal.normalMap.flipY,false);assert.equal(deck.map.flipY,true);
  assert.equal(metal.normalMap.wrapS,THREE.RepeatWrapping);assert.equal(metal.normalMap.minFilter,THREE.LinearMipmapLinearFilter);
  assert.deepEqual(deck.map.repeat.toArray(),[1/1.5,1/1.5]);lib.dispose();
 });
 test('normal-map calibration and chosen coating color survive successful asynchronous loading', async () => {
  const lib=new MaterialLibrary(THREE,{loadTexture:immediate});const metal=lib.create('aluminium.powderCoated',{color:'#383e42'});
  const fallback=metal.normalMap, strength=metal.normalScale.x, roughness=metal.roughness, env=metal.envMapIntensity;
  await lib.whenTexturesReady();assert.notEqual(metal.normalMap,fallback);assert.equal(metal.normalScale.x,strength);
  assert.equal(metal.roughness,roughness);assert.equal(metal.envMapIntensity,env);assert.equal(metal.color.getHexString(),'383e42');lib.dispose();
 });
 test('a managed clone joins in-flight assets and keeps its own tint', async () => {
  let calls=0;const lib=new MaterialLibrary(THREE,{loadTexture:url=>{calls++;return immediate(url);}});
  const a=lib.create('wood.deck'),b=lib.clone(a);b.color.set('#b8ada0');await lib.whenTexturesReady();
  assert.equal(calls,3);assert.equal(a.map,b.map);assert.equal(b.color.getHexString(),'b8ada0');a.dispose();assert.ok(b.map.image);lib.dispose();
 });
 test('balanced/high reuse sources; low releases detailed assets and returns to detail safely', async () => {
  let calls=0;const lib=new MaterialLibrary(THREE,{loadTexture:url=>{calls++;return immediate(url);}});
  const metal=lib.create('aluminium.powderCoated'),deck=lib.create('wood.deck');await lib.whenTexturesReady();
  const normal=metal.normalMap;lib.setQuality('high');await lib.whenTexturesReady();assert.equal(metal.normalMap,normal);assert.equal(calls,5);
  lib.setQuality('low');await lib.whenTexturesReady();assert.equal(metal.normalMap,null);assert.equal(deck.normalMap,null);assert.ok(deck.map);
  assert.equal(lib.assets.getDiagnostics().textureCount,1);assert.equal(lib.assets.getDiagnostics().sourceImageCount,1);
  lib.setQuality('balanced');await lib.whenTexturesReady();assert.ok(metal.normalMap&&deck.roughnessMap);assert.equal(lib.assets.getDiagnostics().textureCount,5);lib.dispose();
 });
 test('retired requests cannot attach after a rapid quality switch', async () => {
  const requests=[];const lib=new MaterialLibrary(THREE,{loadTexture:url=>{const d=deferred();requests.push(d);return d.promise;}});
  const material=lib.create('aluminium.powderCoated');await tick();lib.setQuality('low');
  const late=requests.map(()=>texture());requests.forEach((d,i)=>d.resolve(late[i]));await tick();
  assert.equal(material.normalMap,null);assert.ok(late.every(t=>t.disposedCount===1));assert.equal(lib.assets.getDiagnostics().sourceImageCount,0);lib.dispose();
 });
 test('disposing an in-flight material cancels ownership and disposes late texture results once', async () => {
  const requests=[];const lib=new MaterialLibrary(THREE,{loadTexture:()=>{const d=deferred();requests.push(d);return d.promise;}});
  const material=lib.create('aluminium.powderCoated');await tick();material.dispose();lib.dispose();
  const late=requests.map(()=>texture());requests.forEach((d,i)=>d.resolve(late[i]));await tick();
  assert.ok(late.every(t=>t.disposedCount===1));assert.equal(lib.assets.getDiagnostics().textureCount,0);
 });
 test('timeout chooses fallback, settles readiness and disposes a late successful result', async () => {
  const d=deferred(),assets=new PBRTextureSets(THREE,{sets:{one:{detail:{size:256,maps:{normal:'n'}}}},loadTexture:()=>d.promise,timeoutMs:15});
  const lease=assets.acquire('one','high',[1,1]);await assets.whenIdle();assert.equal(lease.status,'failed');assert.match(lease.error,/timed out/);
  const late=texture();d.resolve(late);await tick();assert.equal(late.disposedCount,1);assets.dispose();
 });
 test('failed sets do not retry on every apply or environment update', async () => {
  let calls=0;const lib=new MaterialLibrary(THREE,{loadTexture:()=>{calls++;return Promise.reject(new Error('unavailable'));}});
  const m=lib.create('aluminium.powderCoated'),fallback=m.normalMap;await lib.whenTexturesReady();
  for(let i=0;i<10;i++){lib.apply(m);lib.setEnvironmentIntensity(.5);}assert.equal(calls,2);assert.equal(m.normalMap,fallback);
  assert.equal(lib.getDiagnostics().textureAssets.status,'fallback');lib.dispose();
 });
 test('new photographic material can be registered without a procedural provider or product changes', async () => {
  const lib=new MaterialLibrary(THREE,{loadTexture:immediate});lib.assets.register('custom',mock.sample);
  lib.register('wood.custom',{type:'standard',color:'#fff',textureSet:'custom',tile:[1,1]});
  const m=lib.create('wood.custom');assert.equal(m.map,null);await lib.whenTexturesReady();assert.ok(m.map&&m.normalMap);lib.dispose();
 });
 test('invalid tiles, invalid roles and duplicate texture sets fail clearly', () => {
  const assets=new PBRTextureSets(THREE,{sets:mock,loadTexture:immediate});
  assert.throws(()=>assets.acquire('sample','balanced',[0,1]));assert.throws(()=>assets.register('sample',mock.sample));
  assert.throws(()=>assets.register('bad',{detail:{size:256,maps:{gloss:'x'}}}));assert.throws(()=>assets.acquire('missing','high',[1,1]));assets.dispose();
 });
 test('wrong image dimensions choose fallback instead of silently stretching bad files', async () => {
  const assets=new PBRTextureSets(THREE,{sets:mock,loadTexture:()=>Promise.resolve(texture(32))});
  const lease=assets.acquire('sample','high',[1,1]);await assets.whenIdle();assert.equal(lease.status,'failed');assert.match(lease.error,/dimensions/);assets.dispose();
 });
 test('resource counts return to zero after repeated complete scene lifecycles', async () => {
  const assets=new PBRTextureSets(THREE,{sets:mock,loadTexture:immediate});
  for(let i=0;i<12;i++){const lease=assets.acquire('sample','balanced',[1,1]);await assets.whenIdle();lease.release();assert.equal(assets.getDiagnostics().textureCount,0);assert.equal(assets.getDiagnostics().sourceImageCount,0);}
  assets.dispose();assets.dispose();assert.equal(assets.getDiagnostics().status,'disposed');
 });
