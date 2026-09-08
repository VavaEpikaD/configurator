import { depthProfileStatistics } from '../domain/depthProfile.js';
import { routeLengthMeters } from '../domain/geometry.js';
import {
  firstUtilityCrossingEvent,
  getRouteEvents,
  isUtilityCrossingEvent,
  legacyCrossingToRouteEvent,
  routeEventDisplayIndex,
  routeEventTypeDefinition,
} from '../domain/routeEvents.js';
import { minimumTrenchWidthMeters, REGULATORY_RULES } from './ruleRegistry.js';

const COMPARISON_TOLERANCE = 1e-9;

function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function metric(value) {
  return `${finiteNumber(value).toFixed(2)} m`;
}

function degrees(value) {
  return `${finiteNumber(value).toFixed(0)}°`;
}

function eventContext(state, event) {
  if (!event) return {};
  const definition = routeEventTypeDefinition(event.type);
  return {
    eventId: event.id,
    contextKey: definition.labelKey,
    contextIndex: routeEventDisplayIndex(state, event),
  };
}

function createResult(rule, status, detailKey, detailVariables = {}, context = {}) {
  return {
    id: context.eventId ? `${rule.id}:${context.eventId}` : rule.id,
    ruleId: rule.id,
    packVersion: rule.packVersion,
    status,
    titleKey: rule.titleKey,
    detailKey,
    detailVariables,
    sourceLabel: rule.sourceLabel,
    sourceHref: rule.sourceHref,
    ...context,
  };
}

function resolveUtilityCrossing(state, event = null) {
  if (isUtilityCrossingEvent(event)) return event;
  const currentEvent = firstUtilityCrossingEvent(state);
  if (currentEvent) return currentEvent;
  return legacyCrossingToRouteEvent(state?.crossing);
}

export function evaluateMinimumCover(state) {
  const rule = REGULATORY_RULES.minimumCover;
  const routeLengthM = routeLengthMeters(state?.route?.points || []);
  const actualM = depthProfileStatistics(
    state?.depthPoints,
    routeLengthM,
    finiteNumber(state?.trench?.coverM, 1),
  ).minimumCoverM;
  const variables = {
    actual: metric(actualM),
    minimum: metric(rule.minimumM),
  };

  if (actualM >= rule.minimumM) {
    return createResult(rule, 'pass', 'validation.cover.pass', variables);
  }

  const osdAgreement = Boolean(state?.regulatory?.reducedCover?.osdAgreement);
  const additionalProtection = Boolean(state?.regulatory?.reducedCover?.additionalProtection);
  if (osdAgreement && additionalProtection) {
    return createResult(rule, 'warning', 'validation.cover.exception', variables);
  }

  return createResult(rule, 'blocked', 'validation.cover.blocked', variables);
}

export function evaluateTrenchWidth(state) {
  const rule = REGULATORY_RULES.minimumTrenchWidth;
  const actualM = finiteNumber(state?.trench?.widthM);
  const requiredM = minimumTrenchWidthMeters(state?.pipe?.diameterMm);
  const variables = {
    actual: metric(actualM),
    minimum: metric(requiredM),
  };
  const hasCaseSpecificGround = Object.values(state?.segmentSettings || {}).some((setting) => (
    rule.caseSpecificGroundTypes.includes(setting?.groundType)
  ));

  if (hasCaseSpecificGround) {
    return createResult(rule, 'not-evaluated', 'validation.trenchWidth.caseSpecific', variables);
  }
  if (actualM + COMPARISON_TOLERANCE >= requiredM) {
    return createResult(rule, 'pass', 'validation.trenchWidth.pass', variables);
  }
  return createResult(rule, 'blocked', 'validation.trenchWidth.blocked', variables);
}

export function evaluateBeddingLayer(state) {
  const rule = REGULATORY_RULES.beddingLayer;
  const actualM = finiteNumber(state?.trench?.beddingM);
  const variables = {
    actual: metric(actualM),
    minimum: metric(rule.minimumM),
    maximum: metric(rule.maximumM),
  };

  if (
    actualM + COMPARISON_TOLERANCE < rule.minimumM
    || actualM - COMPARISON_TOLERANCE > rule.maximumM
  ) {
    return createResult(rule, 'blocked', 'validation.bedding.thicknessBlocked', variables);
  }
  if (state?.trench?.beddingMaterial === 'unspecified') {
    return createResult(rule, 'missing', 'validation.bedding.materialMissing', variables);
  }
  if (state?.trench?.beddingMaterial !== rule.requiredMaterial) {
    return createResult(rule, 'blocked', 'validation.bedding.materialBlocked', variables);
  }
  return createResult(rule, 'pass', 'validation.bedding.pass', variables);
}

