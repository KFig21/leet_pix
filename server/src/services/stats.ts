import type {
  ProfileStatsResponse,
  StatWindow,
  AccuracyStats,
} from "@leetpix/shared";
import {
  HOT_STREAK_THRESHOLD,
  COLD_STREAK_THRESHOLD,
  POLL_QUESTION_VERBS,
} from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/error";

const WINDOWS: StatWindow[] = ["day", "week", "month", "year", "lifetime"];

function windowStart(window: StatWindow): Date | null {
  if (window === "lifetime") return null;
  const d = new Date();
  const days = { day: 1, week: 7, month: 30, year: 365 }[window]!;
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Aggregates a user's resolved poll results into the profile read-model:
 * accuracy per window, hot/cold streak, and GitHub-style heat-map cells.
 */
export async function computeProfileStats(
  username: string,
): Promise<ProfileStatsResponse> {
  const profile = await prisma.profile.findUnique({ where: { username } });
  if (!profile) throw new HttpError(404, "Not found");

  // All graded results for this user, newest first. Pull the picked option +
  // poll question so the heat-map day drill-down can list what they picked.
  const results = await prisma.pollResult.findMany({
    where: { vote: { voterId: profile.id } },
    orderBy: { resolvedAt: "desc" },
    select: {
      correct: true,
      score: true,
      resolvedAt: true,
      vote: {
        select: {
          poll: { select: { id: true, questionType: true } },
          option: { select: { playerName: true } },
        },
      },
    },
  });

  const accuracyByWindow = Object.fromEntries(
    WINDOWS.map((w) => [w, accuracyFor(results, w)]),
  ) as Record<StatWindow, AccuracyStats>;

  // Streak: walk from most recent while sign is consistent.
  let current = 0;
  if (results.length) {
    const sign = results[0].correct;
    for (const r of results) {
      if (r.correct !== sign) break;
      current += 1;
    }
    if (!sign) current = -current;
  }

  let longestWin = 0;
  let run = 0;
  for (const r of [...results].reverse()) {
    run = r.correct ? run + 1 : 0;
    longestWin = Math.max(longestWin, run);
  }

  return {
    accuracyByWindow,
    streak: {
      current,
      isHot: current >= HOT_STREAK_THRESHOLD,
      isCold: current <= -COLD_STREAK_THRESHOLD,
      longestWin,
    },
    heatmap: buildHeatmap(results),
  };
}

interface ResultRow {
  correct: boolean;
  score: number;
  resolvedAt: Date;
  vote: {
    poll: { id: string; questionType: string };
    option: { playerName: string };
  };
}

function accuracyFor(results: ResultRow[], window: StatWindow): AccuracyStats {
  const start = windowStart(window);
  const inWindow = start ? results.filter((r) => r.resolvedAt >= start) : results;
  const correct = inWindow.filter((r) => r.correct).length;
  const total = inWindow.length;
  return {
    window,
    totalVotes: total,
    correct,
    incorrect: total - correct,
    accuracy: total ? correct / total : 0,
    score: inWindow.reduce((s, r) => s + r.score, 0),
  };
}

function buildHeatmap(results: ResultRow[]): ProfileStatsResponse["heatmap"] {
  const byDay = new Map<
    string,
    { votes: number; correct: number; picks: HeatmapPickRow[] }
  >();
  // `results` is newest-first, so picks land newest-first per day too.
  for (const r of results) {
    const key = r.resolvedAt.toISOString().slice(0, 10);
    const cell = byDay.get(key) ?? { votes: 0, correct: 0, picks: [] };
    cell.votes += 1;
    if (r.correct) cell.correct += 1;
    cell.picks.push({
      pollId: r.vote.poll.id,
      question:
        POLL_QUESTION_VERBS[
          r.vote.poll.questionType as keyof typeof POLL_QUESTION_VERBS
        ] ?? r.vote.poll.questionType,
      player: r.vote.option.playerName,
      correct: r.correct,
    });
    byDay.set(key, cell);
  }
  return [...byDay.entries()].map(([date, c]) => ({
    date,
    votes: c.votes,
    correct: c.correct,
    intensity: c.votes ? (2 * c.correct) / c.votes - 1 : 0,
    picks: c.picks,
  }));
}

type HeatmapPickRow = ProfileStatsResponse["heatmap"][number]["picks"][number];
