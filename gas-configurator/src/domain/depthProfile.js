import {
  clamp,
  routeLengthMeters,
  routeProfileSamples,
} from './geometry.js';

export const MIN_PIPE_COVER_M = 0.3;
export const MAX_PIPE_COVER_M = 5;
export const DEPTH_POINT_DUPLICATE_TOLERANCE_M = 0.01;
export const DEPTH_POINT_MATCH_TOLERANCE_M = 0.15;
export const PROFILE_ABRUPT_SLOPE_WARNING_RATIO = 0.2;

export const DEPTH_POINT_SOURCES = Object.freeze(['default', 'manual', 'surveyed']);
export const DEPTH_ZONE_ROLES = Object.freeze(['entry', 'center', 'exit']);

const DEPTH_POINT_SOURCE_SET = new Set(DEPTH_POINT_SOURCES);
const DEPTH_ZONE_ROLE_SET = new Set(DEPTH_ZONE_ROLES);

function numberOr(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function uniqueSortedNumbers(values = [], tolerance = 1e-6) {
  return values
    .filter(Number.isFinite)
    .sort((left, right) => left - right)
    .reduce((output, value) => {
      if (output.length === 0 || Math.abs(output.at(-1) - value) > tolerance) output.push(value);
      return output;
    }, []);
}

export function clampPipeCover(coverM, fallbackCoverM = 1) {
  return clamp(numberOr(coverM, fallbackCoverM), MIN_PIPE_COVER_M, MAX_PIPE_COVER_M);
}

export function fallbackTerrainElevation(state, progress = 0) {
  const start = numberOr(state?.data?.startElevationM, 82);
  const end = numberOr(state?.data?.endElevationM, 85);
  const safeProgress = clamp(progress, 0, 1);
  const base = start + ((end - start) * safeProgress);
  const terrainVariation = Math.sin(safeProgress * Math.PI * 2) * 0.55
    + Math.sin(safeProgress * Math.PI * 5) * 0.16;
  return base + terrainVariation;
}

export function buildFallbackTerrainSamples(state, sampleCount = 82) {
  return routeProfileSamples(state?.route?.points || [], sampleCount).map((sample) => ({
    ...sample,
    elevationM: fallbackTerrainElevation(state, sample.progress),
    groundM: fallbackTerrainElevation(state, sample.progress),
    source: 'fallback',
  }));
}

export function interpolateTerrainElevation(samples = [], requestedChainageM = 0, fallback = NaN) {
  if (!Array.isArray(samples) || samples.length === 0) return fallback;
  const requested = numberOr(requestedChainageM, 0);
  const first = samples[0];
  const last = samples.at(-1);
  if (requested <= first.chainageM) return first.groundM;
  if (requested >= last.chainageM) return last.groundM;

  for (let index = 1; index < samples.length; index += 1) {
    const right = samples[index];
    if (requested > right.chainageM) continue;
    const left = samples[index - 1];
    const span = right.chainageM - left.chainageM;
    const ratio = span > 0 ? (requested - left.chainageM) / span : 0;
    return left.groundM + ((right.groundM - left.groundM) * ratio);
  }
  return last.groundM;
}

export function normalizeTerrainSamples(samples = [], routeLengthM = 0, fallbackState = null) {
  const safeRouteLengthM = Math.max(0, numberOr(routeLengthM, 0));
  const normalized = (Array.isArray(samples) ? samples : [])
    .map((sample) => {
      const chainageM = clamp(numberOr(sample?.chainageM, NaN), 0, safeRouteLengthM);
      const groundM = numberOr(sample?.groundM ?? sample?.elevationM, NaN);
      if (!Number.isFinite(chainageM) || !Number.isFinite(groundM)) return null;
      return {
        ...sample,
        chainageM,
        progress: safeRouteLengthM > 0 ? chainageM / safeRouteLengthM : 0,
        groundM,
        elevationM: groundM,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.chainageM - right.chainageM);

  const deduplicated = [];
  normalized.forEach((sample) => {
    const previous = deduplicated.at(-1);
    if (previous && Math.abs(previous.chainageM - sample.chainageM) <= 1e-6) {
      deduplicated[deduplicated.length - 1] = sample;
    } else {
      deduplicated.push(sample);
    }
  });

  if (deduplicated.length < 2) {
    return fallbackState ? buildFallbackTerrainSamples(fallbackState) : [];
  }

  if (deduplicated[0].chainageM > 1e-6) {
    deduplicated.unshift({
      ...deduplicated[0],
      chainageM: 0,
      progress: 0,
    });
  }
  if (safeRouteLengthM > 0 && Math.abs(deduplicated.at(-1).chainageM - safeRouteLengthM) > 1e-6) {
    deduplicated.push({
      ...deduplicated.at(-1),
      chainageM: safeRouteLengthM,
      progress: 1,
    });
  }
  return deduplicated;
}

export function resolveTerrainSamples(state, terrainSamples = null) {
  const routeLengthM = routeLengthMeters(state?.route?.points || []);
  const normalized = normalizeTerrainSamples(terrainSamples, routeLengthM, null);
  if (normalized.length >= 2) {
    return {
      source: 'public',
      live: true,
      samples: normalized.map((sample) => ({ ...sample, source: sample.source || 'public' })),
    };
  }
  return {
    source: 'fallback',
    live: false,
    samples: buildFallbackTerrainSamples(state),
  };
}

function depthPointPriority(point) {
  if (point?.source === 'surveyed') return 4;
  if (point?.routeEventId) return 3;
  if (point?.source === 'manual' || point?.inheritsDefault === false) return 2;
  return 1;
}

function normalizedDepthControl(point, index, routeLengthM, defaultCoverM) {
  const source = DEPTH_POINT_SOURCE_SET.has(point?.source) ? point.source : 'manual';
  const inheritsDefault = point?.inheritsDefault !== false && source === 'default';
  return {
    ...point,
    id: String(point?.id || `depth-${index + 1}`),
    routeId: String(point?.routeId || 'main'),
    stationM: clamp(numberOr(point?.stationM, 0), 0, routeLengthM),
    coverM: inheritsDefault
      ? clampPipeCover(defaultCoverM, 1)
      : clampPipeCover(point?.coverM, defaultCoverM),
    source,
    inheritsDefault,
    routeEventId: point?.routeEventId ? String(point.routeEventId) : null,
    zoneRole: DEPTH_ZONE_ROLE_SET.has(point?.zoneRole) ? point.zoneRole : null,
  };
}

export function analyzeDepthControls(depthPoints = [], routeLengthM = 0, defaultCoverM = 1) {
  const safeRouteLengthM = Math.max(0, numberOr(routeLengthM, 0));
  const safeDefaultCoverM = clampPipeCover(defaultCoverM, 1);
  const controls = (Array.isArray(depthPoints) ? depthPoints : [])
    .map((point, index) => normalizedDepthControl(point, index, safeRouteLengthM, safeDefaultCoverM))
    .sort((left, right) => left.stationM - right.stationM || depthPointPriority(left) - depthPointPriority(right));

  if (controls.length === 0) {
    controls.push(
      {
        id: 'depth-a', routeId: 'main', stationM: 0, coverM: safeDefaultCoverM,
        source: 'default', inheritsDefault: true, routeEventId: null, zoneRole: null,
      },
      {
        id: 'depth-b', routeId: 'main', stationM: safeRouteLengthM, coverM: safeDefaultCoverM,
        source: 'default', inheritsDefault: true, routeEventId: null, zoneRole: null,
      },
    );
  }

  const groups = [];
  controls.forEach((point) => {
    const group = groups.at(-1);
    if (group && Math.abs(group[0].stationM - point.stationM) <= DEPTH_POINT_DUPLICATE_TOLERANCE_M) {
      group.push(point);
    } else {
      groups.push([point]);
    }
  });

  const duplicates = groups
    .filter((group) => group.length > 1)
    .map((group) => ({
      stationM: group.reduce((sum, point) => sum + point.stationM, 0) / group.length,
      pointIds: group.map((point) => point.id),
    }));

  const effectivePoints = groups.map((group) => group.reduce((winner, candidate) => {
    const winnerPriority = depthPointPriority(winner);
    const candidatePriority = depthPointPriority(candidate);
    return candidatePriority >= winnerPriority ? candidate : winner;
  }));

  if (effectivePoints[0].stationM > DEPTH_POINT_DUPLICATE_TOLERANCE_M) {
    effectivePoints.unshift({
      id: 'depth-effective-start',
      routeId: 'main',
      stationM: 0,
      coverM: safeDefaultCoverM,
      source: 'default',
      inheritsDefault: true,
      routeEventId: null,
      zoneRole: null,
    });
  }
  if (
    safeRouteLengthM > 0
    && Math.abs(effectivePoints.at(-1).stationM - safeRouteLengthM) > DEPTH_POINT_DUPLICATE_TOLERANCE_M
  ) {
    effectivePoints.push({
      id: 'depth-effective-end',
      routeId: 'main',
      stationM: safeRouteLengthM,
      coverM: safeDefaultCoverM,
      source: 'default',
      inheritsDefault: true,
      routeEventId: null,
      zoneRole: null,
    });
  }

  return {
    controls,
    effectivePoints: effectivePoints.sort((left, right) => left.stationM - right.stationM),
    duplicates,
  };
}

export function coverAtChainage(
  depthPoints = [],
  requestedChainageM = 0,
  routeLengthM = 0,
  defaultCoverM = 1,
) {
  const analysis = analyzeDepthControls(depthPoints, routeLengthM, defaultCoverM);
  const points = analysis.effectivePoints;
  const requested = clamp(numberOr(requestedChainageM, 0), 0, Math.max(0, routeLengthM));
  if (requested <= points[0].stationM) return points[0].coverM;

  for (let index = 1; index < points.length; index += 1) {
    const right = points[index];
    if (requested > right.stationM) continue;
    const left = points[index - 1];
    const span = right.stationM - left.stationM;
    const ratio = span > 0 ? (requested - left.stationM) / span : 0;
    return left.coverM + ((right.coverM - left.coverM) * ratio);
  }
  return points.at(-1).coverM;
}

export function depthProfileStatistics(depthPoints = [], routeLengthM = 0, defaultCoverM = 1) {
  const safeRouteLengthM = Math.max(0, numberOr(routeLengthM, 0));
  const analysis = analyzeDepthControls(depthPoints, safeRouteLengthM, defaultCoverM);
  const points = analysis.effectivePoints;
  let integratedCoverM2 = 0;
  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1];
    const right = points[index];
    const spanM = Math.max(0, right.stationM - left.stationM);
    integratedCoverM2 += spanM * ((left.coverM + right.coverM) / 2);
  }
  const covers = points.map((point) => point.coverM);
  return {
    ...analysis,
    minimumCoverM: Math.min(...covers),
    maximumCoverM: Math.max(...covers),
    averageCoverM: safeRouteLengthM > 0
      ? integratedCoverM2 / safeRouteLengthM
      : covers[0] || clampPipeCover(defaultCoverM),
    integratedCoverM2,
  };
}

export function buildDepthIntervals(routeSegments = [], depthPoints = [], routeLengthM = 0, defaultCoverM = 1) {
  const analysis = analyzeDepthControls(depthPoints, routeLengthM, defaultCoverM);
  const controls = analysis.effectivePoints;
  return routeSegments.flatMap((segment) => {
    const breakpoints = uniqueSortedNumbers([
      segment.startChainageM,
      ...controls
        .filter((point) => (
          point.stationM > segment.startChainageM + 1e-6
          && point.stationM < segment.endChainageM - 1e-6
        ))
        .map((point) => point.stationM),
      segment.endChainageM,
    ]);
    return breakpoints.slice(1).map((endStationM, index) => {
      const startStationM = breakpoints[index];
      const startCoverM = coverAtChainage(depthPoints, startStationM, routeLengthM, defaultCoverM);
      const endCoverM = coverAtChainage(depthPoints, endStationM, routeLengthM, defaultCoverM);
      return {
        id: `${segment.id}:${startStationM.toFixed(3)}-${endStationM.toFixed(3)}`,
        segmentId: segment.id,
        segmentIndex: segment.index,
        startStationM,
        endStationM,
        lengthM: Math.max(0, endStationM - startStationM),
        startCoverM,
        endCoverM,
        averageCoverM: (startCoverM + endCoverM) / 2,
      };
    });
  });
}

export function profileLengthMeters(samples = [], elevationKey = 'pipeCenterlineM') {
  if (!Array.isArray(samples) || samples.length < 2) return NaN;
  let lengthM = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const left = samples[index - 1];
    const right = samples[index];
    const horizontalM = numberOr(right?.chainageM, NaN) - numberOr(left?.chainageM, NaN);
    const verticalM = numberOr(right?.[elevationKey], NaN) - numberOr(left?.[elevationKey], NaN);
    if (!Number.isFinite(horizontalM) || horizontalM <= 0 || !Number.isFinite(verticalM)) return NaN;
    lengthM += Math.hypot(horizontalM, verticalM);
  }
  return lengthM;
}

