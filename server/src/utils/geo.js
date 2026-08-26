/**
 * Straight-line distance in km between two GPS points (Haversine formula).
 * v1 implementation — no external API dependency. To upgrade to real
 * road-routing distance (Google Distance Matrix / Mapbox Directions),
 * replace the body of this function (and make it async) — every caller
 * already treats this as the single source of truth and does not need
 * to change.
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v === null || v === undefined)) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
