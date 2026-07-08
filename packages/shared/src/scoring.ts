import { Sport, type ScoringPreset } from "./enums";
import type { ScoringRules } from "./schemas/scoringFormat";

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

// Human-readable labels for stat category keys (for the scoring modal).
export const STAT_LABELS: Record<string, string> = {
  passingYards: "Passing yards",
  passingTd: "Passing TD",
  interception: "Interception",
  rushingYards: "Rushing yards",
  rushingTd: "Rushing TD",
  receivingYards: "Receiving yards",
  receivingTd: "Receiving TD",
  reception: "Reception",
  fumbleLost: "Fumble lost",
  single: "Single",
  double: "Double",
  triple: "Triple",
  homeRun: "Home run",
  rbi: "RBI",
  run: "Run",
  stolenBase: "Stolen base",
  walk: "Walk",
};

export function statLabel(key: string): string {
  return STAT_LABELS[key] ?? key;
}
