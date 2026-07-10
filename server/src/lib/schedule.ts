import { GAME_LOCK_LEAD_MS } from "@leetpix/shared";
import type { Sport } from "@prisma/client";
import { prisma } from "./prisma";
import { mlbPeriod } from "./mlbPeriod";

// The game for a set of teams in a given week, keyed by team abbreviation. Used
// to derive lock times and to show each option's opponent/kickoff on a poll.
export interface TeamGame {
  homeTeam: string;
  awayTeam: string;
  kickoff: Date;
  status: string;
}

// Each team's next upcoming game (kickoff in the future), indexed by team
// abbreviation — used to show a player's next matchup in the picker, for any
// sport. Returns the earliest future game per team.
export async function upcomingGameByTeam(
  sport: Sport,
  teams: string[],
): Promise<Map<string, TeamGame>> {
  const wanted = teams.filter(Boolean);
  const byTeam = new Map<string, TeamGame>();
  if (wanted.length === 0) return byTeam;

  const games = await prisma.game.findMany({
    where: {
      sport,
      kickoff: { gt: new Date() },
      OR: [{ homeTeam: { in: wanted } }, { awayTeam: { in: wanted } }],
    },
    orderBy: { kickoff: "asc" },
    select: { homeTeam: true, awayTeam: true, kickoff: true, status: true },
  });
  // Earliest-first: keep the first (soonest) game seen for each team.
  for (const g of games) {
    if (!byTeam.has(g.homeTeam)) byTeam.set(g.homeTeam, g);
    if (!byTeam.has(g.awayTeam)) byTeam.set(g.awayTeam, g);
  }
  return byTeam;
}

// Load the week's games touching any of `teams`, indexed by both teams so a
// caller can look up a player's game by their team abbreviation.
export async function gamesForTeams(
  sport: Sport,
  season: number,
  week: number,
  teams: string[],
): Promise<Map<string, TeamGame>> {
  const wanted = teams.filter(Boolean);
  const byTeam = new Map<string, TeamGame>();
  if (wanted.length === 0) return byTeam;

  const games = await prisma.game.findMany({
    where: {
      sport,
      season,
      week,
      OR: [{ homeTeam: { in: wanted } }, { awayTeam: { in: wanted } }],
    },
    select: { homeTeam: true, awayTeam: true, kickoff: true, status: true },
  });
  for (const g of games) {
    byTeam.set(g.homeTeam, g);
    byTeam.set(g.awayTeam, g);
  }
  return byTeam;
}

// Earliest kickoff among the given players' games, minus the lock lead time.
// Returns null if the schedule for any player is missing (caller falls back to
// leaving the poll unscheduled). Only meaningful for weekly sports (NFL).
export async function gameStartLockAt(
  sport: Sport,
  season: number,
  week: number,
  playerIds: string[],
): Promise<Date | null> {
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { team: true },
  });
  const teams = players.map((p) => p.team).filter((t): t is string => !!t);
  if (teams.length === 0) return null;

  const byTeam = await gamesForTeams(sport, season, week, teams);
  // Every player must have a known game, else we can't be sure of the true lock.
  const kickoffs = teams.map((t) => byTeam.get(t)?.kickoff);
  if (kickoffs.some((k) => !k)) return null;

  const earliest = Math.min(...kickoffs.map((k) => k!.getTime()));
  return new Date(earliest - GAME_LOCK_LEAD_MS);
}

// Baseball has no weekly structure, so a "who should I start" poll targets each
// player's next scheduled game. Returns the lock time (earliest upcoming kickoff
// − lead) plus the grading period (that game's date). Null if no upcoming game
// is on the imported schedule.
export async function baseballStartInfo(
  playerIds: string[],
): Promise<{ lockAt: Date; season: number; week: number } | null> {
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { teamId: true },
  });
  const teamIds = players
    .map((p) => p.teamId)
    .filter((t): t is string => !!t);
  if (teamIds.length === 0) return null;

  const next = await prisma.game.findFirst({
    where: {
      sport: "BASEBALL",
      kickoff: { gt: new Date() },
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
    },
    orderBy: { kickoff: "asc" },
    select: { kickoff: true },
  });
  if (!next) return null;

  const { season, week } = mlbPeriod(next.kickoff);
  return {
    lockAt: new Date(next.kickoff.getTime() - GAME_LOCK_LEAD_MS),
    season,
    week,
  };
}

