// Football positions grouped for display. With IDP support the flat position
// list got long, so the player-filter dropdown groups the familiar
// offense/kicker/team-defense positions above the individual-defender (IDP)
// positions. Order within each group is the natural roster order, not alphabetical.

export interface PositionGroup {
  label: string;
  positions: string[];
}

export const FOOTBALL_POSITION_GROUPS: PositionGroup[] = [
  { label: "Offense", positions: ["QB", "RB", "WR", "TE"] },
  { label: "Kicker / Team D", positions: ["K", "DEF"] },
  {
    label: "IDP",
    positions: [
      "DL", "DE", "DT", "NT",
      "LB", "ILB", "OLB", "MLB",
      "DB", "CB", "S", "SS", "FS",
    ],
  },
];

// Basketball positions. ESPN's NBA rosters only report the coarse trio (G/F/C),
// so those are the positions we actually store; the fine positions (PG/SG/SF/PF)
// are listed too so any manually-tagged player still groups sensibly.
export const BASKETBALL_POSITION_GROUPS: PositionGroup[] = [
  { label: "Guards", positions: ["PG", "SG", "G"] },
  { label: "Forwards", positions: ["SF", "PF", "F"] },
  { label: "Centers", positions: ["C"] },
];

/**
 * Arrange the positions actually present (from the facets endpoint) into display
 * groups, dropping empty groups and preserving roster order. Anything
 * unrecognized falls into a trailing "Other" group so nothing is ever hidden.
 */
function groupBy(
  groups: PositionGroup[],
  present: string[],
): PositionGroup[] {
  const set = new Set(present);
  const used = new Set<string>();
  const out: PositionGroup[] = [];

  for (const g of groups) {
    const positions = g.positions.filter((p) => set.has(p));
    positions.forEach((p) => used.add(p));
    if (positions.length) out.push({ label: g.label, positions });
  }

  const other = present.filter((p) => !used.has(p)).sort();
  if (other.length) out.push({ label: "Other", positions: other });
  return out;
}

export function groupFootballPositions(present: string[]): PositionGroup[] {
  return groupBy(FOOTBALL_POSITION_GROUPS, present);
}

export function groupBasketballPositions(present: string[]): PositionGroup[] {
  return groupBy(BASKETBALL_POSITION_GROUPS, present);
}
