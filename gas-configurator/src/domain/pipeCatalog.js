const DEFAULT_MATERIAL_ID = 'pe100rc';
const DEFAULT_DIAMETER_MM = 63;
const DEFAULT_SDR = 'SDR11';
const DEFAULT_DESIGN_PRESSURE_BAR = 4;
const MAX_PROTOTYPE_DESIGN_PRESSURE_BAR = 6;

export const PIPE_CATALOG_VERSION = 'RO-PE-PROTOTYPE@1';

export const PIPE_MATERIALS = Object.freeze({
  pe100rc: Object.freeze({
    id: 'pe100rc',
    labelKey: 'option.material.pe100rc',
    prototypeCostMultiplier: 1.12,
  }),
  pe100: Object.freeze({
    id: 'pe100',
    labelKey: 'option.material.pe100',
    prototypeCostMultiplier: 1,
  }),
});

export const PIPE_DIAMETERS_MM = Object.freeze([32, 40, 63, 90, 110]);
export const PIPE_SDRS = Object.freeze(['SDR11', 'SDR17']);

// Existing prototype rates are retained as the SDR11 PE100 baseline. SDR17 rates are
// indexed by relative wall cross-section so SDR now affects the preliminary estimate
// without presenting the catalogue as a supplier quotation.
const SDR11_BASE_PIPE_EUR_M = Object.freeze({
  32: 4.2,
  40: 5.4,
  63: 10.8,
  90: 18.5,
  110: 25.5,
});

function numberOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function sdrNumber(value) {
  const match = String(value || '').match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? numberOr(match[1], 0) : 0;
}

export function wallThicknessMm(outsideDiameterMm, sdr) {
  const diameter = Math.max(0, numberOr(outsideDiameterMm, 0));
  const ratio = sdrNumber(sdr);
  return ratio > 0 ? diameter / ratio : 0;
}

export function internalDiameterMm(outsideDiameterMm, sdr) {
  const diameter = Math.max(0, numberOr(outsideDiameterMm, 0));
  return Math.max(0, diameter - (2 * wallThicknessMm(diameter, sdr)));
}

function wallAreaIndex(outsideDiameterMm, sdr) {
  const outside = Math.max(0, numberOr(outsideDiameterMm, 0));
  const inside = internalDiameterMm(outside, sdr);
  return Math.max(0, (Math.PI / 4) * ((outside ** 2) - (inside ** 2)));
}

export function pipeProductId(material, diameterMm, sdr) {
  return `${String(material || '').toLowerCase()}-${String(Math.round(numberOr(diameterMm, 0))).padStart(3, '0')}-${String(sdr || '').toLowerCase()}`;
}

const SDR11_AREA_BY_DIAMETER = Object.freeze(Object.fromEntries(
  PIPE_DIAMETERS_MM.map((diameterMm) => [diameterMm, wallAreaIndex(diameterMm, 'SDR11')]),
));

const PRODUCT_LIST = Object.freeze(Object.values(PIPE_MATERIALS).flatMap((material) => (
  PIPE_DIAMETERS_MM.flatMap((outsideDiameterMm) => PIPE_SDRS.map((sdr) => {
    const thicknessMm = wallThicknessMm(outsideDiameterMm, sdr);
    const insideDiameterMm = internalDiameterMm(outsideDiameterMm, sdr);
    const relativeWallArea = wallAreaIndex(outsideDiameterMm, sdr)
      / (SDR11_AREA_BY_DIAMETER[outsideDiameterMm] || 1);
    const prototypeUnitRateEurM = (SDR11_BASE_PIPE_EUR_M[outsideDiameterMm] || 0)
      * material.prototypeCostMultiplier
      * relativeWallArea;

    return Object.freeze({
      id: pipeProductId(material.id, outsideDiameterMm, sdr),
      catalogVersion: PIPE_CATALOG_VERSION,
      material: material.id,
      materialLabelKey: material.labelKey,
      outsideDiameterMm,
      sdr,
      wallThicknessMm: thicknessMm,
      internalDiameterMm: insideDiameterMm,
      maximumPrototypeDesignPressureBar: MAX_PROTOTYPE_DESIGN_PRESSURE_BAR,
      prototypeUnitRateEurM,
      prototypePricingBasis: 'existing-sdr11-rate-indexed-by-wall-area',
    });
  }))
)));

export const PIPE_PRODUCTS = Object.freeze(Object.fromEntries(
  PRODUCT_LIST.map((product) => [product.id, product]),
));

export const DEFAULT_PIPE_PRODUCT_ID = pipeProductId(
  DEFAULT_MATERIAL_ID,
  DEFAULT_DIAMETER_MM,
  DEFAULT_SDR,
);

export function getPipeProduct(productId) {
  return PIPE_PRODUCTS[String(productId || '')] || null;
}

export function findPipeProduct({ material, diameterMm, sdr } = {}) {
  return getPipeProduct(pipeProductId(material, diameterMm, sdr));
}

export function normalizePipeSelection(selection = {}, fallbackSelection = {}) {
  const fallbackProduct = (
    getPipeProduct(fallbackSelection.productId)
    || findPipeProduct(fallbackSelection)
    || getPipeProduct(DEFAULT_PIPE_PRODUCT_ID)
  );
  // Prefer an explicit material/diameter/SDR tuple over a stale productId. This is
  // important when v1 state is merged with v2 defaults or callers patch a legacy
  // selection object directly. Normalized state keeps both representations aligned.
  const requestedProduct = (
    findPipeProduct(selection)
    || getPipeProduct(selection.productId)
    || fallbackProduct
  );
  const maximumPressureBar = Math.min(
    MAX_PROTOTYPE_DESIGN_PRESSURE_BAR,
    requestedProduct.maximumPrototypeDesignPressureBar,
  );
  const requestedPressureBar = numberOr(
    selection.designPressureBar,
    numberOr(fallbackSelection.designPressureBar, DEFAULT_DESIGN_PRESSURE_BAR),
  );

  return {
    catalogVersion: PIPE_CATALOG_VERSION,
    productId: requestedProduct.id,
    material: requestedProduct.material,
    diameterMm: requestedProduct.outsideDiameterMm,
    sdr: requestedProduct.sdr,
    designPressureBar: Math.min(maximumPressureBar, Math.max(0.05, requestedPressureBar)),
  };
}

export function resolvePipeProduct(selection = {}) {
  return findPipeProduct(selection)
    || getPipeProduct(selection.productId)
    || getPipeProduct(DEFAULT_PIPE_PRODUCT_ID);
}

export function pipeProductsForMaterial(material) {
  return PRODUCT_LIST.filter((product) => product.material === material);
}

export const DEFAULT_PIPE_SELECTION = Object.freeze(normalizePipeSelection({
  material: DEFAULT_MATERIAL_ID,
  diameterMm: DEFAULT_DIAMETER_MM,
  sdr: DEFAULT_SDR,
  designPressureBar: DEFAULT_DESIGN_PRESSURE_BAR,
}));
