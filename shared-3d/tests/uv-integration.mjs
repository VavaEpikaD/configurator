import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { GeometryLibrary, MaterialLibrary, disposeObjectResources } from '../src/index.js';
import { createWindowFixture } from './helpers/windowFixture.mjs';
import { WINDOW_CASES, applyWindowCase } from './helpers/windowCases.mjs';
import { productGeometrySnapshot } from './helpers/geometrySnapshot.mjs';
import { buildPergola } from '../../pergola-configurator/src/scene/buildPergola.js';
import { createPergolaGeometry } from '../../pergola-configurator/src/scene/pergolaGeometry.js';
import * as stateAPI from '../../pergola-configurator/src/state.js';
import { pergolaCases } from './helpers/pergolaCases.mjs';
const requireFromPergola = createRequire(new URL('../../pergola-configurator/package.json', import.meta.url));
const THREE = await import(pathToFileURL(path.join(path.dirname(requireFromPergola.resolve('three')), 'three.module.js')).href);
const protectedBaseline = JSON.parse(fs.readFileSync(new URL('./fixtures/uv-protected-v7.json', import.meta.url)));
const protect = group => productGeometrySnapshot(group, { excludeAttributes: ['uv'] }).hash;
const plain = value => JSON.parse(JSON.stringify(value));
const near = (a, b) => assert.ok(Math.abs(a - b) < 3e-6, `${a} != ${b}`);

for (const item of WINDOW_CASES) test(`Window current UVs preserve every non-UV buffer and fabrication field: ${item.name}`, async () => {
  const f = await createWindowFixture({ layout: item.layout, builderOptions: { getSelectedHandleSide: () => item.handle ?? 'right' } });
  for (const id of ['widthA','heightB','mBatant']) f.loader.context.document.getElementById(id);
  applyWindowCase(f, item);
  const expected = protectedBaseline.window.detailed[item.name];
  assert.equal(protect(f.builder.placementRoot), expected.product);
  assert.equal(protect(f.builder.sectionGroup), expected.sections);
  assert.equal(createHash('sha256').update(JSON.stringify(f.builder.getFabricationSnapshot())).digest('hex'), expected.fabrication);
  let members = 0, samples = 0;
  f.builder.placementRoot.traverse(o => {
    if (!o.isMesh || !o.userData.componentSelection) return;
    const side = o.userData.componentSelection.side, mapping = o.geometry.userData.surfaceMapping;
    assert.ok(mapping, `Missing product mapping for ${side}`);
    assert.equal(mapping.mode, 'extrusion');
    assert.equal(mapping.grainAxis, ['top','bottom','horizontal'].includes(side) ? 'x' : 'y');
    const p = o.geometry.attributes.position, n = o.geometry.attributes.normal, uv = o.geometry.attributes.uv;
    const get = mapping.grainAxis === 'x' ? 'getX' : 'getY';
    for (let i = 0; i < p.count; i++) if (Math.abs(n[get](i)) < 1e-5) near(uv.getX(i), p[get](i));
    members++;
  });
  f.builder.sectionGroup.traverse(o => {
    if (!o.isMesh) return; const m = o.geometry.userData.surfaceMapping;
    assert.equal(m?.grainAxis, 'z'); assert.equal(m.mode, 'extrusion'); samples++;
  });
  assert.ok(members > 0 && samples > 0);
  const before = productGeometrySnapshot(f.builder.placementRoot);
  for (const quality of ['low','high','balanced']) f.materials.setQuality(quality);
  assert.deepEqual(productGeometrySnapshot(f.builder.placementRoot), before);
  applyWindowCase(f,item);
  assert.deepEqual(productGeometrySnapshot(f.builder.placementRoot), before);
  f.builder.clearTemplateGeometryCache(); f.materials.dispose();
});
for (const {name,state} of pergolaCases(stateAPI)) test(`Pergola explicit member directions preserve accepted structure: ${name}`, () => {
  const lib = new GeometryLibrary(THREE), materials = new MaterialLibrary(THREE);
  const group = buildPergola(state,null,materials,lib);
  if (THREE.REVISION === protectedBaseline.threeRevision) assert.equal(protect(group), protectedBaseline.pergola.detailed[name]);
  group.traverse(o => {
    if (!o.isMesh) return;
    if (['post','beam','louver','gutter','glazing-rail'].includes(o.userData.geometryRole)) {
      assert.equal(o.geometry.userData.surfaceMapping?.mode, 'authored');
      assert.equal(o.geometry.userData.surfaceMapping.grainAxis, o.geometry.userData.edgeFinish.axis);
    }
    if (o.geometry.userData.sharedGeometry?.kind === 'primitive.cylinder') {
      assert.equal(o.geometry.userData.surfaceMapping?.mode, 'cylindrical');
      assert.equal(o.geometry.userData.surfaceMapping.grainAxis, 'y');
    }
  });
  const before = productGeometrySnapshot(group);
  for (const q of ['low','balanced','high']) materials.setQuality(q);
  assert.deepEqual(productGeometrySnapshot(group), before);
  disposeObjectResources(group,{materialFilter:()=>true});assert.equal(lib.getDiagnostics().uvMapping.declared,0);materials.dispose();lib.dispose();
});
test('mesh pooling replaces obsolete direction/UV metadata when the reused part changes orientation', async () => {
  const f = await createWindowFixture({meshReuse:true});
  const {createWindowGeometry} = await f.loader.import('window-configurator/src/client/js/window-geometry.js');
  const adapter = createWindowGeometry(), engine = await f.loader.import('window-configurator/src/client/js/three-mesh-reuse.js');
  const mat = f.materials.create('aluminium.bare');
  const a = adapter.profileMesh(adapter.library.create('primitive.box',{width:1,height:.05,depth:.08}),mat,'x');
  const root = new engine.Group(), inner = new engine.Group(); inner.add(a); root.add(inner); adapter.disposeGenerated(root); root.clear();
  const b = adapter.profileMesh(adapter.library.create('primitive.box',{width:.05,height:1,depth:.08}),mat,'y');
  assert.equal(a,b); assert.equal(b.geometry.userData.surfaceMapping.grainAxis,'y');
  const n=b.geometry.attributes.normal,p=b.geometry.attributes.position,uv=b.geometry.attributes.uv;
  for(let i=0;i<p.count;i++)if(Math.abs(n.getY(i))<.01)near(uv.getX(i),p.getY(i));
  adapter.library.dispose(); f.materials.dispose();
});
test('deck UV offsets and accepted rounded cross-section remain unchanged across widths', () => {
  const lib=new GeometryLibrary(THREE),adapter=createPergolaGeometry(lib);
  for(const width of [2,7,12]) for(const index of [0,1,7,25]) {
    const offset=[(index*.731)%1.5,(index*.413)%1.5];
    const g=adapter.boardGeometry(width,.02,.156,{offset});
    assert.equal(g.userData.surfaceMapping.mode,'authored');
    const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
    for(let i=0;i<p.count;i++)if(Math.abs(n.getX(i))<.01)near(uv.getX(i),p.getX(i)+offset[0]);
    const before=Array.from(uv.array);lib.prepare(g,{uv:true});assert.deepEqual(Array.from(g.attributes.uv.array),before);
  }
  lib.dispose();
});

