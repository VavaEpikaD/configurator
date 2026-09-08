export function toLeafletLatLng(coordinate) {
  return [coordinate[1], coordinate[0]];
}

export function toLeafletBounds(bounds) {
  return [
    [bounds.minLat, bounds.minLon],
    [bounds.maxLat, bounds.maxLon],
  ];
}
