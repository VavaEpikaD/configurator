import { buildRouteSegments, routeLengthMeters } from './geometry.js';
import {
  buildDepthIntervals,
  buildDesignedPipeProfile,
  depthProfileStatistics,
  interpolatePipeProfileAtChainage,
  routeEventDepthZoneStatus,
} from './depthProfile.js';
import {
  PIPE_DIAMETERS_MM,
  PIPE_MATERIALS,
  resolvePipeProduct,
} from './pipeCatalog.js';
import {
  getRouteEvents,
  isUtilityCrossingEvent,
  routeEventDisplayIndex,
  routeEventTypeDefinition,
} from './routeEvents.js';
import {
  evaluateBeddingLayer,
  evaluateRegulatoryRules,
  evaluateTrenchWidth,
} from '../regulatory/ruleEngine.js';
import { minimumTrenchWidthMeters, REGULATORY_RULES } from '../regulatory/ruleRegistry.js';
import {
  assessNetworkConnection,
  EXISTING_NETWORK_METADATA,
} from '../network/networkConnection.js';

export { PIPE_DIAMETERS_MM, PIPE_MATERIALS };

export const GROUND_TYPES = Object.freeze({
  common: Object.freeze({ labelKey: 'option.ground.common', excavationEurM3: 28, color: '#a9784b' }),
  cohesive: Object.freeze({ labelKey: 'option.ground.cohesive', excavationEurM3: 36, color: '#8b5f45' }),
  granular: Object.freeze({ labelKey: 'option.ground.granular', excavationEurM3: 31, color: '#c5a56c' }),
  softRock: Object.freeze({ labelKey: 'option.ground.softRock', excavationEurM3: 72, color: '#8c8275' }),
  hardRock: Object.freeze({ labelKey: 'option.ground.hardRock', excavationEurM3: 135, color: '#696d70' }),
});

export const SURFACE_TYPES = Object.freeze({
  greenfield: Object.freeze({ labelKey: 'option.surface.greenfield', restorationEurM2: 9, color: '#73995a' }),
  pavers: Object.freeze({ labelKey: 'option.surface.pavers', restorationEurM2: 38, color: '#a7a69d' }),
  asphalt: Object.freeze({ labelKey: 'option.surface.asphalt', restorationEurM2: 68, color: '#555b60' }),
  concrete: Object.freeze({ labelKey: 'option.surface.concrete', restorationEurM2: 92, color: '#a9afb3' }),
});

const CURRENCY_FROM_EUR = Object.freeze({ EUR: 1, RON: 4.98, USD: 1.09 });
const BEDDING_EUR_M3 = 34;
const PRELIMINARY_FIXED_COST_EUR = 1_800;
const PIPE_ALLOWANCE_RATIO = 1.03;
// Article 197's 0.10 m cover above the pipe remains a fixed quantity assumption in this slice.
const SAND_SURROUND_ABOVE_PIPE_M = 0.1;

function numberOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function segmentSetting(state, segment) {
  return state.segmentSettings?.[segment.id] || { groundType: 'common', surfaceType: 'greenfield' };
}