test('Window live segmented resize updates UVs during drag and restores them on cancellation', async () => {
  const f=await createWindowFixture();
  const {createSegmentedResizeOptimizer}=await f.loader.import('window-configurator/src/client/js/segmented-resize-optimizer.js');
  const {createWindowGeometry}=await f.loader.import('window-configurator/src/client/js/window-geometry.js');
  const adapter=createWindowGeometry(),mat=f.materials.create('aluminium.bare');
  const mesh=adapter.profileMesh(adapter.library.create('primitive.box',{width:1.2,height:.05,depth:.08}),mat,'x');
  mesh.userData.componentSelection={source:'frame',side:'top'};
  const root=new f.THREE.Group();root.add(mesh);
  const state={windows:[{id:'w1',type:'opening-sash',rect:{x0:0,y0:0,x1:1,y1:1}}],gridTracks:{x:[{start:0,end:1,sizeM:1.2}],y:[{start:0,end:1,sizeM:1.5}]}};
  const optimizer=createSegmentedResizeOptimizer({mainGroup:root,getWindowState:()=>state,
    captureSurfaceUVDeformation:(g,p)=>adapter.library.captureSurfaceUVDeformation(g,p)});
  const positions=mesh.geometry.attributes.position.array.slice(),uv=mesh.geometry.attributes.uv.array.slice();
  for(const width of [2.4,.8,1.8]){
    const target=structuredClone(state);target.gridTracks.x[0].sizeM=width;
    assert.equal(optimizer.previewState(target),true);
    const expected=adapter.clone(mesh.geometry);adapter.prepare(expected,mat);
    for(let i=0;i<uv.length;i++)near(mesh.geometry.attributes.uv.array[i],expected.attributes.uv.array[i]);
    expected.dispose();
  }
  optimizer.cancelPreview();assert.deepEqual(mesh.geometry.attributes.position.array,positions);assert.deepEqual(mesh.geometry.attributes.uv.array,uv);
  assert.equal(optimizer.isPreviewActive(),false);adapter.library.dispose();f.materials.dispose();
});
