import {
  NFL_REGULAR_SEASON_WEEKS,
  PollQuestionType,
  SCORING_PRESET_RULES,
  isScoreablePoll,
  isSeasonProjectionPoll,
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

// Rest-of-season week range (this week through the regular-season finale),
// clamped so an out-of-range week never produces an empty/backwards span.
export const seasonWeeks = (week: number): number[] => {
  const start = Math.min(Math.max(week, 1), NFL_REGULAR_SEASON_WEEKS);
  return Array.from(
    { length: NFL_REGULAR_SEASON_WEEKS - start + 1 },
    (_, i) => start + i,
  );
};

// Weeks a poll's *projection* should sum over: the whole rest of the season for
// keeper (season-long) questions, else the poll's own outcome window.
export const projectionWeeks = (
  questionType: PollQuestionType,
  week: number,
  evaluationWeeks: number | null,
): number[] =>
  isSeasonProjectionPoll(questionType)
    ? seasonWeeks(week)
    : pollWeeks(week, evaluationWeeks);

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

// Scoring source shared by polls and leagues.
interface ScoringSource {
  scoringPreset: string | null;
  scoringFormat?: { rules: unknown } | null;
}

function sourceRules(src: ScoringSource): ScoringRules | null {
  if (src.scoringFormat) return src.scoringFormat.rules as ScoringRules;
  if (src.scoringPreset) {
    return SCORING_PRESET_RULES[src.scoringPreset as ScoringPreset] ?? null;
  }
  return null;
}

// Resolve a poll's scoring rules. Prefers the frozen snapshot captured at
// creation (so edits to the league/format don't retroactively change scoring),
// then the attached league (which owns scoring), then the poll's own scoring.
export function pollRules(poll: {
  scoringPreset: string | null;
  scoringFormat?: { rules: unknown } | null;
  league?: ScoringSource | null;
  resolvedScoring?: unknown;
}): ScoringRules | null {
  if (poll.resolvedScoring) return poll.resolvedScoring as ScoringRules;
  if (poll.league) return sourceRules(poll.league);
  return sourceRules(poll);
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
    include: {
      options: true,
      scoringFormat: true,
      league: { include: { scoringFormat: true } },
    },
  });

  let updated = 0;
  for (const poll of polls) {
    // Scoreable polls carry a graded projection; keeper polls carry an
    // informational season-long one. Everything else has no projection.
    if (!isScoreablePoll(poll.questionType) && !isSeasonProjectionPoll(poll.questionType))
      continue;
    const rules = pollRules(poll);
    if (!rules) continue;

    const weeks = projectionWeeks(
      poll.questionType,
      poll.week!,
      poll.evaluationWeeks,
    );
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
