import { getDefaultFenceFinishId, normalizeFenceFinish } from './finish-catalog.js?v=1';
export { FINISHES } from './finish-catalog.js?v=1';

export const PANEL_STYLES = Object.freeze({
  vertical: { labelKey: 'panel.vertical', pricePerM2: 145, material: 'Powder-coated aluminium vertical slats' },
  horizontal: { labelKey: 'panel.horizontal', pricePerM2: 160, material: 'Powder-coated aluminium horizontal slats' },
  privacy: { labelKey: 'panel.privacy', pricePerM2: 185, material: 'Solid aluminium privacy panel' },
  mesh: { labelKey: 'panel.mesh', pricePerM2: 82, material: 'Welded steel mesh panel' },
});

export const DEFAULT_FENCE_STATE = Object.freeze({
  layout: 'straight',
  runA: 8,
  runB: 5,
  runC: 5,
  runD: 5,
  angleB: 90,
  height: 1.8,
  targetBayWidth: 2,
  panelStyle: 'vertical',
  finish: 'anthracite',
  infillGap: 0.035,
  foundation: 'concrete',
  gates: Object.freeze([
    Object.freeze({ id: 'gate-1', type: 'pedestrian', runId: 'a', position: 1, handing: 'right' }),
  ]),
  scenery: false,
  showDimensions: true,
  compassVisible: false,
  technicalEdges: false,
  cameraPreset: '3d',
  sunPosition: 48,
  northDirection: 0,
  nightPreview: false,
});

export function createFenceState(source = {}) {
  const defaults = structuredClone(DEFAULT_FENCE_STATE);
  const incoming = structuredClone(source);
  if (!incoming.finish) defaults.finish = getDefaultFenceFinishId();
  // Old saved/share states used gateType/gateRun/gatePosition/gateHanding. Do
  // not let the new default gates array mask those legacy fields during merge.
  if (!Array.isArray(incoming.gates) && Object.prototype.hasOwnProperty.call(incoming, 'gateType')) delete defaults.gates;
  return normalizeFenceState({ ...defaults, ...incoming });
}

export function activeRunIds(state) {
  if (state.layout === 'straight') return ['a'];
  if (state.layout === 'l') return ['a', 'b'];
  if (state.layout === 'closed') return ['a', 'b', 'c', 'd'];
  if (state.layout === 'closed5') return ['a', 'b', 'c', 'd', 'e'];
  return ['a', 'b', 'c'];
}

/**
 * Closed-perimeter mode uses AB, BC and CD plus the interior angle at B.
 * CD stays parallel to AB and runs back toward A. DA is then the exact
 * closing segment from D to A, so it is never independently editable.
 */
export function calculateClosedFenceGeometry(state) {
  const a = Number(state.runA) || DEFAULT_FENCE_STATE.runA;
  const b = Number(state.runB) || DEFAULT_FENCE_STATE.runB;
  const c = Number(state.runC) || DEFAULT_FENCE_STATE.runC;
  const angleB = Number(state.angleB) || DEFAULT_FENCE_STATE.angleB;
  const headingBC = Math.PI - (angleB * Math.PI) / 180;

  const A = { x: 0, z: 0 };
  const B = { x: a, z: 0 };
  const C = {
    x: B.x + Math.cos(headingBC) * b,
    z: B.z + Math.sin(headingBC) * b,
  };
  const D = { x: C.x - c, z: C.z };
  const d = Math.hypot(D.x - A.x, D.z - A.z);

  return { A, B, C, D, runD: d, angleB, headingBC };
}

/**
 * Five-side closed-perimeter mode uses AB, BC, CD and DE plus the interior
 * angle at B. After BC, the path uses the 72° exterior turn of a pentagon
 * for the C and D corners; EA is the exact closing segment back to A. This
 * keeps the mode fully determined from four lengths plus one angle.
 */