export function calculateProject(state, { terrainSamples = null } = {}) {
  const segments = buildRouteSegments(state.route.points);
  const routeLengthM = routeLengthMeters(state.route.points);
  const pipeProduct = resolvePipeProduct(state.pipe);
  const diameterMm = pipeProduct.outsideDiameterMm;
  const outsideDiameterM = diameterMm / 1_000;
  const internalDiameterM = pipeProduct.internalDiameterMm / 1_000;
  const wallThicknessM = pipeProduct.wallThicknessMm / 1_000;
  const coverM = Math.max(0, numberOr(state.trench.coverM, 1));
  const trenchWidthM = Math.max(0, numberOr(state.trench.widthM, 0.55));
  const beddingM = Math.max(0, numberOr(state.trench.beddingM, 0.1));
  const trenchDepthM = coverM + outsideDiameterM + beddingM;
  const requiredTrenchWidthM = minimumTrenchWidthMeters(diameterMm);
  const trenchWidthAssessment = evaluateTrenchWidth(state);
  const beddingAssessment = evaluateBeddingLayer(state);
  const beddingThicknessCompliant = (
    beddingM >= REGULATORY_RULES.beddingLayer.minimumM
    && beddingM <= REGULATORY_RULES.beddingLayer.maximumM
  );
  const beddingMaterialCompliant = state.trench.beddingMaterial === REGULATORY_RULES.beddingLayer.requiredMaterial;
  const depthProfile = depthProfileStatistics(state.depthPoints, routeLengthM, coverM);
  const depthIntervals = buildDepthIntervals(segments, state.depthPoints, routeLengthM, coverM);
  const designedProfile = buildDesignedPipeProfile({
    state,
    terrainSamples,
    routeLengthM,
    depthPoints: state.depthPoints,
    defaultCoverM: coverM,
    outsideDiameterM,
  });
  const stationProfile = interpolatePipeProfileAtChainage(
    designedProfile.samples,
    state.route.stationM,
  );

  const perSegment = segments.map((segment) => {
    const setting = segmentSetting(state, segment);
    const ground = GROUND_TYPES[setting.groundType] || GROUND_TYPES.common;
    const surface = SURFACE_TYPES[setting.surfaceType] || SURFACE_TYPES.greenfield;
    const intervals = depthIntervals.filter((interval) => interval.segmentId === segment.id);
    const excavationM3 = intervals.reduce((sum, interval) => (
      sum + interval.lengthM * trenchWidthM * (
        interval.averageCoverM + outsideDiameterM + beddingM
      )
    ), 0);
    const uniformExcavationM3 = segment.lengthM * trenchWidthM * trenchDepthM;
    const beddingEnvelopeHeightM = beddingM + outsideDiameterM + SAND_SURROUND_ABOVE_PIPE_M;
    const beddingM3 = segment.lengthM * trenchWidthM * beddingEnvelopeHeightM;
    const pipeDisplacementM3 = segment.lengthM * Math.PI * (outsideDiameterM / 2) ** 2;
    const backfillM3 = Math.max(0, excavationM3 - beddingM3 - pipeDisplacementM3);
    const restorationM2 = segment.lengthM * trenchWidthM;
    const excavationCostEur = excavationM3 * ground.excavationEurM3;
    const beddingCostEur = beddingM3 * BEDDING_EUR_M3;
    const restorationCostEur = restorationM2 * surface.restorationEurM2;
    const weightedCoverM2 = intervals.reduce((sum, interval) => (
      sum + interval.lengthM * interval.averageCoverM
    ), 0);

    return {
      ...segment,
      setting,
      ground,
      surface,
      depthIntervals: intervals,
      minimumCoverM: intervals.length > 0
        ? Math.min(...intervals.flatMap((interval) => [interval.startCoverM, interval.endCoverM]))
        : coverM,
      maximumCoverM: intervals.length > 0
        ? Math.max(...intervals.flatMap((interval) => [interval.startCoverM, interval.endCoverM]))
        : coverM,
      averageCoverM: segment.lengthM > 0 ? weightedCoverM2 / segment.lengthM : coverM,
      excavationM3,
      uniformExcavationM3,
      beddingM3,
      backfillM3,
      restorationM2,
      excavationCostEur,
      beddingCostEur,
      restorationCostEur,
    };
  });

  const designedPipeLengthM = Number.isFinite(designedProfile.designedPipeLengthM)
    ? designedProfile.designedPipeLengthM
    : routeLengthM;
  const terrainLengthM = Number.isFinite(designedProfile.terrainLengthM)
    ? designedProfile.terrainLengthM
    : routeLengthM;
  const pipeLengthM = designedPipeLengthM * PIPE_ALLOWANCE_RATIO;
  const pipeCostEur = pipeLengthM * pipeProduct.prototypeUnitRateEurM;
  const excavationM3 = perSegment.reduce((sum, segment) => sum + segment.excavationM3, 0);
  const uniformCoverExcavationM3 = perSegment.reduce((sum, segment) => sum + segment.uniformExcavationM3, 0);
  const beddingM3 = perSegment.reduce((sum, segment) => sum + segment.beddingM3, 0);
  const backfillM3 = perSegment.reduce((sum, segment) => sum + segment.backfillM3, 0);
  const restorationM2 = perSegment.reduce((sum, segment) => sum + segment.restorationM2, 0);
  const routeWorkCostEur = perSegment.reduce((sum, segment) => (
    sum + segment.excavationCostEur + segment.beddingCostEur + segment.restorationCostEur
  ), 0);
  const estimateMidEur = pipeCostEur + routeWorkCostEur + PRELIMINARY_FIXED_COST_EUR;
  const routeEventDepthZones = getRouteEvents(state).map((event) => ({
    event,
    ...routeEventDepthZoneStatus(state.depthPoints, event, routeLengthM),
  }));

  return {
    segments: perSegment,
    depthIntervals,
    routeLengthM,
    terrainLengthM,
    designedPipeLengthM,
    pipeLengthM,
    pipeAllowanceRatio: PIPE_ALLOWANCE_RATIO,
    diameterMm,
    outsideDiameterM,
    internalDiameterM,
    wallThicknessM,
    pipeProduct,
    pipeCatalogVersion: pipeProduct.catalogVersion,
    pipeProductId: pipeProduct.id,
    pipeUnitRateEurM: pipeProduct.prototypeUnitRateEurM,
    coverM,
    minimumCoverM: depthProfile.minimumCoverM,
    maximumCoverM: depthProfile.maximumCoverM,
    averageCoverM: depthProfile.averageCoverM,
    depthControls: depthProfile.controls,
    effectiveDepthPoints: depthProfile.effectivePoints,
    duplicateDepthPointStations: depthProfile.duplicates,
    maximumTrenchDepthM: depthProfile.maximumCoverM + outsideDiameterM + beddingM,
    stationCoverM: stationProfile?.coverM ?? coverM,
    stationTrenchDepthM: (stationProfile?.coverM ?? coverM) + outsideDiameterM + beddingM,
    stationProfile,
    routeEventDepthZones,
    profileTerrainSource: designedProfile.terrainSource,
    profileUsesLiveTerrain: designedProfile.liveTerrain,
    profileSamples: designedProfile.samples,
    terrainProfileSamples: designedProfile.terrainSamples,
    abruptProfileSegments: designedProfile.abruptSegments,
    trenchWidthM,
    requiredTrenchWidthM,
    trenchWidthAssessment,
    beddingM,
    beddingMinimumM: REGULATORY_RULES.beddingLayer.minimumM,
    beddingMaximumM: REGULATORY_RULES.beddingLayer.maximumM,
    beddingAssessment,
    beddingThicknessCompliant,
    beddingMaterialCompliant,
    trenchDepthM,
    excavationM3,
    uniformCoverExcavationM3,
    excavationDifferenceM3: excavationM3 - uniformCoverExcavationM3,
    beddingM3,
    backfillM3,
    restorationM2,
    estimateLowEur: estimateMidEur * 0.8,
    estimateMidEur,
    estimateHighEur: estimateMidEur * 1.2,
    costBreakdown: {
      pipeEur: pipeCostEur,
      routeWorkEur: routeWorkCostEur,
      fixedEur: PRELIMINARY_FIXED_COST_EUR,
    },
  };
}

