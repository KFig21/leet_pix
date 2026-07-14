import { Sport, type ScoringPreset } from "./enums";
import type { ScoringRules, ScoringRuleValue } from "./schemas/scoringFormat";
import { ALL_STAT_CATEGORIES } from "./statCatalog";
import type { StatCategory } from "./statCatalog";

// Short badge label per preset (e.g. "PPR", "0.5 PPR", "Standard").
export const SCORING_PRESET_LABELS: Record<ScoringPreset, string> = {
  FOOTBALL_STANDARD: "Standard",
  FOOTBALL_HALF_PPR: "0.5 PPR",
  FOOTBALL_PPR: "PPR",
  BASEBALL_STANDARD: "Standard",
};

// Rate stats carry their intended framing { points, per }; count stats a number.
const FOOTBALL_BASE: ScoringRules = {
  passingYards: { points: 1, per: 25 },
  passingTd: 4,
  interception: -2,
  rushingYards: { points: 1, per: 10 },
  rushingTd: 6,
  receivingYards: { points: 1, per: 10 },
  receivingTd: 6,
  fumbleLost: -2,
};

// Full point values per preset — used for projections/stats AND the badge modal.
export const SCORING_PRESET_RULES: Record<ScoringPreset, ScoringRules> = {
  FOOTBALL_STANDARD: { ...FOOTBALL_BASE },
  FOOTBALL_HALF_PPR: { ...FOOTBALL_BASE, reception: 0.5 },
  FOOTBALL_PPR: { ...FOOTBALL_BASE, reception: 1 },
  BASEBALL_STANDARD: {
    // Hitting
    single: 1,
    double: 2,
    triple: 3,
    homeRun: 4,
    rbi: 1,
    run: 1,
    stolenBase: 2,
    walk: 1,
    // Pitching
    inningsPitched: { points: 3, per: 1 },
    strikeoutPitched: 1,
    win: 5,
    save: 5,
    earnedRun: -2,
  },
};

// Which presets are offered per sport in the poll creator.
export const SPORT_PRESETS: Record<Sport, ScoringPreset[]> = {
  [Sport.FOOTBALL]: ["FOOTBALL_STANDARD", "FOOTBALL_HALF_PPR", "FOOTBALL_PPR"],
  [Sport.BASEBALL]: ["BASEBALL_STANDARD"],
};

// Human-readable labels for stat category keys (for the scoring modal). Derived
// from the stat catalog so labels live in exactly one place.
export const STAT_LABELS: Record<string, string> = Object.fromEntries(
  ALL_STAT_CATEGORIES.map((c) => [c.key, c.label]),
);

export function statLabel(key: string): string {
  return STAT_LABELS[key] ?? key;
}

// ── Position-aware scoring ────────────────────────────────────────────────────
// A rule key may be position-scoped as "<base>.<POS>" (e.g. "rushingTd.QB") to
// override the base rate for players of that position — this is how a format can
// score QB rushing TDs differently from everyone else's. The helpers below are
// the single source of truth used by both the server (resolution/projections)
// and the client (scoring breakdown), so points never diverge.

export const POSITION_OVERRIDE_SEP = ".";

// Category lookup for display (label/unit/kind), tolerant of override keys.
const CATEGORY_BY_KEY = new Map(ALL_STAT_CATEGORIES.map((c) => [c.key, c]));
export function categoryForKey(key: string): StatCategory | undefined {
  return CATEGORY_BY_KEY.get(key.split(POSITION_OVERRIDE_SEP)[0]);
}

/** Collapse a stored rule value to points-per-unit (rate → points/per). */
export function ruleToPointsPerUnit(value: ScoringRuleValue | undefined): number {
  if (value === undefined) return 0;
  if (typeof value === "number") return value;
  return value.per ? value.points / value.per : 0;
}

/**
 * Human-readable award for a rule value, honoring the stored framing:
 *   rate  → "1 pt per 25 yards" (or "3 pts per inning" when per is 1)
 *   count → "+4" / "-2"
 * Legacy rate values stored as a bare points-per-unit number fall back to a
 * plain number (they read as a count) — new formats store the framing.
 */
export function formatScoringRule(key: string, value: ScoringRuleValue): string {
  if (typeof value === "object") {
    const unit = categoryForKey(key)?.unit ?? "unit";
    const pts = `${value.points} pt${Math.abs(value.points) === 1 ? "" : "s"}`;
    return value.per === 1
      ? `${pts} per ${unit}`
      : `${pts} per ${value.per} ${unit}s`;
  }
  return value > 0 ? `+${value}` : `${value}`;
}

/** Distinct base stat keys in a rule set (override suffixes stripped, order kept). */
export function baseCategoryKeys(rules: ScoringRules): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of Object.keys(rules)) {
    const base = key.split(POSITION_OVERRIDE_SEP)[0];
    if (!seen.has(base)) {
      seen.add(base);
      out.push(base);
    }
  }
  return out;
}

/** Effective points-per-unit for a base stat, honoring a position override. */
export function effectiveRate(
  rules: ScoringRules,
  baseKey: string,
  position?: string | null,
): number {
  if (position) {
    const override = rules[`${baseKey}${POSITION_OVERRIDE_SEP}${position}`];
    if (override !== undefined) return ruleToPointsPerUnit(override);
  }
  return ruleToPointsPerUnit(rules[baseKey]);
}

/** Points a player earns for one base category (for the breakdown display). */
export function categoryPoints(
  stats: Record<string, number>,
  rules: ScoringRules,
  baseKey: string,
  position?: string | null,
): number {
  return (
    Math.round((stats[baseKey] ?? 0) * effectiveRate(rules, baseKey, position) * 100) /
    100
  );
}

/** Total fantasy points for a stat line under `rules`, honoring position overrides. */
export function scoreStatLine(
  stats: Record<string, number>,
  rules: ScoringRules,
  position?: string | null,
): number {
  let total = 0;
  for (const base of baseCategoryKeys(rules)) {
    total += (stats[base] ?? 0) * effectiveRate(rules, base, position);
  }
  return Math.round(total * 100) / 100;
}