export function buildDesignedPipeProfile({
  state,
  terrainSamples = null,
  routeLengthM = routeLengthMeters(state?.route?.points || []),
  depthPoints = state?.depthPoints || [],
  defaultCoverM = state?.trench?.coverM ?? 1,
  outsideDiameterM = 0,
} = {}) {
  const terrain = resolveTerrainSamples(state, terrainSamples);
  const terrainPoints = normalizeTerrainSamples(terrain.samples, routeLengthM, state);
  const depth = analyzeDepthControls(depthPoints, routeLengthM, defaultCoverM);
  const chainages = uniqueSortedNumbers([
    0,
    ...terrainPoints.map((sample) => sample.chainageM),
    ...depth.effectivePoints.map((point) => point.stationM),
    routeLengthM,
  ]);

  const samples = chainages.map((chainageM) => {
    const progress = routeLengthM > 0 ? chainageM / routeLengthM : 0;
    const groundM = interpolateTerrainElevation(
      terrainPoints,
      chainageM,
      fallbackTerrainElevation(state, progress),
    );
    const coverM = coverAtChainage(depthPoints, chainageM, routeLengthM, defaultCoverM);
    const pipeCrownM = groundM - coverM;
    const pipeCenterlineM = pipeCrownM - (outsideDiameterM / 2);
    const pipeInvertM = pipeCrownM - outsideDiameterM;
    return {
      chainageM,
      progress,
      groundM,
      elevationM: groundM,
      coverM,
      pipeCrownM,
      pipeCenterlineM,
      pipeInvertM,
    };
  });

  const abruptSegments = [];
  for (let index = 1; index < samples.length; index += 1) {
    const left = samples[index - 1];
    const right = samples[index];
    const horizontalM = right.chainageM - left.chainageM;
    if (horizontalM <= 0) continue;
    const slopeRatio = (right.pipeCenterlineM - left.pipeCenterlineM) / horizontalM;
    if (Math.abs(slopeRatio) > PROFILE_ABRUPT_SLOPE_WARNING_RATIO) {
      abruptSegments.push({
        startStationM: left.chainageM,
        endStationM: right.chainageM,
        slopeRatio,
      });
    }
  }

  return {
    terrainSource: terrain.source,
    liveTerrain: terrain.live,
    terrainSamples: terrainPoints,
    samples,
    terrainLengthM: profileLengthMeters(samples, 'groundM'),
    designedPipeLengthM: profileLengthMeters(samples, 'pipeCenterlineM'),
    abruptSegments,
  };
}

