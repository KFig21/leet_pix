// A league's starting lineup + bench, expressed as a count per slot. This is
// what conveys positional scarcity to voters: a superflex or 3-WR league makes
// those positions more valuable. Slots differ by sport (football skill
// positions vs. baseball field positions), so the slot set is sport-keyed.

import { Sport } from "./enums";

export const FOOTBALL_LINEUP_SLOTS = [
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "SUPERFLEX",
  "K",
  "DST",
  "IDP",
  "BENCH",
] as const;

export const BASEBALL_LINEUP_SLOTS = [
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "MI",
  "CI",
  "OF",
  "UTIL",
  "SP",
  "RP",
  "P",
  "BENCH",
] as const;

export const BASKETBALL_LINEUP_SLOTS = [
  "PG",
  "SG",
  "SF",
  "PF",
  "C",
  "G",
  "F",
  "UTIL",
  "BENCH",
] as const;

export type FootballLineupSlot = (typeof FOOTBALL_LINEUP_SLOTS)[number];
export type BaseballLineupSlot = (typeof BASEBALL_LINEUP_SLOTS)[number];
export type BasketballLineupSlot = (typeof BASKETBALL_LINEUP_SLOTS)[number];
export type LineupSlot =
  | FootballLineupSlot
  | BaseballLineupSlot
  | BasketballLineupSlot;

// A lineup is a sparse map — only the slots for its sport are present, so reads
// of an absent slot are `undefined` (treat as 0).
export type LineupSlots = Partial<Record<LineupSlot, number>>;

export const LINEUP_SLOTS_BY_SPORT: Record<Sport, readonly LineupSlot[]> = {
  [Sport.FOOTBALL]: FOOTBALL_LINEUP_SLOTS,
  [Sport.BASEBALL]: BASEBALL_LINEUP_SLOTS,
  [Sport.BASKETBALL]: BASKETBALL_LINEUP_SLOTS,
};

/** The starting/bench slots for a sport, in canonical roster order. */
export const slotsForSport = (sport: Sport): readonly LineupSlot[] =>
  LINEUP_SLOTS_BY_SPORT[sport];

// Every slot across sports, in a canonical order (BENCH last, listed once). Used
// where the sport isn't known — e.g. rendering a stored lineup, or summing
// starters — since a lineup only carries its own sport's keys. Slots shared
// across sports (C, UTIL) are de-duplicated so each appears exactly once.
export const ALL_LINEUP_SLOTS: readonly LineupSlot[] = [
  ...new Set<LineupSlot>(
    [
      ...FOOTBALL_LINEUP_SLOTS,
      ...BASEBALL_LINEUP_SLOTS,
      ...BASKETBALL_LINEUP_SLOTS,
    ].filter((s) => s !== "BENCH"),
  ),
  "BENCH",
];

export const LINEUP_SLOT_LABELS: Record<LineupSlot, string> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  FLEX: "FLEX",
  SUPERFLEX: "SUPERFLEX",
  K: "K",
  DST: "D/ST",
  IDP: "IDP",
  C: "C",
  "1B": "1B",
  "2B": "2B",
  "3B": "3B",
  SS: "SS",
  MI: "MI",
  CI: "CI",
  OF: "OF",
  UTIL: "UTIL",
  SP: "SP",
  RP: "RP",
  P: "P",
  // Basketball (C/UTIL are shared with baseball above).
  PG: "PG",
  SG: "SG",
  SF: "SF",
  PF: "PF",
  G: "G",
  F: "F",
  BENCH: "Bench",
};

// Short help text shown next to flex-type slots in the builder.
export const LINEUP_SLOT_HINTS: Partial<Record<LineupSlot, string>> = {
  FLEX: "RB/WR/TE",
  SUPERFLEX: "QB/RB/WR/TE",
  IDP: "DL/LB/DB",
  MI: "2B/SS",
  CI: "1B/3B",
  UTIL: "Any hitter",
  P: "SP/RP",
  // Basketball flex slots.
  G: "PG/SG",
  F: "SF/PF",
};

// Per-slot ceiling so counts stay sane (mirrored by the zod bounds).
export const LINEUP_SLOT_MAX: Record<LineupSlot, number> = {
  QB: 5,
  RB: 10,
  WR: 10,
  TE: 5,
  FLEX: 5,
  SUPERFLEX: 3,
  K: 3,
  DST: 3,
  IDP: 10,
  C: 3,
  "1B": 3,
  "2B": 3,
  "3B": 3,
  SS: 3,
  MI: 3,
  CI: 3,
  OF: 8,
  UTIL: 5,
  SP: 10,
  RP: 10,
  P: 10,
  // Basketball (C/UTIL are shared with baseball above).
  PG: 4,
  SG: 4,
  SF: 4,
  PF: 4,
  G: 4,
  F: 4,
  BENCH: 20,
};

// A conventional 1-QB redraft starting lineup + bench (no IDP by default).
export const DEFAULT_FOOTBALL_LINEUP: LineupSlots = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  SUPERFLEX: 0,
  K: 1,
  DST: 1,
  IDP: 0,
  BENCH: 6,
};

// A conventional mixed-league starting lineup: one of each infield spot, a MI/CI
// corner, 3 OF, a UTIL, and a small pitching staff.
export const DEFAULT_BASEBALL_LINEUP: LineupSlots = {
  C: 1,
  "1B": 1,
  "2B": 1,
  "3B": 1,
  SS: 1,
  MI: 1,
  CI: 1,
  OF: 3,
  UTIL: 1,
  SP: 2,
  RP: 2,
  P: 0,
  BENCH: 5,
};

// A conventional NBA fantasy starting lineup: one of each position, a G and F
// flex, three UTIL, and a short bench.
export const DEFAULT_BASKETBALL_LINEUP: LineupSlots = {
  PG: 1,
  SG: 1,
  SF: 1,
  PF: 1,
  C: 1,
  G: 1,
  F: 1,
  UTIL: 3,
  BENCH: 3,
};

export const DEFAULT_LINEUP_BY_SPORT: Record<Sport, LineupSlots> = {
  [Sport.FOOTBALL]: DEFAULT_FOOTBALL_LINEUP,
  [Sport.BASEBALL]: DEFAULT_BASEBALL_LINEUP,
  [Sport.BASKETBALL]: DEFAULT_BASKETBALL_LINEUP,
};

/** Total starting spots (everything but the bench). */
export function startingSpots(lineup: LineupSlots): number {
  return ALL_LINEUP_SLOTS.reduce(
    (n, slot) => (slot === "BENCH" ? n : n + (lineup[slot] || 0)),
    0,
  );
}

/** Total roster size (starters + bench). */
export function rosterSize(lineup: LineupSlots): number {
  return startingSpots(lineup) + (lineup.BENCH || 0);
}
