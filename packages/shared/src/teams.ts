import { Sport } from "./enums";

// Canonical team registry — the single source of truth for team identity and
// branding, used to seed the DB `Team` table and to color team tags client-side.
//
// `abbreviation` is our canonical key (Sleeper's for NFL, MLB Stats API's for
// MLB, ESPN's for NBA — i.e. what player/game feeds give us). `espnAbbr` records
// ESPN's variant where it differs, so the schedule importer can reconcile it.
// (NBA is sourced entirely from ESPN, so its abbreviation already equals ESPN's.)

export type League = "NFL" | "MLB" | "NBA";

export interface Team {
  abbreviation: string;
  sport: Sport;
  league: League;
  location: string;
  name: string;
  primaryColor: string;
  // ESPN's abbreviation when it differs from ours (NFL schedule reconciliation).
  espnAbbr?: string;
}

/** Full display name, e.g. "Kansas City Chiefs" (or just "Athletics"). */
export const teamFullName = (t: Team): string =>
  `${t.location} ${t.name}`.trim();

const NFL: Omit<Team, "sport" | "league">[] = [
  { abbreviation: "ARI", location: "Arizona", name: "Cardinals", primaryColor: "#97233F" },
  { abbreviation: "ATL", location: "Atlanta", name: "Falcons", primaryColor: "#A71930" },
  { abbreviation: "BAL", location: "Baltimore", name: "Ravens", primaryColor: "#241773" },
  { abbreviation: "BUF", location: "Buffalo", name: "Bills", primaryColor: "#00338D" },
  { abbreviation: "CAR", location: "Carolina", name: "Panthers", primaryColor: "#0085CA" },
  { abbreviation: "CHI", location: "Chicago", name: "Bears", primaryColor: "#0B162A" },
  { abbreviation: "CIN", location: "Cincinnati", name: "Bengals", primaryColor: "#FB4F14" },
  { abbreviation: "CLE", location: "Cleveland", name: "Browns", primaryColor: "#311D00" },
  { abbreviation: "DAL", location: "Dallas", name: "Cowboys", primaryColor: "#003594" },
  { abbreviation: "DEN", location: "Denver", name: "Broncos", primaryColor: "#FB4F14" },
  { abbreviation: "DET", location: "Detroit", name: "Lions", primaryColor: "#0076B6" },
  { abbreviation: "GB", location: "Green Bay", name: "Packers", primaryColor: "#203731" },
  { abbreviation: "HOU", location: "Houston", name: "Texans", primaryColor: "#03202F" },
  { abbreviation: "IND", location: "Indianapolis", name: "Colts", primaryColor: "#002C5F" },
  { abbreviation: "JAX", location: "Jacksonville", name: "Jaguars", primaryColor: "#006778" },
  { abbreviation: "KC", location: "Kansas City", name: "Chiefs", primaryColor: "#E31837" },
  { abbreviation: "LAC", location: "Los Angeles", name: "Chargers", primaryColor: "#0080C6" },
  { abbreviation: "LAR", location: "Los Angeles", name: "Rams", primaryColor: "#003594" },
  { abbreviation: "LV", location: "Las Vegas", name: "Raiders", primaryColor: "#000000" },
  { abbreviation: "MIA", location: "Miami", name: "Dolphins", primaryColor: "#008E97" },
  { abbreviation: "MIN", location: "Minnesota", name: "Vikings", primaryColor: "#4F2683" },
  { abbreviation: "NE", location: "New England", name: "Patriots", primaryColor: "#002244" },
  { abbreviation: "NO", location: "New Orleans", name: "Saints", primaryColor: "#D3BC8D" },
  { abbreviation: "NYG", location: "New York", name: "Giants", primaryColor: "#0B2265" },
  { abbreviation: "NYJ", location: "New York", name: "Jets", primaryColor: "#125740" },
  { abbreviation: "PHI", location: "Philadelphia", name: "Eagles", primaryColor: "#004C54" },
  { abbreviation: "PIT", location: "Pittsburgh", name: "Steelers", primaryColor: "#FFB612" },
  { abbreviation: "SEA", location: "Seattle", name: "Seahawks", primaryColor: "#002244" },
  { abbreviation: "SF", location: "San Francisco", name: "49ers", primaryColor: "#AA0000" },
  { abbreviation: "TB", location: "Tampa Bay", name: "Buccaneers", primaryColor: "#D50A0A" },
  { abbreviation: "TEN", location: "Tennessee", name: "Titans", primaryColor: "#0C2340" },
  { abbreviation: "WAS", location: "Washington", name: "Commanders", primaryColor: "#5A1414", espnAbbr: "WSH" },
];

