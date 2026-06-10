/**
 * Deterministic helper to calculate the area of a GeoJSON polygon in hectares.
 * Uses the Shoelace formula adjusted for local latitude projections.
 */
export function calculatePolygonArea(coordinates: [number, number][]): number {
  // A valid polygon needs at least 3 points (or 4 if closed)
  if (coordinates.length < 3) return 0;
  
  // Filter out duplicate closing point if present
  let pointsToCalc = [...coordinates];
  if (
    pointsToCalc.length > 3 &&
    pointsToCalc[0][0] === pointsToCalc[pointsToCalc.length - 1][0] &&
    pointsToCalc[0][1] === pointsToCalc[pointsToCalc.length - 1][1]
  ) {
    pointsToCalc.pop();
  }

  const numPoints = pointsToCalc.length;
  if (numPoints < 3) return 0;

  // Reference latitude (middle point)
  const refLat = pointsToCalc[0][1];
  
  // Conversion factors
  const latToMeters = 111320.0;
  const lngToMeters = 111320.0 * Math.cos((refLat * Math.PI) / 180.0);

  // Project coordinates to local planar meters
  const planarPoints = pointsToCalc.map(([lng, lat]) => ({
    x: lng * lngToMeters,
    y: lat * latToMeters
  }));

  // Apply Shoelace Formula
  let area = 0.0;
  for (let i = 0; i < numPoints; i++) {
    const p1 = planarPoints[i];
    const p2 = planarPoints[(i + 1) % numPoints];
    area += (p1.x * p2.y) - (p2.x * p1.y);
  }

  const areaSqMeters = Math.abs(area / 2.0);
  const areaHectares = areaSqMeters / 10000.0;

  // Round to 2 decimal places, minimum 0.01
  return Math.max(0.01, Math.round(areaHectares * 100) / 100);
}
