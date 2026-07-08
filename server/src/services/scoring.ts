import type { ScoringRules } from "@leetpix/shared";

// Preset rules live in the shared package so the client (badge modal) and server
// (projections/scoring) use one source of truth.
export { SCORING_PRESET_RULES as SCORING_PRESETS } from "@leetpix/shared";

/** Applies a scoring format to a player's raw stat line -> fantasy points. */
export function scoreStatLine(
  stats: Record<string, number>,
  rules: ScoringRules,
): number {
  let total = 0;
  for (const [key, perUnit] of Object.entries(rules)) {
    total += (stats[key] ?? 0) * perUnit;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Risk-adjusted score for a correct pick. Picking the low-consensus option and
 * being right pays more; the heavy favorite pays a mild reward.
 * `consensus` is the option's vote share at cast time (0..1).
 */
export function riskScore(correct: boolean, consensus: number): number {
  if (!correct) return 0;
  // 90% consensus -> ~0.1; 10% consensus -> ~0.9 (scaled to 100).
  return Math.round((1 - consensus) * 100);
}