export function buildValidationResults(state, calculation, { elevationProfile = null } = {}) {
  const results = [];

  results.push({
    id: 'route',
    status: calculation.routeLengthM > 0 ? 'pass' : 'blocked',
    titleKey: 'validation.route.title',
    detailKey: calculation.routeLengthM > 0 ? 'validation.route.pass' : 'validation.route.blocked',
  });

  const networkConnection = assessNetworkConnection(state);
  results.push({
    id: 'network-connection',
    status: networkConnection.connected ? 'pass' : networkConnection.candidate ? 'warning' : 'missing',
    titleKey: 'validation.networkConnection.title',
    detailKey: networkConnection.connected
      ? 'validation.networkConnection.pass'
      : networkConnection.candidate
        ? 'validation.networkConnection.warning'
        : 'validation.networkConnection.missing',
    detailVariables: networkConnection.candidate ? {
      asset: networkConnection.candidate.name,
      distance: formatDistance(
        networkConnection.distanceM,
        state.preferences.units,
        state.preferences.locale,
      ),
    } : {},
    sourceLabel: EXISTING_NETWORK_METADATA.source || 'Company-supplied KMZ',
    sourceHref: EXISTING_NETWORK_METADATA.sourceUrl,
  });

  results.push(...evaluateRegulatoryRules(state));

  if (calculation.duplicateDepthPointStations.length > 0) {
    results.push({
      id: 'depth-profile-duplicates',
      status: 'warning',
      titleKey: 'validation.depthProfile.title',
      detailKey: 'validation.depthProfile.duplicates',
      detailVariables: { count: calculation.duplicateDepthPointStations.length },
    });
  }

  if (calculation.abruptProfileSegments.length > 0) {
    results.push({
      id: 'depth-profile-abrupt',
      status: 'warning',
      titleKey: 'validation.depthProfile.title',
      detailKey: 'validation.depthProfile.abrupt',
      detailVariables: { count: calculation.abruptProfileSegments.length },
    });
  }

  const incompleteDepthZones = calculation.routeEventDepthZones.filter(({ status, expected }) => (
    expected && status !== 'ready'
  ));
  incompleteDepthZones.forEach(({ event, status }) => {
    const definition = routeEventTypeDefinition(event.type);
    results.push({
      id: `depth-profile-route-event:${event.id}`,
      status: 'warning',
      titleKey: 'validation.depthProfile.title',
      contextKey: definition.labelKey,
      contextIndex: routeEventDisplayIndex(state, event),
      detailKey: status === 'stale'
        ? 'validation.depthProfile.crossingStale'
        : 'validation.depthProfile.crossingMissing',
    });
  });

  if (
    calculation.duplicateDepthPointStations.length === 0
    && calculation.abruptProfileSegments.length === 0
    && incompleteDepthZones.length === 0
  ) {
    results.push({
      id: 'depth-profile',
      status: 'pass',
      titleKey: 'validation.depthProfile.title',
      detailKey: 'validation.depthProfile.pass',
    });
  }

  getRouteEvents(state).forEach((event) => {
    const definition = routeEventTypeDefinition(event.type);
    if (!event.confirmed) {
      results.push({
        id: `route-event-confirmation:${event.id}`,
        status: 'warning',
        titleKey: 'validation.routeEvent.title',
        contextKey: definition.labelKey,
        detailKey: 'validation.routeEvent.confirmationRequired',
      });
    }
    if (!isUtilityCrossingEvent(event)) {
      results.push({
        id: `route-event-rule-scope:${event.id}`,
        status: 'not-evaluated',
        titleKey: 'validation.routeEvent.title',
        contextKey: definition.labelKey,
        detailKey: 'validation.routeEvent.unreviewed',
      });
    }
  });

  const groundStatus = state.data.groundSource === 'verifiedSurvey' ? 'pass' : 'warning';
  const groundDetailKey = groundStatus === 'pass'
    ? 'validation.ground.verified'
    : elevationProfile?.status === 'ready'
      ? 'validation.ground.publicTerrain'
      : 'validation.ground.estimated';
  results.push({
    id: 'ground',
    status: groundStatus,
    titleKey: 'validation.ground.title',
    detailKey: groundDetailKey,
  });

  const utilityStatus = state.data.utilitySource === 'fieldVerified'
    ? 'pass'
    : state.data.utilitySource === 'ownerPlan' ? 'warning' : 'missing';
  results.push({
    id: 'utilities',
    status: utilityStatus,
    titleKey: 'validation.utilities.title',
    detailKey: `validation.utilities.${utilityStatus}`,
  });

  results.push({
    id: 'capacity',
    status: state.project.osdCapacityKnown ? 'warning' : 'missing',
    titleKey: 'validation.capacity.title',
    detailKey: state.project.osdCapacityKnown ? 'validation.capacity.supplied' : 'validation.capacity.missing',
    sourceLabel: 'ANRE Order 7/2022, Article 23',
    sourceHref: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/252209',
  });

  results.push({
    id: 'authorization',
    status: 'missing',
    titleKey: 'validation.authorization.title',
    detailKey: 'validation.authorization.required',
    sourceLabel: 'ANRE Order 7/2022, Art. 3(1)(g)-(h)',
    sourceHref: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/252209',
  });

  return results;
}

