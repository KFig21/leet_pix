import { prisma } from "./prisma";
import { isUuid } from "./uuid";
import { mlbPeriod } from "./mlbPeriod";
import { streaksByPlayer } from "../services/streaks";

interface OptionLike {
  playerId: string;
}
interface PollLike {
  sport: string;
  season: number | null;
  week: number | null;
  options: OptionLike[];
}

// Enriches every poll option with its player's meta (team, position, injury) and,
// for football polls with a known week, that player's game (opponent + kickoff).
// One batched player query plus one batched game query for the whole list.
export async function attachPlayerContext<T extends PollLike>(
  polls: T[],
): Promise<T[]> {
  if (polls.length === 0) return polls;

  const playerIds = new Set<string>();
  for (const p of polls) {
    p.options.forEach((o) => {
      if (isUuid(o.playerId)) playerIds.add(o.playerId);
    });
  }

  const players =
    playerIds.size > 0
      ? await prisma.player.findMany({
          where: { id: { in: [...playerIds] } },
          select: { id: true, team: true, position: true, injuryStatus: true },
        })
      : [];
  const pById = new Map(players.map((p) => [p.id, p]));
  // Recent-form (hot/cold) badge per option player, batched for the whole list.
  const streaks = await streaksByPlayer([...playerIds]);

  interface GameCtx {
    opponent: string;
    atHome: boolean;
    kickoff: Date;
    status: string;
  }
  // Index of team's game per period, keyed differently per sport (football is
  // week-based; baseball is date-based via mlbPeriod).
  const gIdx = new Map<string, GameCtx>();
  const addGame = (key: string, g: GameCtx) => gIdx.set(key, g);

  const isFootball = (p: PollLike) =>
    p.sport === "FOOTBALL" && p.season != null && p.week != null;
  const isBaseball = (p: PollLike) =>
    p.sport === "BASEBALL" && p.week != null;

  // ── Football games (by season/week/team) ──
  const fbSeasons = new Set<number>();
  const fbWeeks = new Set<number>();
  const fbTeams = new Set<string>();
  for (const p of polls.filter(isFootball)) {
    fbSeasons.add(p.season!);
    fbWeeks.add(p.week!);
    for (const o of p.options) {
      const t = pById.get(o.playerId)?.team;
      if (t) fbTeams.add(t);
    }
  }
  if (fbTeams.size) {
    const games = await prisma.game.findMany({
      where: {
        sport: "FOOTBALL",
        season: { in: [...fbSeasons] },
        week: { in: [...fbWeeks] },
        OR: [{ homeTeam: { in: [...fbTeams] } }, { awayTeam: { in: [...fbTeams] } }],
      },
      select: {
        season: true,
        week: true,
        homeTeam: true,
        awayTeam: true,
        kickoff: true,
        status: true,
      },
    });
    for (const g of games) {
      const base = { kickoff: g.kickoff, status: g.status };
      addGame(`fb|${g.season}|${g.week}|${g.homeTeam}`, { ...base, opponent: g.awayTeam, atHome: true });
      addGame(`fb|${g.season}|${g.week}|${g.awayTeam}`, { ...base, opponent: g.homeTeam, atHome: false });
    }
  }

  // ── Baseball games (by ET date/team). Game.week is null for MLB, so we bracket
  // a UTC window around the poll dates and match games by their computed period. ──
  const bbWeeks = new Set<number>();
  const bbTeams = new Set<string>();
  for (const p of polls.filter(isBaseball)) {
    bbWeeks.add(p.week!);
    for (const o of p.options) {
      const t = pById.get(o.playerId)?.team;
      if (t) bbTeams.add(t);
    }
  }
  if (bbTeams.size) {
    const noons = [...bbWeeks].map((w) => {
      const y = Math.floor(w / 10000);
      const m = Math.floor((w % 10000) / 100) - 1;
      const d = w % 100;
      return Date.UTC(y, m, d, 12);
    });
    const start = new Date(Math.min(...noons) - 24 * 3600_000);
    const end = new Date(Math.max(...noons) + 24 * 3600_000);
    const games = await prisma.game.findMany({
      where: {
        sport: "BASEBALL",
        kickoff: { gte: start, lte: end },
        OR: [{ homeTeam: { in: [...bbTeams] } }, { awayTeam: { in: [...bbTeams] } }],
      },
      select: {
        homeTeam: true,
        awayTeam: true,
        kickoff: true,
        status: true,
      },
    });
    for (const g of games) {
      const wk = mlbPeriod(g.kickoff).week;
      if (!bbWeeks.has(wk)) continue;
      const base = { kickoff: g.kickoff, status: g.status };
      addGame(`bb|${wk}|${g.homeTeam}`, { ...base, opponent: g.awayTeam, atHome: true });
      addGame(`bb|${wk}|${g.awayTeam}`, { ...base, opponent: g.homeTeam, atHome: false });
    }
  }

  for (const p of polls) {
    for (const o of p.options) {
      const pl = pById.get(o.playerId);
      const opt = o as OptionLike & { player?: unknown; game?: unknown };
      opt.player = pl
        ? {
            team: pl.team,
            position: pl.position,
            injuryStatus: pl.injuryStatus,
            streak: streaks.get(pl.id) ?? null,
          }
        : null;
      if (!pl?.team) {
        opt.game = null;
      } else if (isFootball(p)) {
        opt.game = gIdx.get(`fb|${p.season}|${p.week}|${pl.team}`) ?? null;
      } else if (isBaseball(p)) {
        opt.game = gIdx.get(`bb|${p.week}|${pl.team}`) ?? null;
      } else {
        opt.game = null;
      }
    }
  }
  return polls;
}