export function evaluateTrenchPreparation() {
  const rule = REGULATORY_RULES.trenchPreparation;
  return createResult(rule, 'not-evaluated', 'validation.trenchPreparation.notEvaluated');
}

export function evaluateCrossingAngle(state, event = null) {
  const rule = REGULATORY_RULES.crossingAngle;
  const crossingEvent = resolveUtilityCrossing(state, event);
  if (!crossingEvent) {
    return createResult(rule, 'not-evaluated', 'validation.crossing.notConfigured');
  }

  const actualDeg = finiteNumber(crossingEvent.crossing?.angleDeg);
  const variables = {
    actual: degrees(actualDeg),
    normal: degrees(rule.normalAngleDeg),
    minimum: degrees(rule.exceptionalMinimumAngleDeg),
  };
  const context = eventContext(state, crossingEvent);
  if (Math.abs(actualDeg - rule.normalAngleDeg) <= rule.normalToleranceDeg) {
    return createResult(rule, 'pass', 'validation.crossingAngle.pass', variables, context);
  }
  if (actualDeg >= rule.exceptionalMinimumAngleDeg) {
    return createResult(rule, 'warning', 'validation.crossingAngle.exception', variables, context);
  }
  return createResult(rule, 'blocked', 'validation.crossingAngle.blocked', variables, context);
}

export function evaluateCrossingOwnerApproval(state, event = null) {
  const rule = REGULATORY_RULES.crossingOwnerApproval;
  const crossingEvent = resolveUtilityCrossing(state, event);
  if (!crossingEvent) {
    return createResult(rule, 'not-evaluated', 'validation.crossing.notConfigured');
  }
  const context = eventContext(state, crossingEvent);
  return crossingEvent.crossing?.ownerApprovalDocumented
    ? createResult(rule, 'pass', 'validation.crossingApproval.pass', {}, context)
    : createResult(rule, 'blocked', 'validation.crossingApproval.blocked', {}, context);
}

export function evaluateCrossingVerticalSeparation(state, event = null) {
  const rule = REGULATORY_RULES.crossingVerticalSeparation;
  const crossingEvent = resolveUtilityCrossing(state, event);
  if (!crossingEvent) {
    return createResult(rule, 'not-evaluated', 'validation.crossing.notConfigured');
  }

  const actualM = finiteNumber(crossingEvent.crossing?.verticalClearanceM);
  const gasPosition = crossingEvent.crossing?.gasPosition === 'below' ? 'below' : 'above';
  const variables = {
    actual: metric(actualM),
    minimum: metric(rule.normalMinimumM),
  };
  const context = eventContext(state, crossingEvent);
  if (gasPosition === rule.normalGasPosition && actualM >= rule.normalMinimumM) {
    return createResult(rule, 'pass', 'validation.crossingClearance.pass', variables, context);
  }
  if (crossingEvent.crossing?.protectiveSleeve) {
    return createResult(rule, 'warning', 'validation.crossingClearance.exception', variables, context);
  }
  return createResult(rule, 'blocked', 'validation.crossingClearance.blocked', variables, context);
}

export function evaluateRegulatoryRules(state) {
  const commonResults = [
    evaluateMinimumCover(state),
    evaluateTrenchWidth(state),
    evaluateBeddingLayer(state),
    evaluateTrenchPreparation(state),
  ];
  const routeEvents = getRouteEvents(state).filter(isUtilityCrossingEvent);
  const fallbackLegacyEvent = routeEvents.length === 0
    ? legacyCrossingToRouteEvent(state?.crossing)
    : null;
  const crossingEvents = routeEvents.length > 0
    ? routeEvents
    : fallbackLegacyEvent ? [fallbackLegacyEvent] : [];

  if (crossingEvents.length === 0) {
    return [
      ...commonResults,
      evaluateCrossingOwnerApproval(state),
      evaluateCrossingAngle(state),
      evaluateCrossingVerticalSeparation(state),
    ];
  }

  return [
    ...commonResults,
    ...crossingEvents.flatMap((event) => [
      evaluateCrossingOwnerApproval(state, event),
      evaluateCrossingAngle(state, event),
      evaluateCrossingVerticalSeparation(state, event),
    ]),
  ];
}
