// Sleeper stat keys → our canonical scoring keys (which match the keys used by
// scoring formats in @leetpix/shared). Only mapped keys are kept.
export const SLEEPER_STAT_MAP: Record<string, string> = {
  pass_yd: "passingYards",
  pass_td: "passingTd",
  pass_int: "interception",
  rush_yd: "rushingYards",
  rush_td: "rushingTd",
  rec: "reception",
  rec_yd: "receivingYards",
  rec_td: "receivingTd",
  fum_lost: "fumbleLost",
};

/** Normalize a raw Sleeper stat object to our canonical stat line. */
export function normalizeSleeperStats(
  raw: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const canonical = SLEEPER_STAT_MAP[key];
    if (canonical && typeof value === "number") out[canonical] = value;
  }
  return out;
}

/**
 * Normalize an MLB boxscore batting line to our canonical baseball keys.
 * Singles are derived (hits minus extra-base hits). Only nonzero keys are kept.
 */
export function normalizeMlbBatting(
  b: Record<string, number>,
): Record<string, number> {
  const hits = b.hits ?? 0;
  const doubles = b.doubles ?? 0;
  const triples = b.triples ?? 0;
  const homeRuns = b.homeRuns ?? 0;
  const single = Math.max(hits - doubles - triples - homeRuns, 0);

  const out: Record<string, number> = {};
  const set = (k: string, v: number) => {
    if (v) out[k] = v;
  };
  set("single", single);
  set("double", doubles);
  set("triple", triples);
  set("homeRun", homeRuns);
  set("rbi", b.rbi ?? 0);
  set("run", b.runs ?? 0);
  set("stolenBase", b.stolenBases ?? 0);
  set("walk", b.baseOnBalls ?? 0);
  return out;
}
