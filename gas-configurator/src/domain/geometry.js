const EARTH_RADIUS_M = 6_371_008.8;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

export function normalizeCoordinate(coordinate, fallback = [26.1025, 44.4268]) {
  const longitude = Number(coordinate?.[0]);
  const latitude = Number(coordinate?.[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return [...fallback];
  return [clamp(longitude, -180, 180), clamp(latitude, -85, 85)];
}

export function haversineDistanceMeters(a, b) {
  const [lonA, latA] = normalizeCoordinate(a);
  const [lonB, latB] = normalizeCoordinate(b);
  const toRadians = Math.PI / 180;
  const deltaLat = (latB - latA) * toRadians;
  const deltaLon = (lonB - lonA) * toRadians;
  const latARadians = latA * toRadians;
  const latBRadians = latB * toRadians;
  const haversine = (
    Math.sin(deltaLat / 2) ** 2
    + Math.cos(latARadians) * Math.cos(latBRadians) * Math.sin(deltaLon / 2) ** 2
  );
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function routeSegmentId(startPoint, endPoint) {
  return `${String(startPoint?.id || 'start')}:${String(endPoint?.id || 'end')}`;
}

export function buildRouteSegments(points = []) {
  const segments = [];
  let chainage = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const startPoint = points[index];
    const endPoint = points[index + 1];
    const lengthM = haversineDistanceMeters(startPoint.coordinate, endPoint.coordinate);
    segments.push({
      id: routeSegmentId(startPoint, endPoint),
      index,
      startPoint,
      endPoint,
      lengthM,
      startChainageM: chainage,
      endChainageM: chainage + lengthM,
    });
    chainage += lengthM;
  }

  return segments;
}

export function routeLengthMeters(points = []) {
  return buildRouteSegments(points).reduce((sum, segment) => sum + segment.lengthM, 0);
}

export function interpolateRoute(points = [], requestedChainageM = 0) {
  const segments = buildRouteSegments(points);
  if (!segments.length) {
    return { coordinate: normalizeCoordinate(points[0]?.coordinate), segment: null, ratio: 0, chainageM: 0 };
  }

  const totalLengthM = segments.at(-1).endChainageM;
  const chainageM = clamp(requestedChainageM, 0, totalLengthM);
  const segment = segments.find((candidate) => chainageM <= candidate.endChainageM) || segments.at(-1);
  const ratio = segment.lengthM > 0
    ? clamp((chainageM - segment.startChainageM) / segment.lengthM, 0, 1)
    : 0;
  const start = normalizeCoordinate(segment.startPoint.coordinate);
  const end = normalizeCoordinate(segment.endPoint.coordinate);

  return {
    coordinate: [
      start[0] + ((end[0] - start[0]) * ratio),
      start[1] + ((end[1] - start[1]) * ratio),
    ],
    segment,
    ratio,
    chainageM,
  };
}

export function routeProfileSamples(points = [], sampleCount = 72) {
  const totalLengthM = routeLengthMeters(points);
  const safeCount = Math.max(2, Math.round(sampleCount));
  return Array.from({ length: safeCount }, (_, index) => {
    const progress = index / (safeCount - 1);
    const chainageM = totalLengthM * progress;
    return {
      progress,
      chainageM,
      ...interpolateRoute(points, chainageM),
    };
  });
}

export function crossingLineCoordinates(points = [], requestedChainageM = 0, angleDeg = 90, lengthM = 70) {
  const station = interpolateRoute(points, requestedChainageM);
  if (!station.segment) return null;

  const center = normalizeCoordinate(station.coordinate);
  const start = normalizeCoordinate(station.segment.startPoint.coordinate);
  const end = normalizeCoordinate(station.segment.endPoint.coordinate);
  const meanLatitudeRadians = center[1] * (Math.PI / 180);
  const metersPerDegreeLatitude = 111_320;
  const metersPerDegreeLongitude = Math.max(1, metersPerDegreeLatitude * Math.cos(meanLatitudeRadians));
  const routeEastM = (end[0] - start[0]) * metersPerDegreeLongitude;
  const routeNorthM = (end[1] - start[1]) * metersPerDegreeLatitude;
  const routeBearingRadians = Math.atan2(routeNorthM, routeEastM);
  const crossingBearingRadians = routeBearingRadians + (clamp(angleDeg, 0, 90) * Math.PI / 180);
  const halfLengthM = Math.max(2, Number(lengthM) || 70) / 2;
  const eastOffsetM = Math.cos(crossingBearingRadians) * halfLengthM;
  const northOffsetM = Math.sin(crossingBearingRadians) * halfLengthM;
  const longitudeOffset = eastOffsetM / metersPerDegreeLongitude;
  const latitudeOffset = northOffsetM / metersPerDegreeLatitude;

  return {
    center,
    start: [center[0] - longitudeOffset, center[1] - latitudeOffset],
    end: [center[0] + longitudeOffset, center[1] + latitudeOffset],
    station,
  };
}

export function coordinateBounds(points = []) {
  if (!points.length) return null;
  const coordinates = points.map((point) => normalizeCoordinate(point.coordinate));
  return coordinates.reduce((bounds, coordinate) => ({
    minLon: Math.min(bounds.minLon, coordinate[0]),
    minLat: Math.min(bounds.minLat, coordinate[1]),
    maxLon: Math.max(bounds.maxLon, coordinate[0]),
    maxLat: Math.max(bounds.maxLat, coordinate[1]),
  }), {
    minLon: coordinates[0][0],
    minLat: coordinates[0][1],
    maxLon: coordinates[0][0],
    maxLat: coordinates[0][1],
  });
}

export function nearestPointOnSegmentRatio(coordinate, segment) {
  const point = normalizeCoordinate(coordinate);
  const start = normalizeCoordinate(segment?.startPoint?.coordinate);
  const end = normalizeCoordinate(segment?.endPoint?.coordinate);
  const meanLatitudeRadians = ((start[1] + end[1]) / 2) * (Math.PI / 180);
  const scaleX = Math.cos(meanLatitudeRadians);
  const px = (point[0] - start[0]) * scaleX;
  const py = point[1] - start[1];
  const dx = (end[0] - start[0]) * scaleX;
  const dy = end[1] - start[1];
  const denominator = (dx * dx) + (dy * dy);
  return denominator > 0 ? clamp(((px * dx) + (py * dy)) / denominator, 0, 1) : 0;
}
