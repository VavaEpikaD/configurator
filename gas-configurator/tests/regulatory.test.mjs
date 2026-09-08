import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateBeddingLayer,
  evaluateCrossingAngle,
  evaluateCrossingOwnerApproval,
  evaluateCrossingVerticalSeparation,
  evaluateMinimumCover,
  evaluateRegulatoryRules,
  evaluateTrenchPreparation,
  evaluateTrenchWidth,
} from '../src/regulatory/ruleEngine.js';
import {
  minimumTrenchWidthMeters,
  REGULATORY_RULE_PACK,
  REGULATORY_RULES,
} from '../src/regulatory/ruleRegistry.js';
import { DEFAULT_STATE } from '../src/state.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('the regulatory registry is versioned and traceable to official articles', () => {
  assert.equal(REGULATORY_RULE_PACK.jurisdiction, 'RO');
  assert.equal(REGULATORY_RULE_PACK.version, '2023-01-26.prototype-2');
  assert.equal(REGULATORY_RULE_PACK.consolidationDate, '2023-01-26');
  assert.match(REGULATORY_RULE_PACK.source.href, /^https:\/\/legislatie\.just\.ro\//);
  assert.equal(REGULATORY_RULES.minimumCover.article, 'Art. 75');
  assert.equal(REGULATORY_RULES.crossingOwnerApproval.requiredEvidence, 'crossed-utility-owner-approval');
  assert.equal(REGULATORY_RULES.crossingAngle.exceptionalMinimumAngleDeg, 60);
  assert.equal(REGULATORY_RULES.crossingVerticalSeparation.normalMinimumM, 0.2);
  assert.equal(REGULATORY_RULES.beddingLayer.granulationMinimumMm, 0.3);
  assert.equal(REGULATORY_RULES.beddingLayer.granulationMaximumMm, 0.8);
});

test('Article 194 trench-width formula switches at DN 100', () => {
  assert.equal(minimumTrenchWidthMeters(63), 0.4);
  assert.ok(Math.abs(minimumTrenchWidthMeters(110) - 0.51) < 1e-12);

  const state = clone(DEFAULT_STATE);
  state.trench.widthM = 0.39;
  assert.equal(evaluateTrenchWidth(state).status, 'blocked');
  state.trench.widthM = 0.4;
  assert.equal(evaluateTrenchWidth(state).status, 'pass');

  state.pipe.diameterMm = 110;
  state.trench.widthM = 0.5;
  assert.equal(evaluateTrenchWidth(state).status, 'blocked');
  state.trench.widthM = 0.51;
  assert.equal(evaluateTrenchWidth(state).status, 'pass');
});

test('sandy or gravel ground keeps trench dimensions case-specific', () => {
  const state = clone(DEFAULT_STATE);
  state.segmentSettings['a:b'].groundType = 'granular';
  state.trench.widthM = 0.8;
  assert.equal(evaluateTrenchWidth(state).status, 'not-evaluated');
});

test('Article 196 checks bedding thickness and graded-sand declaration separately', () => {
  const state = clone(DEFAULT_STATE);
  state.trench.beddingM = 0.1;
  assert.equal(evaluateBeddingLayer(state).status, 'pass');
  state.trench.beddingM = 0.15;
  assert.equal(evaluateBeddingLayer(state).status, 'pass');
  state.trench.beddingM = 0.09;
  assert.equal(evaluateBeddingLayer(state).status, 'blocked');
  state.trench.beddingM = 0.16;
  assert.equal(evaluateBeddingLayer(state).status, 'blocked');

  state.trench.beddingM = 0.1;
  state.trench.beddingMaterial = 'unspecified';
  assert.equal(evaluateBeddingLayer(state).status, 'missing');
  state.trench.beddingMaterial = 'other';
  assert.equal(evaluateBeddingLayer(state).status, 'blocked');
});

test('execution-stage trench preparation is not falsely auto-approved', () => {
  assert.equal(evaluateTrenchPreparation().status, 'not-evaluated');
});

test('normal cover passes while an unsupported reduction is blocked', () => {
  const state = clone(DEFAULT_STATE);
  assert.equal(evaluateMinimumCover(state).status, 'pass');
  state.trench.coverM = 0.8;
  assert.equal(evaluateMinimumCover(state).status, 'blocked');
});

