// Projected points, always to two decimals ("16.5" → "16.50") so the numbers
// line up in a column when rendered in a monospace font.
export function formatProjection(points: number): string {
  return points.toFixed(2);
}
