import { Sport, type PlayerStreak } from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { isUuid } from "../lib/uuid";
import { streaksByPlayer } from "./streaks";

// One player as shown in the discovery lists. `streak` is present when the player
// is on a hot/cold run; `pollCount` is set for the trending list (how many recent
// poll options referenced them).
export interface DiscoveryPlayer {
  id: string;
  fullName: string;
  team: string | null;
  position: string | null;
  sport: Sport;
  streak: PlayerStreak | null;
  pollCount?: number;
}

export interface ExplorePlayers {
  hot: DiscoveryPlayer[];
  cold: DiscoveryPlayer[];
  trending: DiscoveryPlayer[];
}

const LIST_SIZE = 10;
// Trending = referenced in poll options created within this window.
const TRENDING_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// Discovery lists are expensive-ish (streaks scan the active pool), and change
// slowly, so cache per sport for a few minutes.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<Sport, { at: number; data: ExplorePlayers }>();

/** Clear the memoized discovery lists (e.g. after a stats refresh). */
export function invalidateExplorePlayers(): void {
  cache.clear();
}

export async function getExplorePlayers(sport: Sport): Promise<ExplorePlayers> {
  const hit = cache.get(sport);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const data = await computeExplorePlayers(sport);
  cache.set(sport, { at: Date.now(), data });
  return data;
}

async function computeExplorePlayers(sport: Sport): Promise<ExplorePlayers> {
  // ── Hot / cold: streaks across the sport's active, stat-having players ──
  const candidates = await prisma.player.findMany({
    where: { sport, active: true, stats: { some: { kind: "ACTUAL" } } },
    select: { id: true },
  });
  const streaks = await streaksByPlayer(candidates.map((c) => c.id));

  // ── Trending: most-referenced players in recent, live poll options ──
  const since = new Date(Date.now() - TRENDING_WINDOW_MS);
  const grouped = await prisma.pollOption.groupBy({
    by: ["playerId"],
    where: {
      poll: { sport, createdAt: { gte: since }, deletedAt: null, hiddenAt: null },
    },
    _count: { playerId: true },
    orderBy: { _count: { playerId: "desc" } },
    take: 40,
  });
  const trendingCounts = new Map<string, number>();
  for (const g of grouped) {
    if (isUuid(g.playerId)) trendingCounts.set(g.playerId, g._count.playerId);
  }

  // One meta fetch for every id we might render.
  const ids = new Set<string>([...streaks.keys(), ...trendingCounts.keys()]);
  if (ids.size === 0) return { hot: [], cold: [], trending: [] };
  const players = await prisma.player.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, fullName: true, team: true, position: true, sport: true },
  });
  const meta = new Map(players.map((p) => [p.id, p]));

  const toPlayer = (id: string, extra?: Partial<DiscoveryPlayer>): DiscoveryPlayer | null => {
    const m = meta.get(id);
    if (!m) return null;
    return {
      id: m.id,
      fullName: m.fullName,
      team: m.team,
      position: m.position,
      sport: m.sport as Sport,
      streak: streaks.get(id) ?? null,
      ...extra,
    };
  };

  // Hot: biggest positive swing first. Cold: biggest drop first.
  const streakPlayers = [...streaks.entries()];
  const hot = streakPlayers
    .filter(([, s]) => s.status === "hot")
    .sort((a, b) => b[1].recentAvg - b[1].baselineAvg - (a[1].recentAvg - a[1].baselineAvg))
    .map(([id]) => toPlayer(id))
    .filter((p): p is DiscoveryPlayer => p != null)
    .slice(0, LIST_SIZE);
  const cold = streakPlayers
    .filter(([, s]) => s.status === "cold")
    .sort((a, b) => b[1].baselineAvg - b[1].recentAvg - (a[1].baselineAvg - a[1].recentAvg))
    .map(([id]) => toPlayer(id))
    .filter((p): p is DiscoveryPlayer => p != null)
    .slice(0, LIST_SIZE);

  const trending = [...trendingCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => toPlayer(id, { pollCount: count }))
    .filter((p): p is DiscoveryPlayer => p != null)
    .slice(0, LIST_SIZE);

  return { hot, cold, trending };
}
