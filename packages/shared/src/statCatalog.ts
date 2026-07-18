import { Sport } from "./enums";

// ── The scoreable-stat catalog ───────────────────────────────────────────────
// The canonical, sport-scoped set of stat categories a scoring format may award
// points for. This is the single source of truth: the custom-format wizard only
// offers these categories (no free-form keys), the server validates saved rules
// against it, and STAT_LABELS is derived from it.
//
// `key` matches the canonical keys produced by the import pipeline
// (see server/src/lib/statKeys.ts) and stored in ScoringRules.

export type StatKind =
  // A "count" stat awards points per single occurrence (a TD, a home run).
  | "count"
  // A "rate" stat awards points per N units (yards). Users think in "1 pt per
  // 25 yds"; we store the equivalent points-per-unit (0.04). See the helpers.
  | "rate";

export interface StatCategory {
  key: string; // canonical key (matches import + ScoringRules)
  label: string; // human label, e.g. "Passing yards"
  group: string; // UI section header, e.g. "Passing"
  kind: StatKind;
  unit?: string; // rate only, singular noun (e.g. "yard")
  // Defaults are expressed in the intuitive framing the wizard shows:
  //   count → points awarded per 1 occurrence
  //   rate  → `defaultPoints` awarded per `defaultPer` units
  defaultPoints: number;
  defaultPer?: number; // rate only, e.g. 25 → "1 pt per 25 yds"
  // Whether the category is enabled by default when starting a fresh format.
  defaultOn: boolean;
  // Advanced/uncommon categories are hidden behind a "show advanced" reveal in
  // the wizard so the common set stays scannable. Defaults to common (false).
  advanced?: boolean;
  // Player positions that may carry their own per-position rate for this stat
  // (stored as the override key "<key>.<POS>"). e.g. rushing TDs valued
  // differently for a QB. See scoreStatLine's position handling.
  overridePositions?: string[];
}

