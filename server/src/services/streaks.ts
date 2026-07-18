import {
  Sport,
  SCORING_PRESET_RULES,
  classifyStreak,
  STREAK_RECENT_GAMES,
  STREAK_MIN_GAMES,
  type ScoringPreset,
  type PlayerStreak,
} from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { isUuid } from "../lib/uuid";
import { scoreStatLine } from "./scoring";

// Reference preset each sport's streak is measured in. Choice only sets the
// scale (the comparison is self-relative), so a middle-of-the-road preset is fine.
const REFERENCE_PRESET: Record<Sport, ScoringPreset> = {
  [Sport.FOOTBALL]: "FOOTBALL_HALF_PPR",
  [Sport.BASEBALL]: "BASEBALL_STANDARD",
  [Sport.BASKETBALL]: "BASKETBALL_STANDARD",
};

// How far back to pull stat lines: recent + baseline windows.
const WINDOW = STREAK_RECENT_GAMES * 2;

// Baseball and basketball weeks are YYYYMMDD dates; only look back ~45 days so we
// don't scan a whole season of daily lines. Football is small (≤18/season), so
// no floor.
const DAILY_LOOKBACK_DAYS = 45;
function dailyWeekFloor(): number {
  const d = new Date(Date.now() - DAILY_LOOKBACK_DAYS * 86_400_000);
  return Number(
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
      d.getUTCDate(),
    ).padStart(2, "0")}`,
  );
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Hot/cold streak per player, from their recent ACTUAL stat lines. Players
 * without enough scored games (or with no clear streak) are simply absent from
 * the map — callers treat a missing entry as "no streak".
 */
export async function streaksByPlayer(
  playerIds: string[],
): Promise<Map<string, PlayerStreak>> {
  const ids = [...new Set(playerIds.filter(isUuid))];
  const result = new Map<string, PlayerStreak>();
  if (ids.length === 0) return result;

  const players = await prisma.player.findMany({
    where: { id: { in: ids } },
    select: { id: true, sport: true, position: true },
  });
  if (players.length === 0) return result;

  const sportById = new Map(players.map((p) => [p.id, p.sport as Sport]));
  const positionById = new Map(players.map((p) => [p.id, p.position]));
  const footballIds = players.filter((p) => p.sport === "FOOTBALL").map((p) => p.id);
  // Baseball and basketball share the date-based (YYYYMMDD) week scheme.
  const dailyIds = players
    .filter((p) => p.sport === "BASEBALL" || p.sport === "BASKETBALL")
    .map((p) => p.id);

  // One query, bounded per sport (the date-based sports by a recent date floor).
  const or: object[] = [];
  if (footballIds.length) or.push({ playerId: { in: footballIds } });
  if (dailyIds.length) {
    or.push({ playerId: { in: dailyIds }, week: { gte: dailyWeekFloor() } });
  }

  const rows = await prisma.playerStat.findMany({
    where: { kind: "ACTUAL", OR: or },
    orderBy: [{ season: "desc" }, { week: "desc" }],
    select: { playerId: true, stats: true },
  });

  // Group newest-first, keeping only the window we need per player.
  const byPlayer = new Map<string, Record<string, number>[]>();
  for (const r of rows) {
    const list = byPlayer.get(r.playerId) ?? [];
    if (list.length < WINDOW) list.push(r.stats as Record<string, number>);
    byPlayer.set(r.playerId, list);
  }

  for (const [playerId, lines] of byPlayer) {
    if (lines.length < STREAK_MIN_GAMES) continue;
    const sport = sportById.get(playerId)!;
    const rules = SCORING_PRESET_RULES[REFERENCE_PRESET[sport]];
    const position = positionById.get(playerId);
    const points = lines.map((s) => scoreStatLine(s, rules, position));

    const recent = points.slice(0, STREAK_RECENT_GAMES);
    const baseline = points.slice(STREAK_RECENT_GAMES);
    if (baseline.length === 0) continue;

    const recentAvg = avg(recent);
    const baselineAvg = avg(baseline);
    const status = classifyStreak(sport, recentAvg, baselineAvg, points.length);
    if (!status) continue;

    result.set(playerId, {
      status,
      recentAvg: round1(recentAvg),
      baselineAvg: round1(baselineAvg),
      games: points.length,
    });
  }

  return result;
}