test('reduced cover remains a warning when both exception declarations exist', () => {
  const state = clone(DEFAULT_STATE);
  state.trench.coverM = 0.8;
  state.regulatory.reducedCover.osdAgreement = true;
  state.regulatory.reducedCover.additionalProtection = true;
  assert.equal(evaluateMinimumCover(state).status, 'warning');
});

test('a crossing is not evaluated until the user declares one', () => {
  const results = evaluateRegulatoryRules(clone(DEFAULT_STATE));
  assert.equal(results.find((result) => result.id === REGULATORY_RULES.crossingAngle.id).status, 'not-evaluated');
  assert.equal(results.find((result) => result.id === REGULATORY_RULES.crossingOwnerApproval.id).status, 'not-evaluated');
  assert.equal(results.find((result) => result.id === REGULATORY_RULES.crossingVerticalSeparation.id).status, 'not-evaluated');
});

test('a declared crossing is blocked until utility-owner approval is documented', () => {
  const state = clone(DEFAULT_STATE);
  state.crossing.enabled = true;
  assert.equal(evaluateCrossingOwnerApproval(state).status, 'blocked');
  state.crossing.ownerApprovalDocumented = true;
  assert.equal(evaluateCrossingOwnerApproval(state).status, 'pass');
});

test('crossing angle distinguishes normal, exceptional and blocked geometry', () => {
  const state = clone(DEFAULT_STATE);
  state.crossing.enabled = true;
  state.crossing.angleDeg = 90;
  assert.equal(evaluateCrossingAngle(state).status, 'pass');
  state.crossing.angleDeg = 75;
  assert.equal(evaluateCrossingAngle(state).status, 'warning');
  state.crossing.angleDeg = 59;
  assert.equal(evaluateCrossingAngle(state).status, 'blocked');
});

test('crossing separation requires gas above with 0.20 m or a sleeve exception', () => {
  const state = clone(DEFAULT_STATE);
  state.crossing.enabled = true;
  state.crossing.gasPosition = 'above';
  state.crossing.verticalClearanceM = 0.2;
  assert.equal(evaluateCrossingVerticalSeparation(state).status, 'pass');

  state.crossing.verticalClearanceM = 0.15;
  assert.equal(evaluateCrossingVerticalSeparation(state).status, 'blocked');
  state.crossing.protectiveSleeve = true;
  assert.equal(evaluateCrossingVerticalSeparation(state).status, 'warning');

  state.crossing.gasPosition = 'below';
  state.crossing.verticalClearanceM = 0.4;
  state.crossing.protectiveSleeve = false;
  assert.equal(evaluateCrossingVerticalSeparation(state).status, 'blocked');
});

test('each configured utility crossing receives its own traceable rule results', async () => {
  const { normalizeState } = await import('../src/state.js');
  const state = normalizeState({
    routeEvents: [
      {
        id: 'utility-one',
        type: 'utility-crossing',
        stationM: 200,
        confirmed: true,
        crossing: {
          utilityType: 'water',
          angleDeg: 90,
          gasPosition: 'above',
          verticalClearanceM: 0.25,
          ownerApprovalDocumented: true,
        },
      },
      {
        id: 'utility-two',
        type: 'utility-crossing',
        stationM: 650,
        confirmed: true,
        crossing: {
          utilityType: 'electric',
          angleDeg: 70,
          gasPosition: 'below',
          verticalClearanceM: 0.1,
          protectiveSleeve: true,
          ownerApprovalDocumented: false,
        },
      },
      {
        id: 'road-one',
        type: 'road-crossing',
        stationM: 800,
        confirmed: false,
        crossing: { angleDeg: 88 },
      },
    ],
  });

  const results = evaluateRegulatoryRules(state);
  const crossingRuleIds = new Set([
    REGULATORY_RULES.crossingOwnerApproval.id,
    REGULATORY_RULES.crossingAngle.id,
    REGULATORY_RULES.crossingVerticalSeparation.id,
  ]);
  const crossingResults = results.filter((result) => crossingRuleIds.has(result.ruleId));

  assert.equal(crossingResults.length, 6);
  assert.equal(new Set(crossingResults.map((result) => result.id)).size, 6);
  assert.deepEqual(
    [...new Set(crossingResults.map((result) => result.eventId))].sort(),
    ['utility-one', 'utility-two'],
  );
  assert.ok(crossingResults.every((result) => result.contextKey === 'option.routeEventType.utilityCrossing'));
  assert.deepEqual(
    [...new Set(crossingResults.map((result) => result.contextIndex))].sort(),
    [1, 2],
  );
});