const MLB: Omit<Team, "sport" | "league">[] = [
  { abbreviation: "ATH", location: "", name: "Athletics", primaryColor: "#003831" },
  { abbreviation: "ATL", location: "Atlanta", name: "Braves", primaryColor: "#CE1141" },
  { abbreviation: "AZ", location: "Arizona", name: "Diamondbacks", primaryColor: "#A71930" },
  { abbreviation: "BAL", location: "Baltimore", name: "Orioles", primaryColor: "#DF4601" },
  { abbreviation: "BOS", location: "Boston", name: "Red Sox", primaryColor: "#BD3039" },
  { abbreviation: "CHC", location: "Chicago", name: "Cubs", primaryColor: "#0E3386" },
  { abbreviation: "CIN", location: "Cincinnati", name: "Reds", primaryColor: "#C6011F" },
  { abbreviation: "CLE", location: "Cleveland", name: "Guardians", primaryColor: "#00385D" },
  { abbreviation: "COL", location: "Colorado", name: "Rockies", primaryColor: "#333366" },
  { abbreviation: "CWS", location: "Chicago", name: "White Sox", primaryColor: "#27251F" },
  { abbreviation: "DET", location: "Detroit", name: "Tigers", primaryColor: "#0C2340" },
  { abbreviation: "HOU", location: "Houston", name: "Astros", primaryColor: "#EB6E1F" },
  { abbreviation: "KC", location: "Kansas City", name: "Royals", primaryColor: "#004687" },
  { abbreviation: "LAA", location: "Los Angeles", name: "Angels", primaryColor: "#BA0021" },
  { abbreviation: "LAD", location: "Los Angeles", name: "Dodgers", primaryColor: "#005A9C" },
  { abbreviation: "MIA", location: "Miami", name: "Marlins", primaryColor: "#00A3E0" },
  { abbreviation: "MIL", location: "Milwaukee", name: "Brewers", primaryColor: "#12284B" },
  { abbreviation: "MIN", location: "Minnesota", name: "Twins", primaryColor: "#002B5C" },
  { abbreviation: "NYM", location: "New York", name: "Mets", primaryColor: "#002D72" },
  { abbreviation: "NYY", location: "New York", name: "Yankees", primaryColor: "#0C2340" },
  { abbreviation: "PHI", location: "Philadelphia", name: "Phillies", primaryColor: "#E81828" },
  { abbreviation: "PIT", location: "Pittsburgh", name: "Pirates", primaryColor: "#FDB827" },
  { abbreviation: "SD", location: "San Diego", name: "Padres", primaryColor: "#2F241D" },
  { abbreviation: "SEA", location: "Seattle", name: "Mariners", primaryColor: "#0C2C56" },
  { abbreviation: "SF", location: "San Francisco", name: "Giants", primaryColor: "#FD5A1E" },
  { abbreviation: "STL", location: "St. Louis", name: "Cardinals", primaryColor: "#C41E3A" },
  { abbreviation: "TB", location: "Tampa Bay", name: "Rays", primaryColor: "#092C5C" },
  { abbreviation: "TEX", location: "Texas", name: "Rangers", primaryColor: "#003278" },
  { abbreviation: "TOR", location: "Toronto", name: "Blue Jays", primaryColor: "#134A8E" },
  { abbreviation: "WSH", location: "Washington", name: "Nationals", primaryColor: "#AB0003" },
];

