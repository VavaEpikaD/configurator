/** Geometry/material acceptance captured immediately before the Step 9 overlay.
 * Actual builders; Window's fixture uses deterministic synthetic CAD sections.
 * Actual CAD assets are additionally exercised in contact-browser.mjs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createWindowFixture } from './helpers/windowFixture.mjs';
import { WINDOW_CASES, applyWindowCase } from './helpers/windowCases.mjs';
import { productGeometrySnapshot } from './helpers/geometrySnapshot.mjs';
import { pergolaCases } from './helpers/pergolaCases.mjs';
const root = process.env.CONTACT_COMPARE_ROOT || fileURLToPath(new URL('../../', import.meta.url));
const load = relative => import(pathToFileURL(path.join(root, relative)).href);
const THREE = await load('window-configurator/src/client/lib/three.module.js');
const { MaterialLibrary, GeometryLibrary, disposeObjectResources } = await load('shared-3d/src/index.js');
const { buildPergola } = await load('pergola-configurator/src/scene/buildPergola.js');
const state = await load('pergola-configurator/src/state.js');
const recorded = {};
const output = process.env.CONTACT_RECORD_BASELINE;
const expected = output ? {} : JSON.parse(fs.readFileSync(new URL('./fixtures/contact-pre-step9.json', import.meta.url), 'utf8')).cases;
const hash = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
function check(name, data) { if (output) recorded[name] = data; else assert.deepEqual(data, expected[name]); }
for (const item of WINDOW_CASES) test(`Step 9 preserves Window buffers, placements and fabrication: ${item.name}`, async () => {
  const fixture = await createWindowFixture({ root, layout: item.layout, builderOptions: { getSelectedHandleSide: () => item.handle ?? 'right' }, edgeDetails: true });
  for (const id of ['widthA', 'heightB', 'mBatant']) fixture.loader.context.document.getElementById(id);
  applyWindowCase(fixture, item);
  let handles = 0; fixture.builder.placementRoot.traverse(o => { if (o.isMesh && o.userData.windowHandleCellId) handles++; });
  const data = { product: productGeometrySnapshot(fixture.builder.placementRoot).hash,
    sections: productGeometrySnapshot(fixture.builder.sectionGroup).hash,
    fabrication: hash(fixture.builder.getFabricationSnapshot()), handles };
  check(`window:${item.name}`, data);
  assert.equal(handles % 3, 0);
  for (const quality of ['low', 'high', 'balanced']) {
    fixture.materials.setQuality(quality);
    assert.equal(productGeometrySnapshot(fixture.builder.placementRoot).hash, data.product);
  }
  fixture.builder.clearTemplateGeometryCache(); fixture.materials.dispose();
});
for (const item of pergolaCases(state)) test(`Step 9 preserves Pergola assembly and accessories: ${item.name}`, () => {
  const materials = new MaterialLibrary(THREE), geometry = new GeometryLibrary(THREE);
  const product = buildPergola(item.state, null, materials, geometry);
  const data = { product: productGeometrySnapshot(product).hash, materials: [] };
  product.traverse(o => { if (!o.isMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
    data.materials.push({ color:m.color?.getHexString(), metalness:m.metalness, roughness:m.roughness,
      envMapIntensity:m.envMapIntensity, opacity:m.opacity, transmission:m.transmission,
      normalScale:m.normalScale?.toArray(), surface:m.userData.surface?.id });
  } });
  check(`pergola:${item.name}`, { product:data.product, materials:hash(data.materials) });
  for (const quality of ['low','high','balanced']) {
    materials.setQuality(quality); assert.equal(productGeometrySnapshot(product).hash, data.product);
  }
  disposeObjectResources(product, { materialFilter: () => true }); geometry.dispose(); materials.dispose();
});
test('Step 9 preserves accepted architectural glass and coating optics', () => {
  const lib = new MaterialLibrary(THREE);
  const data = {};
  for (const id of ['aluminium.powderCoated','aluminium.bare','aluminium.anodized','glass.clear','glass.architectural','wood.deck']) {
    const m=lib.create(id); data[id] = { color:m.color?.getHexString(), roughness:m.roughness, metalness:m.metalness,
      envMapIntensity:m.envMapIntensity, transmission:m.transmission ?? 0, opacity:m.opacity, ior:m.ior ?? 0,
      thickness:m.thickness ?? 0, normalScale:m.normalScale.toArray() };
  }
  check('accepted-optics', data); lib.dispose();
});
if (output) process.on('beforeExit', () => fs.writeFileSync(output, JSON.stringify({ baseline:'main13 + UV8 + deck rebalance + restored handle + glass13', cases:recorded }, null, 2)+'\n'));
