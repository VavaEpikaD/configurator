import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createWindowFixture } from './helpers/windowFixture.mjs';
import { WINDOW_CASES, applyWindowCase } from './helpers/windowCases.mjs';
import { productGeometrySnapshot } from './helpers/geometrySnapshot.mjs';
const baseline = JSON.parse(fs.readFileSync(new URL('./fixtures/window-geometry-v1.json', import.meta.url)));

for (const item of WINDOW_CASES) test(`Window exact/no-edge full-builder regression: ${item.name}`, async () => {
  const fixture = await createWindowFixture({ edgeDetails: false, layout: item.layout, builderOptions: { getSelectedHandleSide: () => item.handle ?? 'right' } });
  for (const id of ['widthA', 'heightB', 'mBatant']) fixture.loader.context.document.getElementById(id);
  applyWindowCase(fixture, item);
  const actual = { product: productGeometrySnapshot(fixture.builder.placementRoot),
    sections: productGeometrySnapshot(fixture.builder.sectionGroup), fabrication: fixture.builder.getFabricationSnapshot() };
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), baseline.cases[item.name]);
  let unshared = 0;
  fixture.builder.placementRoot.traverse(object => { if (object.isMesh && !object.geometry.userData.sharedGeometry) unshared++; });
  assert.equal(unshared, 0);
  // Same state, second rebuild, with the builder's template cache retained.
  applyWindowCase(fixture, item);
  assert.equal(productGeometrySnapshot(fixture.builder.placementRoot).hash, baseline.cases[item.name].product.hash);
  fixture.builder.clearTemplateGeometryCache(); fixture.materials.dispose();
});

test('T-grid fixed-pane numbering fallback no longer throws on a missing cellIndex', async () => {
  // The accepted baseline threw ReferenceError here: the forEach callback used
  // fixedCellIndex but did not declare its index parameter. This case records a
  // targeted repair, not a claim of byte-for-byte equality with a broken build.
  const item = { layout: 'top-fixed-bottom-sash-sash', width: 2.4, height: 2.2 };
  const fixture = await createWindowFixture(item);
  for (const id of ['widthA', 'heightB', 'mBatant']) fixture.loader.context.document.getElementById(id);
  applyWindowCase(fixture, item);
  const fabrication = fixture.builder.getFabricationSnapshot();
  assert.equal(fabrication.openingCells.length, 2); assert.equal(fabrication.fixedCells.length, 1);
  assert.equal(fabrication.glassPieces.length, 3);
  fixture.builder.placementRoot.traverse(object => {
    if (object.isMesh) assert.ok([...object.geometry.attributes.position.array].every(Number.isFinite));
  });
  fixture.builder.clearTemplateGeometryCache(); fixture.materials.dispose();
});
