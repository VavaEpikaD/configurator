import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateProject } from '../src/domain/calculations.js';
import {
  DEFAULT_PIPE_PRODUCT_ID,
  findPipeProduct,
  normalizePipeSelection,
  PIPE_CATALOG_VERSION,
  PIPE_DIAMETERS_MM,
  PIPE_MATERIALS,
  PIPE_PRODUCTS,
  PIPE_SDRS,
  resolvePipeProduct,
} from '../src/domain/pipeCatalog.js';
import { DEFAULT_STATE } from '../src/state.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('the versioned PE catalogue contains one product for every supported combination', () => {
  const expectedCount = Object.keys(PIPE_MATERIALS).length
    * PIPE_DIAMETERS_MM.length
    * PIPE_SDRS.length;
  assert.equal(Object.keys(PIPE_PRODUCTS).length, expectedCount);
  assert.ok(Object.values(PIPE_PRODUCTS).every((product) => (
    product.catalogVersion === PIPE_CATALOG_VERSION
    && product.wallThicknessMm > 0
    && product.internalDiameterMm > 0
    && product.internalDiameterMm < product.outsideDiameterMm
    && product.prototypeUnitRateEurM > 0
  )));
});

test('SDR changes physical dimensions and the preliminary indexed pipe rate', () => {
  const sdr11 = findPipeProduct({ material: 'pe100', diameterMm: 63, sdr: 'SDR11' });
  const sdr17 = findPipeProduct({ material: 'pe100', diameterMm: 63, sdr: 'SDR17' });
  assert.ok(sdr11);
  assert.ok(sdr17);
  assert.ok(sdr11.wallThicknessMm > sdr17.wallThicknessMm);
  assert.ok(sdr11.internalDiameterMm < sdr17.internalDiameterMm);
  assert.ok(sdr11.prototypeUnitRateEurM > sdr17.prototypeUnitRateEurM);
});

test('an explicit material-diameter-SDR tuple overrides a stale product identifier', () => {
  const normalized = normalizePipeSelection({
    productId: DEFAULT_PIPE_PRODUCT_ID,
    material: 'pe100',
    diameterMm: 110,
    sdr: 'SDR17',
    designPressureBar: 20,
  });
  assert.equal(normalized.productId, 'pe100-110-sdr17');
  assert.equal(normalized.material, 'pe100');
  assert.equal(normalized.diameterMm, 110);
  assert.equal(normalized.sdr, 'SDR17');
  assert.equal(normalized.designPressureBar, 6);
  assert.equal(resolvePipeProduct(normalized).id, normalized.productId);
});

test('material and SDR selections affect the existing preliminary estimate', () => {
  const baseline = clone(DEFAULT_STATE);
  baseline.pipe = normalizePipeSelection({
    material: 'pe100',
    diameterMm: 63,
    sdr: 'SDR17',
    designPressureBar: 4,
  });
  const reinforced = clone(DEFAULT_STATE);
  reinforced.pipe = normalizePipeSelection({
    material: 'pe100rc',
    diameterMm: 63,
    sdr: 'SDR11',
    designPressureBar: 4,
  });

  const baselineCalculation = calculateProject(baseline);
  const reinforcedCalculation = calculateProject(reinforced);
  assert.equal(baselineCalculation.pipeCatalogVersion, PIPE_CATALOG_VERSION);
  assert.ok(reinforcedCalculation.pipeUnitRateEurM > baselineCalculation.pipeUnitRateEurM);
  assert.ok(reinforcedCalculation.estimateMidEur > baselineCalculation.estimateMidEur);
});
