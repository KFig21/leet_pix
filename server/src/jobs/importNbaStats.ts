import { prisma } from "../lib/prisma";
import { normalizeEspnNbaStats } from "../lib/statKeys";
import { nbaPeriod } from "../lib/nbaPeriod";

interface EspnEvent {
  id: string;
  status?: { type?: { state?: string } };
}
interface EspnBoxAthlete {
  athlete?: { id?: string };
  didNotPlay?: boolean;
  stats?: string[];
}
interface EspnBoxTeam {
  statistics?: { keys?: string[]; athletes?: EspnBoxAthlete[] }[];
}

// Import actual box-score lines for all NBA games on a date (YYYY-MM-DD) from
// ESPN's free summary endpoint, keyed by our nbaPeriod (ET calendar date).
// Returns lines imported. Pass `finalOnly` (used by the same-day sweep) to skip
// games still in progress, so partial in-game stats never trigger a premature
// resolution.
export async function importNbaStats(
  date: string,
  opts: { finalOnly?: boolean } = {},
): Promise<number> {
  const scoreboard = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard` +
      `?dates=${date.replace(/-/g, "")}`,
  );
  if (!scoreboard.ok) {
    throw new Error(`ESPN scoreboard responded ${scoreboard.status}`);
  }
  const sdata = (await scoreboard.json()) as { events?: EspnEvent[] };
  let events = sdata.events ?? [];
  if (opts.finalOnly) {
    events = events.filter((e) => e.status?.type?.state === "post");
  }
  if (events.length === 0) return 0;

  const players = await prisma.player.findMany({
    where: { sport: "BASKETBALL", nbaId: { not: null } },
    select: { id: true, nbaId: true },
  });
  const byNba = new Map(players.map((p) => [p.nbaId!, p.id]));

  // Every game on a date shares the same nbaPeriod, but compute per game so a
  // late tip-off that rolls past midnight ET still lands in the right period.
  let n = 0;
  for (const ev of events) {
    const summary = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary` +
        `?event=${ev.id}`,
    );
    if (!summary.ok) continue;
    const box = (await summary.json()) as {
      boxscore?: { players?: EspnBoxTeam[] };
      header?: { competitions?: { date?: string }[] };
    };
    const gameDate = box.header?.competitions?.[0]?.date;
    const { season, week } = nbaPeriod(
      gameDate ? new Date(gameDate) : new Date(`${date}T12:00:00Z`),
    );

    for (const team of box.boxscore?.players ?? []) {
      const block = team.statistics?.[0];
      const keys = block?.keys ?? [];
      for (const entry of block?.athletes ?? []) {
        const espnId = entry.athlete?.id;
        const playerId = espnId ? byNba.get(String(espnId)) : undefined;
        if (!playerId) continue;
        // DNP rows have no stats (or a mismatched-length row) — skip them so we
        // never write an empty line over a real one.
        if (entry.didNotPlay || !entry.stats || entry.stats.length !== keys.length) {
          continue;
        }
        const stats = normalizeEspnNbaStats(keys, entry.stats);
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
          update: { stats, source: "espn" },
          create: { playerId, season, week, kind: "ACTUAL", stats, source: "espn" },
        });
        n++;
      }
    }
  }
  return n;
}