export function interpolatePipeProfileAtChainage(samples = [], requestedChainageM = 0) {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  const requested = clamp(
    numberOr(requestedChainageM, 0),
    samples[0].chainageM,
    samples.at(-1).chainageM,
  );
  let left = samples[0];
  let right = samples[0];
  for (let index = 1; index < samples.length; index += 1) {
    right = samples[index];
    if (requested <= right.chainageM) {
      left = samples[index - 1];
      break;
    }
    left = right;
  }
  const spanM = right.chainageM - left.chainageM;
  const ratio = spanM > 0 ? (requested - left.chainageM) / spanM : 0;
  const interpolate = (key) => left[key] + ((right[key] - left[key]) * ratio);
  return {
    chainageM: requested,
    progress: samples.at(-1).chainageM > 0 ? requested / samples.at(-1).chainageM : 0,
    groundM: interpolate('groundM'),
    coverM: interpolate('coverM'),
    pipeCrownM: interpolate('pipeCrownM'),
    pipeCenterlineM: interpolate('pipeCenterlineM'),
    pipeInvertM: interpolate('pipeInvertM'),
    slopeRatio: spanM > 0 ? (right.pipeCenterlineM - left.pipeCenterlineM) / spanM : 0,
  };
}

export function routeEventDepthZoneStations(event, routeLengthM = 0) {
  if (!event) return null;
  const center = clamp(numberOr(event.stationM, 0), 0, Math.max(0, routeLengthM));
  const widthM = Math.max(0, numberOr(event.crossing?.obstacleWidthM, 0));
  if (widthM <= 0) return null;
  const halfWidthM = widthM / 2;
  return {
    entry: clamp(center - halfWidthM, 0, routeLengthM),
    center,
    exit: clamp(center + halfWidthM, 0, routeLengthM),
    widthM,
  };
}

export function routeEventDepthZoneStatus(depthPoints = [], event = null, routeLengthM = 0) {
  const expected = routeEventDepthZoneStations(event, routeLengthM);
  if (!expected) return { status: 'missing-width', expected: null, points: [] };
  const points = (Array.isArray(depthPoints) ? depthPoints : [])
    .filter((point) => point?.routeEventId === event.id && DEPTH_ZONE_ROLE_SET.has(point?.zoneRole));
  if (points.length === 0) return { status: 'missing', expected, points: [] };
  const byRole = Object.fromEntries(points.map((point) => [point.zoneRole, point]));
  const complete = DEPTH_ZONE_ROLES.every((role) => byRole[role]);
  if (!complete) return { status: 'partial', expected, points, byRole };
  const stale = DEPTH_ZONE_ROLES.some((role) => (
    Math.abs(numberOr(byRole[role].stationM, 0) - expected[role]) > DEPTH_POINT_MATCH_TOLERANCE_M
  ));
  return { status: stale ? 'stale' : 'ready', expected, points, byRole };
}
