import {
  SCORING_PRESET_RULES,
  isScoreablePoll,
  type ScoringPreset,
  type ScoringRules,
} from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { isUuid } from "../lib/uuid";
import { scoreStatLine } from "./scoring";

// The weeks a poll's outcome spans (windowed add/drop tally over N weeks).
const pollWeeks = (week: number, evaluationWeeks: number | null): number[] =>
  evaluationWeeks
    ? Array.from({ length: evaluationWeeks }, (_, i) => week + i)
    : [week];

// Projected fantasy points per player under `rules`, summed across `weeks` from
// imported PROJECTION stat lines. Players without a projection are absent.
export async function projectedPointsByPlayer(
  playerIds: string[],
  season: number,
  weeks: number[],
  rules: ScoringRules,
): Promise<Map<string, number>> {
  const ids = playerIds.filter(isUuid);
  const totals = new Map<string, number>();
  if (ids.length === 0) return totals;

  // Positions drive scoring overrides (e.g. QB rushing TDs), so projections
  // match how the poll will actually resolve.
  const players = await prisma.player.findMany({
    where: { id: { in: ids } },
    select: { id: true, position: true },
  });
  const positionById = new Map(players.map((p) => [p.id, p.position]));

  const lines = await prisma.playerStat.findMany({
    where: { playerId: { in: ids }, season, week: { in: weeks }, kind: "PROJECTION" },
    select: { playerId: true, stats: true },
  });
  for (const l of lines) {
    const pts = scoreStatLine(
      l.stats as Record<string, number>,
      rules,
      positionById.get(l.playerId),
    );
    totals.set(l.playerId, (totals.get(l.playerId) ?? 0) + pts);
  }
  for (const [k, v] of totals) totals.set(k, Math.round(v * 100) / 100);
  return totals;
}

// Resolve a poll's scoring rules from its preset or custom format.
export function pollRules(poll: {
  scoringFormatId: string | null;
  scoringPreset: string | null;
  scoringFormat?: { rules: unknown } | null;
}): ScoringRules | null {
  if (poll.scoringFormatId && poll.scoringFormat) {
    return poll.scoringFormat.rules as ScoringRules;
  }
  if (poll.scoringPreset) {
    return SCORING_PRESET_RULES[poll.scoringPreset as ScoringPreset] ?? null;
  }
  return null;
}

// Recompute projectedPoints for every OPEN scoreable football poll from the
// latest projections (called after the projection import). Returns the number of
// options updated. Idempotent.
export async function refreshOpenPollProjections(): Promise<number> {
  const polls = await prisma.poll.findMany({
    where: {
      status: "OPEN",
      sport: "FOOTBALL",
      season: { not: null },
      week: { not: null },
    },
    include: { options: true, scoringFormat: true },
  });

  let updated = 0;
  for (const poll of polls) {
    if (!isScoreablePoll(poll.questionType)) continue;
    const rules = pollRules(poll);
    if (!rules) continue;

    const weeks = pollWeeks(poll.week!, poll.evaluationWeeks);
    const map = await projectedPointsByPlayer(
      poll.options.map((o) => o.playerId),
      poll.season!,
      weeks,
      rules,
    );
    for (const o of poll.options) {
      const pts = map.get(o.playerId) ?? null;
      if (pts !== o.projectedPoints) {
        await prisma.pollOption.update({
          where: { id: o.id },
          data: { projectedPoints: pts },
        });
        updated++;
      }
    }
  }
  return updated;
}
