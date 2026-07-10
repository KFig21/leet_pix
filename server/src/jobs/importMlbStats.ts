import { prisma } from "../lib/prisma";
import { normalizeMlbBatting } from "../lib/statKeys";
import { mlbPeriod } from "../lib/mlbPeriod";

interface ScheduleGame {
  gamePk: number;
  gameDate: string;
  status?: { abstractGameState?: string };
}
interface BoxscorePlayer {
  person?: { id?: number };
  stats?: { batting?: Record<string, number> };
}

// Import actual batting lines for all MLB games on a date (YYYY-MM-DD) from the
// free MLB Stats API boxscores, keyed by our mlbPeriod. Returns lines imported.
// Pass `finalOnly` (used by the same-day sweep) to skip games still in progress,
// so partial in-game stats never trigger a premature resolution.
export async function importMlbStats(
  date: string,
  opts: { finalOnly?: boolean } = {},
): Promise<number> {
  const sched = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`,
  );
  if (!sched.ok) throw new Error(`MLB schedule responded ${sched.status}`);
  const sdata = (await sched.json()) as {
    dates?: { games?: ScheduleGame[] }[];
  };
  let games = sdata.dates?.flatMap((d) => d.games ?? []) ?? [];
  if (opts.finalOnly) {
    games = games.filter((g) => g.status?.abstractGameState === "Final");
  }
  if (games.length === 0) return 0;

  const players = await prisma.player.findMany({
    where: { sport: "BASEBALL", mlbamId: { not: null } },
    select: { id: true, mlbamId: true },
  });
  const byMlbam = new Map(players.map((p) => [p.mlbamId!, p.id]));

  let n = 0;
  for (const g of games) {
    const { season, week } = mlbPeriod(new Date(g.gameDate));
    const box = await fetch(
      `https://statsapi.mlb.com/api/v1/game/${g.gamePk}/boxscore`,
    );
    if (!box.ok) continue;
    const bdata = (await box.json()) as {
      teams?: Record<string, { players?: Record<string, BoxscorePlayer> }>;
    };
    for (const side of ["home", "away"] as const) {
      const roster = bdata.teams?.[side]?.players ?? {};
      for (const entry of Object.values(roster)) {
        const playerId = entry.person?.id
          ? byMlbam.get(String(entry.person.id))
          : undefined;
        const batting = entry.stats?.batting;
        if (!playerId || !batting) continue;
        const stats = normalizeMlbBatting(batting);
        if (Object.keys(stats).length === 0) continue;
        await prisma.playerStat.upsert({
          where: {
            playerId_season_week_kind: {
              playerId,
              season,
              week,
              kind: "ACTUAL",
            },
          },
          update: { stats, source: "mlb" },
          create: { playerId, season, week, kind: "ACTUAL", stats, source: "mlb" },
        });
        n++;
      }
    }
  }
  return n;
}
