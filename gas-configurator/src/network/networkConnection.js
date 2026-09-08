import existingNetworkSource from '../data/valcea-existing-network.json' with { type: 'json' };
import {
  clamp,
  haversineDistanceMeters,
  nearestPointOnSegmentRatio,
  normalizeCoordinate,
} from '../domain/geometry.js';

export const DEFAULT_NETWORK_SNAP_TOLERANCE_M = 8;
export const NETWORK_CONNECTION_EPSILON_M = 0.5;
export const MAX_NETWORK_SNAP_ACTION_DISTANCE_M = 5_000;

let lineOrdinal = 0;

const enrichedFeatures = existingNetworkSource.features.map((feature) => {
  if (feature.geometry?.type !== 'LineString') return feature;
  lineOrdinal += 1;
  const assetId = feature.properties?.assetId
    || `valcea-network-${String(lineOrdinal).padStart(3, '0')}`;
  return {
    ...feature,
    id: assetId,
    properties: {
      ...feature.properties,
      assetId,
    },
  };
});

export const EXISTING_NETWORK_DATA = Object.freeze({
  ...existingNetworkSource,
  features: Object.freeze(enrichedFeatures),
});

export const EXISTING_NETWORK_METADATA = Object.freeze({
  ...existingNetworkSource.metadata,
});

export const EXISTING_NETWORK_ASSETS = Object.freeze(
  enrichedFeatures.filter((feature) => feature.geometry?.type === 'LineString'),
);

const ASSET_BY_ID = new Map(
  EXISTING_NETWORK_ASSETS.map((feature) => [feature.properties.assetId, feature]),
);

export function getExistingNetworkAsset(assetId) {
  return ASSET_BY_ID.get(String(assetId || '')) || null;
}

function projectOntoSegment(coordinate, start, end) {
  const segment = {
    startPoint: { coordinate: start },
    endPoint: { coordinate: end },
  };
  const ratio = nearestPointOnSegmentRatio(coordinate, segment);
  const normalizedStart = normalizeCoordinate(start);
  const normalizedEnd = normalizeCoordinate(end);
  const projected = [
    normalizedStart[0] + ((normalizedEnd[0] - normalizedStart[0]) * ratio),
    normalizedStart[1] + ((normalizedEnd[1] - normalizedStart[1]) * ratio),
  ];
  return {
    coordinate: projected,
    distanceM: haversineDistanceMeters(coordinate, projected),
    segmentRatio: ratio,
  };
}

export function projectCoordinateToNetworkAsset(coordinate, assetOrId) {
  const feature = typeof assetOrId === 'string'
    ? getExistingNetworkAsset(assetOrId)
    : assetOrId;
  const coordinates = feature?.geometry?.coordinates;
  if (!feature || !Array.isArray(coordinates) || coordinates.length < 2) return null;

  const requestedCoordinate = normalizeCoordinate(coordinate);
  let nearest = null;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const projection = projectOntoSegment(
      requestedCoordinate,
      coordinates[index],
      coordinates[index + 1],
    );
    if (!nearest || projection.distanceM < nearest.distanceM) {
      nearest = {
        ...projection,
        segmentIndex: index,
      };
    }
  }
  if (!nearest) return null;

  const properties = feature.properties || {};
  return {
    ...nearest,
    assetId: properties.assetId,
    name: properties.name || properties.assetId,
    groupId: properties.groupId || null,
    serviceGroup: properties.serviceGroup || properties.sourceGroup || null,
    sourceGroup: properties.sourceGroup || null,
    feature,
  };
}

export function findNearestNetworkPoint(coordinate) {
  return EXISTING_NETWORK_ASSETS.reduce((nearest, feature) => {
    const candidate = projectCoordinateToNetworkAsset(coordinate, feature);
    return candidate && (!nearest || candidate.distanceM < nearest.distanceM)
      ? candidate
      : nearest;
  }, null);
}

export function serializeNetworkConnection(candidate, snapToleranceM = DEFAULT_NETWORK_SNAP_TOLERANCE_M) {
  if (!candidate?.assetId || !candidate?.coordinate) {
    return {
      assetId: null,
      coordinate: null,
      snapToleranceM: clamp(snapToleranceM, 1, 50),
    };
  }
  return {
    assetId: candidate.assetId,
    coordinate: normalizeCoordinate(candidate.coordinate),
    snapToleranceM: clamp(snapToleranceM, 1, 50),
  };
}

export function assessNetworkConnection(state) {
  const startPoint = state?.route?.points?.find((point) => point.id === 'a')
    || state?.route?.points?.[0];
  const startCoordinate = normalizeCoordinate(startPoint?.coordinate);
  const savedAsset = getExistingNetworkAsset(state?.connection?.assetId);
  const savedCandidate = savedAsset
    ? projectCoordinateToNetworkAsset(startCoordinate, savedAsset)
    : null;
  const nearestCandidate = findNearestNetworkPoint(startCoordinate);
  const candidate = savedCandidate && (
    !nearestCandidate
    || savedCandidate.distanceM <= nearestCandidate.distanceM + NETWORK_CONNECTION_EPSILON_M
  )
    ? savedCandidate
    : nearestCandidate;
  const distanceM = Number(candidate?.distanceM);
  const connected = Number.isFinite(distanceM) && distanceM <= NETWORK_CONNECTION_EPSILON_M;
  const snapToleranceM = clamp(
    state?.connection?.snapToleranceM ?? DEFAULT_NETWORK_SNAP_TOLERANCE_M,
    1,
    50,
  );

  return {
    status: candidate ? (connected ? 'connected' : 'unconnected') : 'missing',
    connected,
    candidate,
    distanceM: Number.isFinite(distanceM) ? distanceM : NaN,
    snapToleranceM,
    withinAutoSnapTolerance: Number.isFinite(distanceM) && distanceM <= snapToleranceM,
    canSnap: Number.isFinite(distanceM) && distanceM <= MAX_NETWORK_SNAP_ACTION_DISTANCE_M,
    sourceUrl: EXISTING_NETWORK_METADATA.sourceUrl || null,
  };
}
