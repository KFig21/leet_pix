import { prisma } from "../lib/prisma";
import { teamIdByAbbr } from "./importTeams";

// Fantasy-relevant positions (skip practice-squad noise, etc.). Includes IDP
// defensive positions (DL/LB/DB families) so individual defenders can be poll
// options in IDP leagues; their idp_* stats score position-agnostically.
const POSITIONS = new Set([
  // Offense + kicker + team defense
  "QB", "RB", "WR", "TE", "K", "DEF",
  // IDP — Sleeper's granular defensive positions
  "DL", "DE", "DT", "NT", "LB", "ILB", "OLB", "MLB", "DB", "CB", "S", "SS", "FS",
]);

interface SleeperPlayer {
  player_id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  team?: string | null;
  position?: string | null;
  active?: boolean;
  injury_status?: string | null;
  espn_id?: number | string | null;
  yahoo_id?: number | string | null;
}

const asStr = (v: unknown) => (v == null ? null : String(v));

// Sleeper's players endpoint is one big JSON blob of every NFL player, keyed by
// their id, and includes cross-reference ids (espn_id, yahoo_id). It's free and
// unauthenticated; they ask that you cache it (call at most ~once/day). Also
// refreshes team (trades) and injuryStatus. Returns the number upserted.
export async function importNflPlayers(): Promise<number> {
  const teamIds = await teamIdByAbbr("FOOTBALL");
  const res = await fetch("https://api.sleeper.app/v1/players/nfl");
  if (!res.ok) throw new Error(`Sleeper responded ${res.status}`);
  const data = (await res.json()) as Record<string, SleeperPlayer>;

  const players = Object.values(data).filter(
    (p) =>
      p.active &&
      p.position &&
      POSITIONS.has(p.position) &&
      (p.full_name || (p.first_name && p.last_name)),
  );

  let n = 0;
  for (const p of players) {
    const fullName =
      p.full_name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
    const fields = {
      fullName,
      firstName: p.first_name ?? null,
      lastName: p.last_name ?? null,
      team: p.team ?? null,
      teamId: (p.team ? teamIds.get(p.team) : undefined) ?? null,
      position: p.position ?? null,
      active: p.active ?? true,
      injuryStatus: p.injury_status || null,
      espnId: asStr(p.espn_id),
      yahooId: asStr(p.yahoo_id),
    };
    await prisma.player.upsert({
      where: { sleeperId: p.player_id },
      update: fields,
      create: { sport: "FOOTBALL", sleeperId: p.player_id, ...fields },
    });
    n++;
  }
  return n;
}

interface MlbPlayer {
  id: number;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  active?: boolean;
  currentTeam?: { id?: number; name?: string; abbreviation?: string };
  primaryPosition?: { abbreviation?: string };
}

// team id -> abbreviation, so players store the same abbreviations we color by
// (the players endpoint returns the team name, not its abbreviation).
async function mlbTeamAbbrevs(): Promise<Map<number, string>> {
  const res = await fetch("https://statsapi.mlb.com/api/v1/teams?sportId=1");
  if (!res.ok) throw new Error(`MLB responded ${res.status}`);
  const data = (await res.json()) as {
    teams?: { id: number; abbreviation?: string }[];
  };
  const map = new Map<number, string>();
  for (const t of data.teams ?? []) {
    if (t.abbreviation) map.set(t.id, t.abbreviation);
  }
  return map;
}

// MLB's Stats API is free and unauthenticated. sports/1 = MLB (majors).
// Returns the number of players upserted.
export async function importMlbPlayers(): Promise<number> {
  const teamAbbr = await mlbTeamAbbrevs();
  const teamIds = await teamIdByAbbr("BASEBALL");
  let season = new Date().getFullYear();
  let people: MlbPlayer[] = [];
  // The new season's roster may be empty early; fall back a year if so.
  for (let attempt = 0; attempt < 2 && people.length === 0; attempt++) {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/sports/1/players?season=${season}`,
    );
    if (!res.ok) throw new Error(`MLB responded ${res.status}`);
    people = ((await res.json()) as { people?: MlbPlayer[] }).people ?? [];
    if (people.length === 0) season -= 1;
  }

  let n = 0;
  for (const p of people) {
    const teamId = p.currentTeam?.id;
    const team =
      (teamId != null ? teamAbbr.get(teamId) : undefined) ??
      p.currentTeam?.abbreviation ??
      p.currentTeam?.name ??
      null;
    const fields = {
      fullName: p.fullName ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(),
      firstName: p.firstName ?? null,
      lastName: p.lastName ?? null,
      team,
      teamId: (team ? teamIds.get(team) : undefined) ?? null,
      position: p.primaryPosition?.abbreviation ?? null,
      active: p.active ?? true,
    };
    await prisma.player.upsert({
      where: { mlbamId: String(p.id) },
      update: fields,
      create: { sport: "BASEBALL", mlbamId: String(p.id), ...fields },
    });
    n++;
  }
  return n;
}

interface EspnRosterTeam {
  id: string;
  abbreviation?: string;
}
interface EspnRosterAthlete {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  position?: { abbreviation?: string };
  status?: { type?: string };
  injuries?: { status?: string }[];
}

// ESPN's team list (id + our-canonical abbreviation) for iterating rosters.
async function nbaTeams(): Promise<EspnRosterTeam[]> {
  const res = await fetch(
    "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams",
  );
  if (!res.ok) throw new Error(`ESPN responded ${res.status}`);
  const data = (await res.json()) as {
    sports?: { leagues?: { teams?: { team?: EspnRosterTeam }[] }[] }[];
  };
  return (
    data.sports?.[0]?.leagues?.[0]?.teams
      ?.map((t) => t.team)
      .filter((t): t is EspnRosterTeam => !!t?.id) ?? []
  );
}

// NBA players from ESPN's free, keyless per-team rosters. Keyed by ESPN athlete
// id (nbaId), which is also stored as espnId. Positions are ESPN's coarse trio
// (G/F/C). Also refreshes team (trades) and injuryStatus. Returns the number
// upserted. One request per team (30) plus the team list — light enough to run
// daily.
export async function importNbaPlayers(): Promise<number> {
  const teams = await nbaTeams();
  const teamIds = await teamIdByAbbr("BASKETBALL");

  let n = 0;
  for (const team of teams) {
    const abbr = team.abbreviation ?? null;
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.id}/roster`,
    );
    if (!res.ok) continue;
    const data = (await res.json()) as { athletes?: EspnRosterAthlete[] };
    for (const a of data.athletes ?? []) {
      if (!a.id || !(a.fullName || (a.firstName && a.lastName))) continue;
      const fields = {
        fullName:
          a.fullName ?? `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim(),
        firstName: a.firstName ?? null,
        lastName: a.lastName ?? null,
        team: abbr,
        teamId: (abbr ? teamIds.get(abbr) : undefined) ?? null,
        position: a.position?.abbreviation ?? null,
        active: a.status?.type ? a.status.type === "active" : true,
        injuryStatus: a.injuries?.[0]?.status || null,
        espnId: String(a.id),
      };
      await prisma.player.upsert({
        where: { nbaId: String(a.id) },
        update: fields,
        create: { sport: "BASKETBALL", nbaId: String(a.id), ...fields },
      });
      n++;
    }
  }
  return n;
}