const FOOTBALL_CATALOG: StatCategory[] = [
  // ── Passing ────────────────────────────────────────────────────────────────
  { key: "passingYards", label: "Passing yards", group: "Passing", kind: "rate", unit: "yard", defaultPoints: 1, defaultPer: 25, defaultOn: true },
  { key: "passingTd", label: "Passing TD", group: "Passing", kind: "count", defaultPoints: 4, defaultOn: true },
  { key: "interception", label: "Interception", group: "Passing", kind: "count", defaultPoints: -2, defaultOn: true },
  // Milestone bonuses — exclusive per-game yardage tiers derived from raw yards
  // at import (see normalizeSleeperStats), so a 420-yd game hits only 400+.
  { key: "bonusPassYd300_399", label: "300–399 passing yard game", group: "Passing", kind: "count", defaultPoints: 2, defaultOn: false, advanced: true },
  { key: "bonusPassYd400p", label: "400+ passing yard game", group: "Passing", kind: "count", defaultPoints: 3, defaultOn: false, advanced: true },
  { key: "passingTd40_49", label: "Passing TD 40–49 yds bonus", group: "Passing", kind: "count", defaultPoints: 2, defaultOn: false, advanced: true },
  { key: "passingTd50p", label: "Passing TD 50+ yds bonus", group: "Passing", kind: "count", defaultPoints: 2, defaultOn: false, advanced: true },
  // ── Rushing ────────────────────────────────────────────────────────────────
  { key: "rushingYards", label: "Rushing yards", group: "Rushing", kind: "rate", unit: "yard", defaultPoints: 1, defaultPer: 10, defaultOn: true },
  // Rushing TDs can carry a QB-specific rate (many leagues value QB rush TDs less).
  { key: "rushingTd", label: "Rushing TD", group: "Rushing", kind: "count", defaultPoints: 6, defaultOn: true, overridePositions: ["QB"] },
  { key: "bonusRushYd100_199", label: "100–199 rushing yard game", group: "Rushing", kind: "count", defaultPoints: 2, defaultOn: false, advanced: true },
  { key: "bonusRushYd200p", label: "200+ rushing yard game", group: "Rushing", kind: "count", defaultPoints: 3, defaultOn: false, advanced: true },
  // ── Receiving ──────────────────────────────────────────────────────────────
  { key: "reception", label: "Reception", group: "Receiving", kind: "count", defaultPoints: 1, defaultOn: true },
  { key: "receivingYards", label: "Receiving yards", group: "Receiving", kind: "rate", unit: "yard", defaultPoints: 1, defaultPer: 10, defaultOn: true },
  { key: "receivingTd", label: "Receiving TD", group: "Receiving", kind: "count", defaultPoints: 6, defaultOn: true },
  { key: "bonusRecYd100_199", label: "100–199 receiving yard game", group: "Receiving", kind: "count", defaultPoints: 2, defaultOn: false, advanced: true },
  { key: "bonusRecYd200p", label: "200+ receiving yard game", group: "Receiving", kind: "count", defaultPoints: 3, defaultOn: false, advanced: true },
  { key: "receivingTd40_49", label: "Receiving TD 40–49 yds bonus", group: "Receiving", kind: "count", defaultPoints: 2, defaultOn: false, advanced: true },
  { key: "receivingTd50p", label: "Receiving TD 50+ yds bonus", group: "Receiving", kind: "count", defaultPoints: 2, defaultOn: false, advanced: true },
  // ── Miscellaneous ──────────────────────────────────────────────────────────
  { key: "fumbleLost", label: "Fumble lost", group: "Miscellaneous", kind: "count", defaultPoints: -2, defaultOn: true },
  // ── Kicking ────────────────────────────────────────────────────────────────
  // FG tiers are the full value of a made kick (they never stack): a 55-yd FG is
  // only the 50+ tier. Import derives exclusive tiers (see normalizeSleeperStats).
  { key: "fgMade0_39", label: "FG made 0–39 yds", group: "Kicking", kind: "count", defaultPoints: 3, defaultOn: false },
  { key: "fgMade40_49", label: "FG made 40–49 yds", group: "Kicking", kind: "count", defaultPoints: 4, defaultOn: false },
  { key: "fgMade50p", label: "FG made 50+ yds", group: "Kicking", kind: "count", defaultPoints: 5, defaultOn: false },
  { key: "fgMiss", label: "FG missed", group: "Kicking", kind: "count", defaultPoints: -1, defaultOn: false },
  { key: "xpMade", label: "Extra point made", group: "Kicking", kind: "count", defaultPoints: 1, defaultOn: false },
  { key: "xpMiss", label: "Extra point missed", group: "Kicking", kind: "count", defaultPoints: -1, defaultOn: false, advanced: true },
  // ── Team defense (DST) ─────────────────────────────────────────────────────
  { key: "dstSack", label: "Sack", group: "Team defense", kind: "count", defaultPoints: 1, defaultOn: false },
  { key: "dstInt", label: "Interception", group: "Team defense", kind: "count", defaultPoints: 2, defaultOn: false },
  { key: "dstFumRec", label: "Fumble recovery", group: "Team defense", kind: "count", defaultPoints: 2, defaultOn: false },
  { key: "dstTd", label: "Defensive TD", group: "Team defense", kind: "count", defaultPoints: 6, defaultOn: false },
  { key: "dstForcedFumble", label: "Forced fumble", group: "Team defense", kind: "count", defaultPoints: 1, defaultOn: false, advanced: true },
  { key: "dstSpecialTeamsTd", label: "Special teams TD", group: "Team defense", kind: "count", defaultPoints: 6, defaultOn: false, advanced: true },
  // Points-allowed tiers are exclusive (a game falls in exactly one).
  { key: "dstPtsAllow0", label: "0 points allowed", group: "Team defense", kind: "count", defaultPoints: 10, defaultOn: false },
  { key: "dstPtsAllow1_6", label: "1–6 points allowed", group: "Team defense", kind: "count", defaultPoints: 7, defaultOn: false },
  { key: "dstPtsAllow7_13", label: "7–13 points allowed", group: "Team defense", kind: "count", defaultPoints: 4, defaultOn: false },
  { key: "dstPtsAllow14_20", label: "14–20 points allowed", group: "Team defense", kind: "count", defaultPoints: 1, defaultOn: false },
  { key: "dstPtsAllow21_27", label: "21–27 points allowed", group: "Team defense", kind: "count", defaultPoints: 0, defaultOn: false },
  { key: "dstPtsAllow28_34", label: "28–34 points allowed", group: "Team defense", kind: "count", defaultPoints: -1, defaultOn: false },
  { key: "dstPtsAllow35p", label: "35+ points allowed", group: "Team defense", kind: "count", defaultPoints: -4, defaultOn: false },
  // ── Individual defensive players (IDP) ─────────────────────────────────────
  { key: "idpTackleSolo", label: "Solo tackle", group: "IDP", kind: "count", defaultPoints: 1, defaultOn: false },
  { key: "idpTackleAst", label: "Assisted tackle", group: "IDP", kind: "count", defaultPoints: 0.5, defaultOn: false },
  { key: "idpSack", label: "Sack", group: "IDP", kind: "count", defaultPoints: 2, defaultOn: false },
  { key: "idpInt", label: "Interception", group: "IDP", kind: "count", defaultPoints: 3, defaultOn: false },
  { key: "idpTd", label: "Defensive TD", group: "IDP", kind: "count", defaultPoints: 6, defaultOn: false },
  { key: "idpForcedFumble", label: "Forced fumble", group: "IDP", kind: "count", defaultPoints: 2, defaultOn: false, advanced: true },
  { key: "idpFumRec", label: "Fumble recovery", group: "IDP", kind: "count", defaultPoints: 2, defaultOn: false, advanced: true },
  { key: "idpPassDefended", label: "Pass defended", group: "IDP", kind: "count", defaultPoints: 1, defaultOn: false, advanced: true },
  { key: "idpSafety", label: "Safety", group: "IDP", kind: "count", defaultPoints: 2, defaultOn: false, advanced: true },
  { key: "idpTackleForLoss", label: "Tackle for loss", group: "IDP", kind: "count", defaultPoints: 1, defaultOn: false, advanced: true },
  { key: "idpQbHit", label: "QB hit", group: "IDP", kind: "count", defaultPoints: 1, defaultOn: false, advanced: true },
  { key: "idpBlockedKick", label: "Blocked kick", group: "IDP", kind: "count", defaultPoints: 2, defaultOn: false, advanced: true },
];

