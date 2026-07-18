import type { GameStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { teamIdByAbbr } from "./importTeams";

// ESPN team abbreviations mostly match Sleeper's (what Player.team stores); the
// few that differ are remapped here so schedule joins line up.
const ESPN_TEAM_FIXUP: Record<string, string> = {
  WSH: "WAS", // Washington
};
const nflTeam = (abbr: string) => ESPN_TEAM_FIXUP[abbr] ?? abbr;

const espnStatus = (type?: {
  state?: string;
  name?: string;
}): GameStatus => {
  const name = type?.name ?? "";
  if (name.includes("POSTPONED") || name.includes("CANCELED")) return "POSTPONED";
  if (type?.state === "post") return "FINAL";
  if (type?.state === "in") return "IN_PROGRESS";
  return "SCHEDULED";
};

interface EspnEvent {
  id: string;
  date: string;
  status?: { type?: { state?: string; name?: string } };
  competitions?: {
    competitors?: { homeAway?: string; team?: { abbreviation?: string } }[];
  }[];
}

// NFL games for one week from ESPN's free, keyless scoreboard API. Returns the
// number of games upserted.
export async function importNflGames(
  season: number,
  week: number,
): Promise<number> {
  const teamId = await teamIdByAbbr("FOOTBALL");
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` +
    `?seasontype=2&week=${week}&dates=${season}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN responded ${res.status}`);
  const data = (await res.json()) as { events?: EspnEvent[] };
  const events = data.events ?? [];

  let n = 0;
  for (const ev of events) {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c) => c.homeAway === "home");
    const away = comp?.competitors?.find((c) => c.homeAway === "away");
    const homeAbbr = home?.team?.abbreviation;
    const awayAbbr = away?.team?.abbreviation;
    if (!homeAbbr || !awayAbbr || !ev.date) continue;

    const homeTeam = nflTeam(homeAbbr);
    const awayTeam = nflTeam(awayAbbr);
    const row = {
      sport: "FOOTBALL" as const,
      season,
      week,
      homeTeam,
      awayTeam,
      homeTeamId: teamId.get(homeTeam) ?? null,
      awayTeamId: teamId.get(awayTeam) ?? null,
      kickoff: new Date(ev.date),
      status: espnStatus(ev.status?.type),
    };
    await prisma.game.upsert({
      where: { source_sourceId: { source: "espn", sourceId: ev.id } },
      update: row,
      create: { ...row, source: "espn", sourceId: ev.id },
    });
    n++;
  }
  return n;
}

// NBA games for one date from ESPN's free, keyless scoreboard API. Basketball
// has no weekly structure (like MLB), so games are date-based with a null week;
// stats/polls are keyed to the ET calendar date via nbaPeriod. ESPN's NBA team
// abbreviations are our canonical NBA keys, so no fixup is needed. `date` is
// YYYY-MM-DD (ESPN wants YYYYMMDD). Returns the number of games upserted.
export async function importNbaGames(
  season: number,
  date: string,
): Promise<number> {
  const teamId = await teamIdByAbbr("BASKETBALL");
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard` +
    `?dates=${date.replace(/-/g, "")}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN responded ${res.status}`);
  const data = (await res.json()) as { events?: EspnEvent[] };
  const events = data.events ?? [];

  let n = 0;
  for (const ev of events) {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c) => c.homeAway === "home");
    const away = comp?.competitors?.find((c) => c.homeAway === "away");
    const homeTeam = home?.team?.abbreviation;
    const awayTeam = away?.team?.abbreviation;
    if (!homeTeam || !awayTeam || !ev.date) continue;

    const row = {
      sport: "BASKETBALL" as const,
      season,
      week: null,
      homeTeam,
      awayTeam,
      homeTeamId: teamId.get(homeTeam) ?? null,
      awayTeamId: teamId.get(awayTeam) ?? null,
      kickoff: new Date(ev.date),
      status: espnStatus(ev.status?.type),
    };
    await prisma.game.upsert({
      where: { source_sourceId: { source: "espn", sourceId: ev.id } },
      update: row,
      create: { ...row, source: "espn", sourceId: ev.id },
    });
    n++;
  }
  return n;
}

interface MlbGame {
  gamePk: number;
  gameDate: string;
  status?: { abstractGameState?: string; detailedState?: string };
  teams?: {
    home?: { team?: { abbreviation?: string } };
    away?: { team?: { abbreviation?: string } };
  };
}

const mlbStatus = (s?: {
  abstractGameState?: string;
  detailedState?: string;
}): GameStatus => {
  const detail = s?.detailedState ?? "";
  if (detail.includes("Postponed") || detail.includes("Cancelled")) {
    return "POSTPONED";
  }
  if (s?.abstractGameState === "Final") return "FINAL";
  if (s?.abstractGameState === "Live") return "IN_PROGRESS";
  return "SCHEDULED";
};

// MLB games for one date from the MLB Stats API (free, keyless). Returns the
// number of games upserted.
export async function importMlbGames(
  season: number,
  date: string,
): Promise<number> {
  const teamId = await teamIdByAbbr("BASEBALL");
  const url =
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}` +
    `&hydrate=team`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MLB API responded ${res.status}`);
  const data = (await res.json()) as { dates?: { games?: MlbGame[] }[] };
  const games = data.dates?.flatMap((d) => d.games ?? []) ?? [];

  let n = 0;
  for (const g of games) {
    const home = g.teams?.home?.team?.abbreviation;
    const away = g.teams?.away?.team?.abbreviation;
    if (!home || !away || !g.gameDate) continue;

    const row = {
      sport: "BASEBALL" as const,
      season,
      week: null,
      homeTeam: home,
      awayTeam: away,
      homeTeamId: teamId.get(home) ?? null,
      awayTeamId: teamId.get(away) ?? null,
      kickoff: new Date(g.gameDate),
      status: mlbStatus(g.status),
    };
    await prisma.game.upsert({
      where: { source_sourceId: { source: "mlb", sourceId: String(g.gamePk) } },
      update: row,
      create: { ...row, source: "mlb", sourceId: String(g.gamePk) },
    });
    n++;
  }
  return n;
}
