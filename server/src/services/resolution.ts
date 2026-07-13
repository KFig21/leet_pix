import { PollQuestionType } from "@prisma/client";
import {
  QUESTION_RESOLUTION,
  SCORING_PRESET_RULES,
  isScoreablePoll,
  type ScoringPreset,
  type ScoringRules,
} from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { periodGamesFinal, pollGamesFinal } from "../lib/schedule";
import { scoreStatLine, riskScore } from "./scoring";
import { notifyPollResolved } from "./notifications";

// Sum an option's fantasy points across the target week(s) under `rules`.
async function optionPoints(
  playerId: string,
  season: number,
  weeks: number[],
  rules: ScoringRules,
  position?: string | null,
): Promise<number> {
  const lines = await prisma.playerStat.findMany({
    where: { playerId, season, week: { in: weeks }, kind: "ACTUAL" },
    select: { stats: true },
  });
  let total = 0;
  for (const l of lines) {
    total += scoreStatLine(l.stats as Record<string, number>, rules, position);
  }
  return Math.round(total * 100) / 100;
}

/**
 * Grade a scoreable poll against actual stats: score each option, pick the
 * winner (HIGH = most points, LOW = fewest), grade every vote, and resolve.
 */
export async function resolvePoll(
  pollId: string,
  season: number,
  startWeek: number,
) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { options: true, votes: true, scoringFormat: true },
  });
  if (!poll) throw new Error("Poll not found");
  if (!isScoreablePoll(poll.questionType)) {
    throw new Error("Opinion poll — not scored");
  }

  const mode = QUESTION_RESOLUTION[poll.questionType]; // HIGH | LOW
  const rules: ScoringRules = poll.scoringFormatId
    ? (poll.scoringFormat!.rules as ScoringRules)
    : SCORING_PRESET_RULES[poll.scoringPreset as ScoringPreset];

  const weeks = poll.evaluationWeeks
    ? Array.from({ length: poll.evaluationWeeks }, (_, i) => startWeek + i)
    : [startWeek];

  // Player positions drive position-specific scoring overrides (e.g. a format
  // that values QB rushing TDs differently). Batched so we hit players once.
  const players = await prisma.player.findMany({
    where: { id: { in: poll.options.map((o) => o.playerId) } },
    select: { id: true, position: true },
  });
  const positionById = new Map(players.map((p) => [p.id, p.position]));

  const scored = await Promise.all(
    poll.options.map(async (o) => ({
      option: o,
      points: await optionPoints(
        o.playerId,
        season,
        weeks,
        rules,
        positionById.get(o.playerId),
      ),
    })),
  );

  const winner = scored.reduce((best, cur) =>
    mode === "HIGH"
      ? cur.points > best.points
        ? cur
        : best
      : cur.points < best.points
        ? cur
        : best,
  );

  await prisma.$transaction([
    ...scored.map((s) =>
      prisma.pollOption.update({
        where: { id: s.option.id },
        data: { actualPoints: s.points, isWinner: s.option.id === winner.option.id },
      }),
    ),
    ...poll.votes.map((v) => {
      const correct = v.optionId === winner.option.id;
      return prisma.pollResult.upsert({
        where: { voteId: v.id },
        update: { correct, score: riskScore(correct, v.consensusAtVote ?? 0) },
        create: {
          voteId: v.id,
          correct,
          score: riskScore(correct, v.consensusAtVote ?? 0),
        },
      });
    }),
    prisma.poll.update({
      where: { id: pollId },
      data: { status: "RESOLVED", resolvedAt: new Date(), season, week: startWeek },
    }),
  ]);

  const voterIds = poll.votes.map((v) => v.voterId);
  await notifyPollResolved(poll.id, poll.authorId, voterIds);

  return {
    winner: winner.option.playerName,
    results: scored.map((s) => ({ player: s.option.playerName, points: s.points })),
  };
}

const SCOREABLE = [
  PollQuestionType.START,
  PollQuestionType.BENCH,
  PollQuestionType.ADD,
  PollQuestionType.DROP,
];

/**
 * Resolve every scoreable poll that's past its lock time, is tagged with a
 * season/week, and whose week's stats have been imported. Returns resolved ids.
 * (Called by the scheduled job.)
 */
export async function resolveDuePolls(): Promise<string[]> {
  const due = await prisma.poll.findMany({
    where: {
      status: { not: "RESOLVED" },
      questionType: { in: SCOREABLE },
      season: { not: null },
      week: { not: null },
      lockAt: { not: null, lt: new Date() },
    },
    select: {
      id: true,
      sport: true,
      season: true,
      week: true,
      evaluationWeeks: true,
    },
  });

  const resolved: string[] = [];
  for (const p of due) {
    const lastWeek = p.week! + (p.evaluationWeeks ? p.evaluationWeeks - 1 : 0);
    // Gate on real completion. Single-period polls use their precisely linked
    // games; multi-week (add/drop) polls, whose later weeks weren't linkable at
    // creation, fall back to the period-wide check on the final week. Legacy
    // polls with no links also fall back.
    const singlePeriod = !p.evaluationWeeks || p.evaluationWeeks <= 1;
    const complete = singlePeriod
      ? ((await pollGamesFinal(p.id)) ??
        (await periodGamesFinal(p.sport, p.season!, lastWeek)))
      : await periodGamesFinal(p.sport, p.season!, lastWeek);
    if (!complete) continue;
    // And the box scores must be imported so scoring reflects real numbers.
    const ready = await prisma.playerStat.count({
      where: { season: p.season!, week: lastWeek, kind: "ACTUAL" },
    });
    if (ready === 0) continue;
    try {
      await resolvePoll(p.id, p.season!, p.week!);
      resolved.push(p.id);
    } catch {
      // Skip and retry next run (e.g. missing data for one option).
    }
  }
  return resolved;
}