// NBA — abbreviation/location/name/color all taken from ESPN's teams endpoint
// (our sole NBA data source), so our canonical abbreviation already matches
// ESPN's and no espnAbbr reconciliation is needed.
const NBA: Omit<Team, "sport" | "league">[] = [
  { abbreviation: "ATL", location: "Atlanta", name: "Hawks", primaryColor: "#C8102E" },
  { abbreviation: "BKN", location: "Brooklyn", name: "Nets", primaryColor: "#000000" },
  { abbreviation: "BOS", location: "Boston", name: "Celtics", primaryColor: "#008348" },
  { abbreviation: "CHA", location: "Charlotte", name: "Hornets", primaryColor: "#1D1160" },
  { abbreviation: "CHI", location: "Chicago", name: "Bulls", primaryColor: "#CE1141" },
  { abbreviation: "CLE", location: "Cleveland", name: "Cavaliers", primaryColor: "#860038" },
  { abbreviation: "DAL", location: "Dallas", name: "Mavericks", primaryColor: "#0064B1" },
  { abbreviation: "DEN", location: "Denver", name: "Nuggets", primaryColor: "#0E2240" },
  { abbreviation: "DET", location: "Detroit", name: "Pistons", primaryColor: "#1D428A" },
  { abbreviation: "GS", location: "Golden State", name: "Warriors", primaryColor: "#1D428A" },
  { abbreviation: "HOU", location: "Houston", name: "Rockets", primaryColor: "#CE1141" },
  { abbreviation: "IND", location: "Indiana", name: "Pacers", primaryColor: "#002D62" },
  { abbreviation: "LAC", location: "LA", name: "Clippers", primaryColor: "#C8102E" },
  { abbreviation: "LAL", location: "Los Angeles", name: "Lakers", primaryColor: "#552583" },
  { abbreviation: "MEM", location: "Memphis", name: "Grizzlies", primaryColor: "#5D76A9" },
  { abbreviation: "MIA", location: "Miami", name: "Heat", primaryColor: "#98002E" },
  { abbreviation: "MIL", location: "Milwaukee", name: "Bucks", primaryColor: "#00471B" },
  { abbreviation: "MIN", location: "Minnesota", name: "Timberwolves", primaryColor: "#0C2340" },
  { abbreviation: "NO", location: "New Orleans", name: "Pelicans", primaryColor: "#0C2340" },
  { abbreviation: "NY", location: "New York", name: "Knicks", primaryColor: "#006BB6" },
  { abbreviation: "OKC", location: "Oklahoma City", name: "Thunder", primaryColor: "#007AC1" },
  { abbreviation: "ORL", location: "Orlando", name: "Magic", primaryColor: "#0077C0" },
  { abbreviation: "PHI", location: "Philadelphia", name: "76ers", primaryColor: "#006BB6" },
  { abbreviation: "PHX", location: "Phoenix", name: "Suns", primaryColor: "#1D1160" },
  { abbreviation: "POR", location: "Portland", name: "Trail Blazers", primaryColor: "#E03A3E" },
  { abbreviation: "SA", location: "San Antonio", name: "Spurs", primaryColor: "#000000" },
  { abbreviation: "SAC", location: "Sacramento", name: "Kings", primaryColor: "#5A2D81" },
  { abbreviation: "TOR", location: "Toronto", name: "Raptors", primaryColor: "#CE1141" },
  { abbreviation: "UTAH", location: "Utah", name: "Jazz", primaryColor: "#002B5C" },
  { abbreviation: "WSH", location: "Washington", name: "Wizards", primaryColor: "#002B5C" },
];

export const TEAMS: Team[] = [
  ...NFL.map((t) => ({ ...t, sport: Sport.FOOTBALL, league: "NFL" as const })),
  ...MLB.map((t) => ({ ...t, sport: Sport.BASEBALL, league: "MLB" as const })),
  ...NBA.map((t) => ({ ...t, sport: Sport.BASKETBALL, league: "NBA" as const })),
];

// Lookups keyed by "SPORT|ABBR" (abbreviations collide across sports, e.g. ATL).
const byKey = new Map(TEAMS.map((t) => [`${t.sport}|${t.abbreviation}`, t]));
const byEspn = new Map(
  TEAMS.filter((t) => t.espnAbbr).map((t) => [t.espnAbbr!, t]),
);

export const teamByAbbr = (sport: Sport, abbr: string): Team | undefined =>
  byKey.get(`${sport}|${abbr}`);

// Resolve an ESPN abbreviation to our canonical NFL team (falls back to a direct
// match when ESPN's abbreviation already equals ours).
export const teamByEspnAbbr = (abbr: string): Team | undefined =>
  byEspn.get(abbr) ?? teamByAbbr(Sport.FOOTBALL, abbr);

export interface TeamColor {
  bg: string;
  fg: string;
}

// Readable text color for a hex background (perceived luminance).
function readableText(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
}

// Brand colors for a team abbreviation. Pass `sport` to disambiguate shared
// abbreviations (ATL, CHC…); without it, football wins, then baseball.
export function teamColor(abbr?: string | null, sport?: Sport): TeamColor | null {
  if (!abbr) return null;
  const team = sport
    ? teamByAbbr(sport, abbr)
    : teamByAbbr(Sport.FOOTBALL, abbr) ?? teamByAbbr(Sport.BASEBALL, abbr);
  if (!team) return null;
  return { bg: team.primaryColor, fg: readableText(team.primaryColor) };
}