const BASEBALL_CATALOG: StatCategory[] = [
  // ── Hitting ────────────────────────────────────────────────────────────────
  { key: "single", label: "Single", group: "Hitting", kind: "count", defaultPoints: 1, defaultOn: true },
  { key: "double", label: "Double", group: "Hitting", kind: "count", defaultPoints: 2, defaultOn: true },
  { key: "triple", label: "Triple", group: "Hitting", kind: "count", defaultPoints: 3, defaultOn: true },
  { key: "homeRun", label: "Home run", group: "Hitting", kind: "count", defaultPoints: 4, defaultOn: true },
  { key: "rbi", label: "RBI", group: "Hitting", kind: "count", defaultPoints: 1, defaultOn: true },
  { key: "run", label: "Run", group: "Hitting", kind: "count", defaultPoints: 1, defaultOn: true },
  { key: "stolenBase", label: "Stolen base", group: "Hitting", kind: "count", defaultPoints: 2, defaultOn: true },
  { key: "walk", label: "Walk", group: "Hitting", kind: "count", defaultPoints: 1, defaultOn: true },
  { key: "hitByPitch", label: "Hit by pitch", group: "Hitting", kind: "count", defaultPoints: 1, defaultOn: false, advanced: true },
  { key: "strikeout", label: "Strikeout (batter)", group: "Hitting", kind: "count", defaultPoints: -0.5, defaultOn: false, advanced: true },
  { key: "caughtStealing", label: "Caught stealing", group: "Hitting", kind: "count", defaultPoints: -1, defaultOn: false, advanced: true },
  // ── Pitching ───────────────────────────────────────────────────────────────
  // Innings are stored as a decimal (outs ÷ 3) so a partial inning scores
  // fairly (see normalizeMlbPitching); the wizard frames it as "per 1 inning".
  { key: "inningsPitched", label: "Innings pitched", group: "Pitching", kind: "rate", unit: "inning", defaultPoints: 3, defaultPer: 1, defaultOn: true },
  { key: "strikeoutPitched", label: "Strikeout (pitcher)", group: "Pitching", kind: "count", defaultPoints: 1, defaultOn: true },
  { key: "win", label: "Win", group: "Pitching", kind: "count", defaultPoints: 5, defaultOn: true },
  { key: "save", label: "Save", group: "Pitching", kind: "count", defaultPoints: 5, defaultOn: true },
  { key: "earnedRun", label: "Earned run allowed", group: "Pitching", kind: "count", defaultPoints: -2, defaultOn: true },
  { key: "hold", label: "Hold", group: "Pitching", kind: "count", defaultPoints: 3, defaultOn: false, advanced: true },
  { key: "qualityStart", label: "Quality start", group: "Pitching", kind: "count", defaultPoints: 3, defaultOn: false, advanced: true },
  { key: "loss", label: "Loss", group: "Pitching", kind: "count", defaultPoints: -3, defaultOn: false, advanced: true },
  { key: "hitAllowed", label: "Hit allowed", group: "Pitching", kind: "count", defaultPoints: -1, defaultOn: false, advanced: true },
  { key: "walkAllowed", label: "Walk allowed", group: "Pitching", kind: "count", defaultPoints: -1, defaultOn: false, advanced: true },
  { key: "hitBatsman", label: "Hit batsman", group: "Pitching", kind: "count", defaultPoints: -1, defaultOn: false, advanced: true },
  { key: "completeGame", label: "Complete game", group: "Pitching", kind: "count", defaultPoints: 3, defaultOn: false, advanced: true },
  { key: "shutout", label: "Shutout", group: "Pitching", kind: "count", defaultPoints: 5, defaultOn: false, advanced: true },
  { key: "noHitter", label: "No-hitter", group: "Pitching", kind: "count", defaultPoints: 10, defaultOn: false, advanced: true },
];

