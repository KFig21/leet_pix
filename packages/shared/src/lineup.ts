// A league's starting lineup + bench, expressed as a count per slot. This is
// what conveys positional scarcity to voters: a superflex or 3-WR league makes
// those positions more valuable. Football-only for now.

export const LINEUP_SLOTS = [
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "SUPERFLEX",
  "K",
  "DST",
  "BENCH",
] as const;
export type LineupSlot = (typeof LINEUP_SLOTS)[number];
export type LineupSlots = Record<LineupSlot, number>;

export const LINEUP_SLOT_LABELS: Record<LineupSlot, string> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  FLEX: "FLEX",
  SUPERFLEX: "SUPERFLEX",
  K: "K",
  DST: "D/ST",
  BENCH: "Bench",
};

// Short help text shown next to the flex-type slots in the builder.
export const LINEUP_SLOT_HINTS: Partial<Record<LineupSlot, string>> = {
  FLEX: "RB/WR/TE",
  SUPERFLEX: "QB/RB/WR/TE",
};

// A conventional 1-QB redraft starting lineup + bench.
export const DEFAULT_FOOTBALL_LINEUP: LineupSlots = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  SUPERFLEX: 0,
  K: 1,
  DST: 1,
  BENCH: 6,
};

/** Total starting spots (everything but the bench). */
export function startingSpots(lineup: LineupSlots): number {
  return LINEUP_SLOTS.reduce(
    (n, slot) => (slot === "BENCH" ? n : n + (lineup[slot] || 0)),
    0,
  );
}

/** Total roster size (starters + bench). */
export function rosterSize(lineup: LineupSlots): number {
  return startingSpots(lineup) + (lineup.BENCH || 0);
}