export function calculateClosedFiveFenceGeometry(state) {
  const a = Number(state.runA) || DEFAULT_FENCE_STATE.runA;
  const b = Number(state.runB) || DEFAULT_FENCE_STATE.runB;
  const c = Number(state.runC) || DEFAULT_FENCE_STATE.runC;
  const d = Number(state.runD) || DEFAULT_FENCE_STATE.runD;
  const angleB = Number(state.angleB) || DEFAULT_FENCE_STATE.angleB;
  const headingBC = Math.PI - (angleB * Math.PI) / 180;
  const pentagonTurn = (72 * Math.PI) / 180;
  const headingCD = headingBC + pentagonTurn;
  const headingDE = headingCD + pentagonTurn;

  const A = { x: 0, z: 0 };
  const B = { x: a, z: 0 };
  const C = {
    x: B.x + Math.cos(headingBC) * b,
    z: B.z + Math.sin(headingBC) * b,
  };
  const D = {
    x: C.x + Math.cos(headingCD) * c,
    z: C.z + Math.sin(headingCD) * c,
  };
  const E = {
    x: D.x + Math.cos(headingDE) * d,
    z: D.z + Math.sin(headingDE) * d,
  };
  const e = Math.hypot(E.x - A.x, E.z - A.z);

  return { A, B, C, D, E, runE: e, angleB, headingBC, headingCD, headingDE };
}

export function runLength(state, runId) {
  if (runId === 'd' && state.layout === 'closed') return calculateClosedFenceGeometry(state).runD;
  if (runId === 'e' && state.layout === 'closed5') return calculateClosedFiveFenceGeometry(state).runE;
  return Number(state[`run${runId.toUpperCase()}`] ?? 0);
}

export function deriveRun(state, runId) {
  const length = Math.max(1, runLength(state, runId));
  const target = Math.max(0.8, Number(state.targetBayWidth) || 2);
  const bayCount = Math.max(1, Math.round(length / target));
  return {
    id: runId,
    length,
    bayCount,
    bayWidth: length / bayCount,
  };
}

export function deriveFenceMetrics(state) {
  const runs = activeRunIds(state).map((runId) => deriveRun(state, runId));
  const bayCount = runs.reduce((sum, run) => sum + run.bayCount, 0);
  const totalLength = runs.reduce((sum, run) => sum + run.length, 0);
  const closed = ['closed', 'closed5'].includes(state.layout);
  const cornerCount = closed ? runs.length : Math.max(0, runs.length - 1);
  const area = totalLength * state.height;
  const gates = deriveGates(state, runs);
  const removedGatePosts = gates.reduce((sum, gate) => sum + Math.max(0, gate.span - 1), 0);
  // Open runs have one more post than bays. A closed perimeter reuses the
  // final corner post at A, so its post count equals the total bay count.
  const postCount = bayCount + (closed ? 0 : 1) - removedGatePosts;
  const gateBayCount = gates.reduce((sum, gate) => sum + gate.span, 0);
  const gateWidth = gates.reduce((sum, gate) => sum + gate.width, 0);
  return {
    runs,
    bayCount,
    totalLength,
    cornerCount,
    postCount,
    area,
    gates,
    // Keep the first-gate alias for compatibility with older integrations.
    gate: gates[0] ?? null,
    gateBayCount,
    gateWidth,
    closed,
  };
}

/**
 * Return all valid gate placements. Gates never share a fence bay. Driveway
 * gates consume two adjacent bays and therefore remove the intermediate post.
 */
export function deriveGates(state, runs = deriveFenceMetricsWithoutGate(state).runs) {
  const rawGates = Array.isArray(state.gates) ? state.gates : legacyGateArray(state);
  const occupied = new Map(runs.map((run) => [run.id, new Set()]));
  const ids = new Set();
  const result = [];

  rawGates.forEach((rawGate, index) => {
    const type = ['pedestrian', 'driveway'].includes(rawGate?.type) ? rawGate.type : 'pedestrian';
    const span = type === 'driveway' ? 2 : 1;
    const requestedRunId = runs.some((run) => run.id === rawGate?.runId) ? rawGate.runId : runs[0]?.id;
    const requestedPosition = Math.max(0, Math.floor(Number(rawGate?.position) || 0));
    const placement = findGatePlacement(runs, occupied, requestedRunId, requestedPosition, span);
    if (!placement) return;

    const run = runs.find((item) => item.id === placement.runId);
    if (!run) return;
    for (let bay = placement.position; bay < placement.position + span; bay += 1) {
      occupied.get(placement.runId)?.add(bay);
    }

    const id = uniqueGateId(rawGate?.id, index, ids);
    ids.add(id);
    result.push({
      id,
      type,
      runId: placement.runId,
      startBay: placement.position,
      position: placement.position,
      span,
      width: run.bayWidth * span,
      handing: rawGate?.handing === 'left' ? 'left' : 'right',
    });
  });

  return result;
}

