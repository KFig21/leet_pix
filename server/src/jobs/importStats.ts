import { prisma } from "../lib/prisma";
import { normalizeSleeperStats } from "../lib/statKeys";

type StatKind = "actual" | "projection";

// Pull Sleeper's free, keyless NFL stats/projections for one week and upsert a
// normalized PlayerStat row per player (matched by the sleeperId we stored).
// Returns the number of stat lines imported.
export async function importNflStats(
  season: number,
  week: number,
  kind: StatKind = "actual",
): Promise<number> {
  const endpoint = kind === "projection" ? "projections" : "stats";
  const dbKind = kind === "projection" ? "PROJECTION" : "ACTUAL";

  const res = await fetch(
    `https://api.sleeper.app/v1/${endpoint}/nfl/regular/${season}/${week}`,
  );
  if (!res.ok) throw new Error(`Sleeper responded ${res.status}`);
  const data = (await res.json()) as Record<string, Record<string, number>>;

  const players = await prisma.player.findMany({
    where: { sport: "FOOTBALL", sleeperId: { not: null } },
    select: { id: true, sleeperId: true },
  });

  let n = 0;
  for (const p of players) {
    const raw = data[p.sleeperId!];
    if (!raw) continue;
    const stats = normalizeSleeperStats(raw);
    if (Object.keys(stats).length === 0) continue;
    await prisma.playerStat.upsert({
      where: {
        playerId_season_week_kind: { playerId: p.id, season, week, kind: dbKind },
      },
      update: { stats, source: "sleeper" },
      create: { playerId: p.id, season, week, kind: dbKind, stats, source: "sleeper" },
    });
    n++;
  }
  return n;
}
