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

/**
 * Arrange the positions actually present (from the facets endpoint) into display
 * groups, dropping empty groups and preserving roster order. Anything
 * unrecognized falls into a trailing "Other" group so nothing is ever hidden.
 */
export function groupFootballPositions(present: string[]): PositionGroup[] {
  const set = new Set(present);
  const used = new Set<string>();
  const groups: PositionGroup[] = [];

  for (const g of FOOTBALL_POSITION_GROUPS) {
    const positions = g.positions.filter((p) => set.has(p));
    positions.forEach((p) => used.add(p));
    if (positions.length) groups.push({ label: g.label, positions });
  }

  const other = present.filter((p) => !used.has(p)).sort();
  if (other.length) groups.push({ label: "Other", positions: other });
  return groups;
}