// Backward-compatible helper used by older callers; new code should use deriveGates.
export function deriveGate(state, runs = deriveFenceMetricsWithoutGate(state).runs) {
  return deriveGates(state, runs)[0] ?? null;
}

export function normalizeFenceState(state) {
  const next = state;
  if (!['straight', 'l', 'u', 'closed', 'closed5'].includes(next.layout)) next.layout = 'straight';
  next.runA = clampNumber(next.runA, 2, 30, 8);
  next.runB = clampNumber(next.runB, 2, 20, 5);
  next.runC = clampNumber(next.runC, 2, 20, 5);
  next.runD = clampNumber(next.runD, 2, 20, 5);
  next.angleB = clampNumber(next.angleB, 30, 150, 90);
  next.height = clampNumber(next.height, 0.8, 2.6, 1.8);
  next.targetBayWidth = clampNumber(next.targetBayWidth, 1, 3, 2);
  next.infillGap = clampNumber(next.infillGap, 0.015, 0.12, 0.035);
  if (!PANEL_STYLES[next.panelStyle]) next.panelStyle = 'vertical';
  normalizeFenceFinish(next);
  if (!['concrete', 'baseplate'].includes(next.foundation)) next.foundation = 'concrete';
  next.scenery = Boolean(next.scenery);
  next.showDimensions = Boolean(next.showDimensions);
  next.compassVisible = Boolean(next.compassVisible);
  next.technicalEdges = Boolean(next.technicalEdges);
  next.nightPreview = Boolean(next.nightPreview);
  next.sunPosition = clampNumber(next.sunPosition, 0, 100, 48);
  next.northDirection = clampNumber(next.northDirection, 0, 359, 0);
  if (!['3d', 'front', 'top'].includes(next.cameraPreset)) next.cameraPreset = '3d';

  // Migrate states saved before multi-gate support. Keeping this migration here
  // means old share URLs and account-saved configurations continue to restore.
  const sourceGates = Array.isArray(next.gates) ? next.gates : legacyGateArray(next);
  const runs = deriveFenceMetricsWithoutGate(next).runs;
  next.gates = deriveGates({ ...next, gates: sourceGates }, runs).map((gate) => ({
    id: gate.id,
    type: gate.type,
    runId: gate.runId,
    position: gate.startBay,
    handing: gate.handing,
  }));

  delete next.gateType;
  delete next.gateRun;
  delete next.gatePosition;
  delete next.gateHanding;
  return next;
}

function deriveFenceMetricsWithoutGate(state) {
  const runs = activeRunIds(state).map((runId) => deriveRun(state, runId));
  return { runs };
}

function legacyGateArray(state) {
  if (!state || state.gateType === 'none' || !['pedestrian', 'driveway'].includes(state.gateType)) return [];
  return [{
    id: 'gate-1',
    type: state.gateType,
    runId: ['a', 'b', 'c', 'd', 'e'].includes(state.gateRun) ? state.gateRun : 'a',
    position: Math.max(0, Math.floor(Number(state.gatePosition) || 0)),
    handing: state.gateHanding === 'left' ? 'left' : 'right',
  }];
}

function findGatePlacement(runs, occupied, requestedRunId, requestedPosition, span) {
  const orderedRuns = [
    ...runs.filter((run) => run.id === requestedRunId),
    ...runs.filter((run) => run.id !== requestedRunId),
  ];

  for (const run of orderedRuns) {
    if (run.bayCount < span) continue;
    const maxStart = run.bayCount - span;
    const target = run.id === requestedRunId ? Math.min(requestedPosition, maxStart) : 0;
    const starts = Array.from({ length: maxStart + 1 }, (_, index) => index)
      .sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b);
    for (const start of starts) {
      let available = true;
      for (let bay = start; bay < start + span; bay += 1) {
        if (occupied.get(run.id)?.has(bay)) { available = false; break; }
      }
      if (available) return { runId: run.id, position: start };
    }
  }
  return null;
}

function uniqueGateId(candidate, index, used) {
  const base = typeof candidate === 'string' && candidate.trim() ? candidate.trim() : `gate-${index + 1}`;
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}
