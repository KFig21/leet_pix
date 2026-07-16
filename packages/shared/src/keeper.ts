// Keeper-cost helpers. A keeper poll option can carry the draft slot forfeited
// to keep that player: a round, optionally a pick within the round, and — at the
// poll level — the league size (team count). Round + pick + league size resolve
// to the true overall pick number (a snake/linear draft counts straight through:
// 10-team round 5 pick 7 → pick 47).

export interface KeeperCost {
  round?: number | null;
  pick?: number | null;
  leagueSize?: number | null;
}

/** Overall pick number, or null when round/pick/leagueSize aren't all present. */
export function overallPickNumber(c: KeeperCost): number | null {
  if (!c.round || !c.pick || !c.leagueSize) return null;
  return (c.round - 1) * c.leagueSize + c.pick;
}

/**
 * Short display label for a keeper cost, or null when no round is set. Shows the
 * round & pick, with the true overall pick in parens when it can be computed:
 *   round + pick + leagueSize → "R5 · P7 (#47 overall)"
 *   round + pick              → "R5 · P7"
 *   round only                → "Round 5"
 */
export function formatKeeperCost(c: KeeperCost): string | null {
  if (!c.round) return null;
  const overall = overallPickNumber(c);
  if (c.pick && overall != null)
    return `R${c.round} · P${c.pick} (#${overall} overall)`;
  if (c.pick) return `R${c.round} · P${c.pick}`;
  return `Round ${c.round}`;
}
