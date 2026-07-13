// Preset rules and the scoring function live in the shared package so the client
// (badge/breakdown modal) and server (projections/scoring) use one source of
// truth — including the position-aware override logic (see scoreStatLine).
export {
  SCORING_PRESET_RULES as SCORING_PRESETS,
  scoreStatLine,
} from "@leetpix/shared";

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