export function validationSummary(results = []) {
  return results.reduce((summary, result) => {
    summary[result.status] = (summary[result.status] || 0) + 1;
    return summary;
  }, { pass: 0, warning: 0, missing: 0, blocked: 0, 'not-evaluated': 0 });
}

export function convertFromEur(amountEur, currency = 'EUR') {
  return numberOr(amountEur, 0) * (CURRENCY_FROM_EUR[currency] || 1);
}

export function formatMoneyFromEur(amountEur, currency = 'EUR', locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: CURRENCY_FROM_EUR[currency] ? currency : 'EUR',
    maximumFractionDigits: 0,
  }).format(convertFromEur(amountEur, currency));
}

export function formatDistance(meters, units = 'metric', locale = 'en-US') {
  const value = numberOr(meters, 0);
  if (units === 'imperial') {
    const feet = value * 3.28084;
    if (feet >= 5_280) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(feet / 5_280)} mi`;
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(feet)} ft`;
  }
  if (value >= 1_000) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value / 1_000)} km`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} m`;
}

export function formatVolume(cubicMeters, units = 'metric', locale = 'en-US') {
  const value = units === 'imperial' ? numberOr(cubicMeters, 0) * 35.3147 : numberOr(cubicMeters, 0);
  const suffix = units === 'imperial' ? 'ft³' : 'm³';
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${suffix}`;
}

export function formatArea(squareMeters, units = 'metric', locale = 'en-US') {
  const value = units === 'imperial' ? numberOr(squareMeters, 0) * 10.7639 : numberOr(squareMeters, 0);
  const suffix = units === 'imperial' ? 'ft²' : 'm²';
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${suffix}`;
}