const BASKETBALL_CATALOG: StatCategory[] = [
  // ── Scoring ────────────────────────────────────────────────────────────────
  // "point" is a count awarded per single point scored (DFS values it at 1 each).
  { key: "point", label: "Point", group: "Scoring", kind: "count", defaultPoints: 1, defaultOn: true },
  { key: "threePointerMade", label: "3-pointer made", group: "Scoring", kind: "count", defaultPoints: 0.5, defaultOn: true },
  { key: "fieldGoalMade", label: "Field goal made", group: "Scoring", kind: "count", defaultPoints: 1, defaultOn: false, advanced: true },
  { key: "freeThrowMade", label: "Free throw made", group: "Scoring", kind: "count", defaultPoints: 1, defaultOn: false, advanced: true },
  // ── Rebounding ───────────────────────────────────────────────────────────────
  { key: "rebound", label: "Rebound", group: "Rebounding", kind: "count", defaultPoints: 1.2, defaultOn: true },
  { key: "offensiveRebound", label: "Offensive rebound", group: "Rebounding", kind: "count", defaultPoints: 0.5, defaultOn: false, advanced: true },
  { key: "defensiveRebound", label: "Defensive rebound", group: "Rebounding", kind: "count", defaultPoints: 0.5, defaultOn: false, advanced: true },
  // ── Playmaking ───────────────────────────────────────────────────────────────
  { key: "assist", label: "Assist", group: "Playmaking", kind: "count", defaultPoints: 1.5, defaultOn: true },
  { key: "turnover", label: "Turnover", group: "Playmaking", kind: "count", defaultPoints: -1, defaultOn: true },
  // ── Defense ────────────────────────────────────────────────────────────────
  { key: "steal", label: "Steal", group: "Defense", kind: "count", defaultPoints: 3, defaultOn: true },
  { key: "block", label: "Block", group: "Defense", kind: "count", defaultPoints: 3, defaultOn: true },
  { key: "personalFoul", label: "Personal foul", group: "Defense", kind: "count", defaultPoints: -0.5, defaultOn: false, advanced: true },
  // ── Bonuses ──────────────────────────────────────────────────────────────────
  // Derived at import from the counting stats (≥10 in two/three categories); each
  // fires at most once per game (a triple-double is also a double-double).
  { key: "doubleDouble", label: "Double-double", group: "Bonuses", kind: "count", defaultPoints: 1.5, defaultOn: false, advanced: true },
  { key: "tripleDouble", label: "Triple-double", group: "Bonuses", kind: "count", defaultPoints: 3, defaultOn: false, advanced: true },
];

export const STAT_CATALOG: Record<Sport, StatCategory[]> = {
  [Sport.FOOTBALL]: FOOTBALL_CATALOG,
  [Sport.BASEBALL]: BASEBALL_CATALOG,
  [Sport.BASKETBALL]: BASKETBALL_CATALOG,
};

// Fast key → category lookup for a sport.
export function catalogByKey(sport: Sport): Map<string, StatCategory> {
  return new Map(STAT_CATALOG[sport].map((c) => [c.key, c]));
}

// Every valid scoring key across all sports (for label derivation / validation).
export const ALL_STAT_CATEGORIES: StatCategory[] = Object.values(STAT_CATALOG).flat();

// ── Rate ⇄ points-per-unit conversion ────────────────────────────────────────
// A rate stat is shown as "<points> pt per <per> <unit>s" but stored as a single
// points-per-unit multiplier (statLine holds raw yards, so scoring multiplies
// yards × pointsPerUnit). Count stats store their points directly.

/** UI framing (points, per) → the stored points-per-unit value. */
export function toPointsPerUnit(
  cat: StatCategory,
  points: number,
  per?: number,
): number {
  if (cat.kind !== "rate") return points;
  const denom = per ?? cat.defaultPer ?? 1;
  return denom ? points / denom : 0;
}

/**
 * Stored points-per-unit → UI framing. Rate stats normalize to the category's
 * default denominator (e.g. 0.04 → { points: 1, per: 25 }); the pair is only one
 * of infinitely many equivalent framings, so we pick the natural one.
 */
export function fromPointsPerUnit(
  cat: StatCategory,
  pointsPerUnit: number,
): { points: number; per: number } {
  if (cat.kind !== "rate") return { points: pointsPerUnit, per: 1 };
  const per = cat.defaultPer ?? 1;
  return { points: Math.round(pointsPerUnit * per * 1000) / 1000, per };
}