// The specific games a poll depends on, resolved from its option players at
// creation time (frozen via the poll_games join so later trades don't drift it).
// Football: each player's team game in (season, week). Baseball: each player's
// next scheduled game. Returns de-duplicated Game ids.
export async function pollGameIds(
  sport: Sport,
  season: number,
  week: number,
  playerIds: string[],
): Promise<string[]> {
  if (sport === "FOOTBALL") {
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      select: { team: true },
    });
    const teams = players.map((p) => p.team).filter((t): t is string => !!t);
    if (teams.length === 0) return [];
    const games = await prisma.game.findMany({
      where: {
        sport: "FOOTBALL",
        season,
        week,
        OR: [{ homeTeam: { in: teams } }, { awayTeam: { in: teams } }],
      },
      select: { id: true },
    });
    return games.map((g) => g.id);
  }

  // BASEBALL: each player's next upcoming game (by team).
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { teamId: true },
  });
  const teamIds = [
    ...new Set(players.map((p) => p.teamId).filter((t): t is string => !!t)),
  ];
  const now = new Date();
  const ids = new Set<string>();
  for (const teamId of teamIds) {
    const g = await prisma.game.findFirst({
      where: {
        sport: "BASEBALL",
        kickoff: { gt: now },
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      },
      orderBy: { kickoff: "asc" },
      select: { id: true },
    });
    if (g) ids.add(g.id);
  }
  return [...ids];
}

// Precise completion gate: are all of a poll's linked games done? Returns null
// when the poll has no linked games (legacy/opinion polls) so the caller can
// fall back to the period-wide check.
export async function pollGamesFinal(pollId: string): Promise<boolean | null> {
  const links = await prisma.pollGame.findMany({
    where: { pollId },
    select: { game: { select: { status: true } } },
  });
  if (links.length === 0) return null;
  return links.every(
    (l) => l.game.status === "FINAL" || l.game.status === "POSTPONED",
  );
}

// Are all games for a sport's scoring period complete? A poll grades only once
// every game in its period is FINAL (or POSTPONED — those never produce stats,
// so they can't gate resolution forever). Returns false if no games are known
// for the period yet, so we never resolve against an unknown/partial slate.
//
// Football periods are (season, week). Baseball has no week column — its poll
// `week` encodes an ET calendar date (YYYYMMDD via mlbPeriod), so we bracket a
// UTC window around that date and match games by their computed period.
export async function periodGamesFinal(
  sport: Sport,
  season: number,
  week: number,
): Promise<boolean> {
  const isDone = (s: string) => s === "FINAL" || s === "POSTPONED";

  if (sport === "FOOTBALL") {
    const games = await prisma.game.findMany({
      where: { sport: "FOOTBALL", season, week },
      select: { status: true },
    });
    if (games.length === 0) return false;
    return games.every((g) => isDone(g.status));
  }

  // BASEBALL: week is a YYYYMMDD ET date. Query a generous UTC window, then
  // keep only games whose mlbPeriod matches this exact date.
  const y = Math.floor(week / 10000);
  const m = Math.floor((week % 10000) / 100) - 1;
  const d = week % 100;
  const noon = Date.UTC(y, m, d, 12); // midday UTC anchor for the ET date
  const start = new Date(noon - 24 * 3600_000);
  const end = new Date(noon + 24 * 3600_000);
  const games = await prisma.game.findMany({
    where: { sport: "BASEBALL", kickoff: { gte: start, lte: end } },
    select: { status: true, kickoff: true },
  });
  const inPeriod = games.filter((g) => mlbPeriod(g.kickoff).week === week);
  if (inPeriod.length === 0) return false;
  return inPeriod.every((g) => isDone(g.status));
}
