import { Sport } from "@leetpix/shared";

// A readable, position-ordered projection stat line for the breakdown modal, e.g.
// an RB reads "960 Rush Yd, 6 Rush TD, 66 Rec, 402 Rec Yd, 3 Rec TD, 1 Fum lost".
// Season-long (keeper) projections round to whole numbers; single-game keep one
// decimal. Position-relevant stats come first (rushing for RBs, receiving for
// WR/TE, passing for QBs).

type Entry = [key: string, label: string];

const FB_GROUPS: Record<string, Entry[]> = {
  passing: [
    ["passingYards", "Pass Yd"],
    ["passingTd", "Pass TD"],
    ["interception", "INT"],
  ],
  rushing: [
    ["rushingYards", "Rush Yd"],
    ["rushingTd", "Rush TD"],
  ],
  receiving: [
    ["reception", "Rec"],
    ["receivingYards", "Rec Yd"],
    ["receivingTd", "Rec TD"],
  ],
  misc: [["fumbleLost", "Fum lost"]],
  kicking: [
    ["xpMade", "XP"],
    ["fgMade0_39", "FG"],
    ["fgMade40_49", "FG 40-49"],
    ["fgMade50p", "FG 50+"],
    ["fgMiss", "FG miss"],
  ],
  dst: [
    ["dstSack", "Sack"],
    ["dstInt", "INT"],
    ["dstFumRec", "Fum rec"],
    ["dstTd", "TD"],
  ],
  idp: [
    ["idpTackleSolo", "Tkl"],
    ["idpTackleAst", "Ast tkl"],
    ["idpSack", "Sack"],
    ["idpInt", "INT"],
    ["idpTd", "TD"],
  ],
};

// Which stat groups (in order) matter for each position.
const FB_ORDER: Record<string, string[]> = {
  QB: ["passing", "rushing", "misc"],
  RB: ["rushing", "receiving", "misc"],
  FB: ["rushing", "receiving", "misc"],
  WR: ["receiving", "rushing", "misc"],
  TE: ["receiving", "rushing", "misc"],
  K: ["kicking"],
  DEF: ["dst"],
  DST: ["dst"],
};
const FB_IDP_POSITIONS = new Set(["DL", "LB", "DB", "CB", "S", "DE", "DT", "EDGE"]);
const FB_DEFAULT = ["passing", "rushing", "receiving", "misc"];

const BB_GROUPS: Record<string, Entry[]> = {
  pitching: [
    ["inningsPitched", "IP"],
    ["strikeoutPitched", "K"],
    ["win", "W"],
    ["save", "SV"],
    ["earnedRun", "ER"],
  ],
  hitting: [
    ["homeRun", "HR"],
    ["rbi", "RBI"],
    ["run", "R"],
    ["stolenBase", "SB"],
    ["double", "2B"],
    ["triple", "3B"],
    ["single", "1B"],
    ["walk", "BB"],
  ],
};

function orderedGroups(position: string | null, sport: Sport): Entry[] {
  if (sport === Sport.BASEBALL) {
    const pitcher = position === "P" || position === "SP" || position === "RP";
    const groups = pitcher ? ["pitching", "hitting"] : ["hitting", "pitching"];
    return groups.flatMap((g) => BB_GROUPS[g]);
  }
  const pos = position ?? "";
  const order =
    FB_ORDER[pos] ?? (FB_IDP_POSITIONS.has(pos) ? ["idp", "misc"] : FB_DEFAULT);
  return order.flatMap((g) => FB_GROUPS[g]);
}

/**
 * Human-readable projection stat line, or null when nothing rounds to a value
 * worth showing.
 */
export function projectionStatLine(
  statLine: Record<string, number> | undefined,
  position: string | null,
  sport: Sport,
  seasonLong: boolean,
): string | null {
  if (!statLine) return null;
  // Season-long rounds to whole numbers; single-game keeps one decimal. Thousands
  // get a comma so long yardage totals read cleanly (e.g. "3,548 Pass Yd").
  const fmt = (v: number) =>
    (seasonLong ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString("en-US", {
      maximumFractionDigits: 1,
    });

  const parts: string[] = [];
  for (const [key, label] of orderedGroups(position, sport)) {
    const raw = statLine[key];
    if (!raw) continue;
    const v = seasonLong ? Math.round(raw) : Math.round(raw * 10) / 10;
    if (v === 0) continue; // drops sub-rounding noise (e.g. 0.4 INT over a season)
    parts.push(`${fmt(raw)} ${label}`);
  }
  return parts.length ? parts.join(", ") : null;
}
