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
  { key: "bonusPassYd300", label: "300+ passing yards bonus", group: "Passing", kind: "count", defaultPoints: 3, defaultOn: false },
  { key: "passingTd40_49", label: "Passing TD 40–49 yds bonus", group: "Passing", kind: "count", defaultPoints: 2, defaultOn: false },
  { key: "passingTd50p", label: "Passing TD 50+ yds bonus", group: "Passing", kind: "count", defaultPoints: 2, defaultOn: false },
  // ── Rushing ────────────────────────────────────────────────────────────────
  { key: "rushingYards", label: "Rushing yards", group: "Rushing", kind: "rate", unit: "yard", defaultPoints: 1, defaultPer: 10, defaultOn: true },
  // Rushing TDs can carry a QB-specific rate (many leagues value QB rush TDs less).
  { key: "rushingTd", label: "Rushing TD", group: "Rushing", kind: "count", defaultPoints: 6, defaultOn: true, overridePositions: ["QB"] },
  { key: "bonusRushYd100", label: "100+ rushing yards bonus", group: "Rushing", kind: "count", defaultPoints: 3, defaultOn: false },
  // ── Receiving ──────────────────────────────────────────────────────────────
  { key: "reception", label: "Reception", group: "Receiving", kind: "count", defaultPoints: 1, defaultOn: true },
  { key: "receivingYards", label: "Receiving yards", group: "Receiving", kind: "rate", unit: "yard", defaultPoints: 1, defaultPer: 10, defaultOn: true },
  { key: "receivingTd", label: "Receiving TD", group: "Receiving", kind: "count", defaultPoints: 6, defaultOn: true },
  { key: "bonusRecYd100", label: "100+ receiving yards bonus", group: "Receiving", kind: "count", defaultPoints: 3, defaultOn: false },
  { key: "receivingTd40_49", label: "Receiving TD 40–49 yds bonus", group: "Receiving", kind: "count", defaultPoints: 2, defaultOn: false },
  { key: "receivingTd50p", label: "Receiving TD 50+ yds bonus", group: "Receiving", kind: "count", defaultPoints: 2, defaultOn: false },
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
  { key: "xpMiss", label: "Extra point missed", group: "Kicking", kind: "count", defaultPoints: -1, defaultOn: false },
  // ── Team defense (DST) ─────────────────────────────────────────────────────
  { key: "dstSack", label: "Sack", group: "Team defense", kind: "count", defaultPoints: 1, defaultOn: false },
  { key: "dstInt", label: "Interception", group: "Team defense", kind: "count", defaultPoints: 2, defaultOn: false },
  { key: "dstFumRec", label: "Fumble recovery", group: "Team defense", kind: "count", defaultPoints: 2, defaultOn: false },
  { key: "dstForcedFumble", label: "Forced fumble", group: "Team defense", kind: "count", defaultPoints: 1, defaultOn: false },
  { key: "dstTd", label: "Defensive TD", group: "Team defense", kind: "count", defaultPoints: 6, defaultOn: false },
  { key: "dstSpecialTeamsTd", label: "Special teams TD", group: "Team defense", kind: "count", defaultPoints: 6, defaultOn: false },
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
  { key: "idpForcedFumble", label: "Forced fumble", group: "IDP", kind: "count", defaultPoints: 2, defaultOn: false },
  { key: "idpFumRec", label: "Fumble recovery", group: "IDP", kind: "count", defaultPoints: 2, defaultOn: false },
  { key: "idpPassDefended", label: "Pass defended", group: "IDP", kind: "count", defaultPoints: 1, defaultOn: false },
  { key: "idpTd", label: "Defensive TD", group: "IDP", kind: "count", defaultPoints: 6, defaultOn: false },
  { key: "idpSafety", label: "Safety", group: "IDP", kind: "count", defaultPoints: 2, defaultOn: false },
  { key: "idpTackleForLoss", label: "Tackle for loss", group: "IDP", kind: "count", defaultPoints: 1, defaultOn: false },
  { key: "idpQbHit", label: "QB hit", group: "IDP", kind: "count", defaultPoints: 1, defaultOn: false },
  { key: "idpBlockedKick", label: "Blocked kick", group: "IDP", kind: "count", defaultPoints: 2, defaultOn: false },
];

const BASEBALL_CATALOG: StatCategory[] = [
  // Hitting
  { key: "single", label: "Single", group: "Hitting", kind: "count", defaultPoints: 1, defaultOn: true },
  { key: "double", label: "Double", group: "Hitting", kind: "count", defaultPoints: 2, defaultOn: true },
  { key: "triple", label: "Triple", group: "Hitting", kind: "count", defaultPoints: 3, defaultOn: true },
  { key: "homeRun", label: "Home run", group: "Hitting", kind: "count", defaultPoints: 4, defaultOn: true },
  // Production
  { key: "rbi", label: "RBI", group: "Production", kind: "count", defaultPoints: 1, defaultOn: true },
  { key: "run", label: "Run", group: "Production", kind: "count", defaultPoints: 1, defaultOn: true },
  // Other
  { key: "stolenBase", label: "Stolen base", group: "Other", kind: "count", defaultPoints: 2, defaultOn: true },
  { key: "walk", label: "Walk", group: "Other", kind: "count", defaultPoints: 1, defaultOn: true },
];

export const STAT_CATALOG: Record<Sport, StatCategory[]> = {
  [Sport.FOOTBALL]: FOOTBALL_CATALOG,
  [Sport.BASEBALL]: BASEBALL_CATALOG,
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
