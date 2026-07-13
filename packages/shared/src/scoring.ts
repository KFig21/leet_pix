import { Sport, type ScoringPreset } from "./enums";
import type { ScoringRules } from "./schemas/scoringFormat";
import { ALL_STAT_CATEGORIES } from "./statCatalog";

// Short badge label per preset (e.g. "PPR", "0.5 PPR", "Standard").
export const SCORING_PRESET_LABELS: Record<ScoringPreset, string> = {
  FOOTBALL_STANDARD: "Standard",
  FOOTBALL_HALF_PPR: "0.5 PPR",
  FOOTBALL_PPR: "PPR",
  BASEBALL_STANDARD: "Standard",
};

const FOOTBALL_BASE: ScoringRules = {
  passingYards: 0.04,
  passingTd: 4,
  interception: -2,
  rushingYards: 0.1,
  rushingTd: 6,
  receivingYards: 0.1,
  receivingTd: 6,
  fumbleLost: -2,
};

// Full point values per preset — used for projections/stats AND the badge modal.
export const SCORING_PRESET_RULES: Record<ScoringPreset, ScoringRules> = {
  FOOTBALL_STANDARD: { ...FOOTBALL_BASE },
  FOOTBALL_HALF_PPR: { ...FOOTBALL_BASE, reception: 0.5 },
  FOOTBALL_PPR: { ...FOOTBALL_BASE, reception: 1 },
  BASEBALL_STANDARD: {
    single: 1,
    double: 2,
    triple: 3,
    homeRun: 4,
    rbi: 1,
    run: 1,
    stolenBase: 2,
    walk: 1,
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

/** Effective per-unit rate for a base stat, honoring a position override. */
export function effectiveRate(
  rules: ScoringRules,
  baseKey: string,
  position?: string | null,
): number {
  if (position) {
    const override = rules[`${baseKey}${POSITION_OVERRIDE_SEP}${position}`];
    if (override !== undefined) return override;
  }
  return rules[baseKey] ?? 0;
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
