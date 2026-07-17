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

// Display names for each group's category container.
const GROUP_LABELS: Record<string, string> = {
  passing: "Passing",
  rushing: "Rushing",
  receiving: "Receiving",
  misc: "Misc",
  kicking: "Kicking",
  dst: "Defense",
  idp: "Defense",
  pitching: "Pitching",
  hitting: "Hitting",
};

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

// Ordered [groupKey, entries] pairs for a player's position/sport.
function orderedGroups(position: string | null, sport: Sport): [string, Entry[]][] {
  if (sport === Sport.BASEBALL) {
    const pitcher = position === "P" || position === "SP" || position === "RP";
    const keys = pitcher ? ["pitching", "hitting"] : ["hitting", "pitching"];
    return keys.map((g) => [g, BB_GROUPS[g]]);
  }
  const pos = position ?? "";
  const keys =
    FB_ORDER[pos] ?? (FB_IDP_POSITIONS.has(pos) ? ["idp", "misc"] : FB_DEFAULT);
  return keys.map((g) => [g, FB_GROUPS[g]]);
}

export interface ProjectionStatGroup {
  group: string;
  stats: string;
}

/**
 * The projection stat line split into category groups (Passing, Rushing, …),
 * each a readable comma-joined line. Season-long rounds to whole numbers;
 * single-game keeps one decimal; thousands get a comma. Empty groups are
 * dropped, so an RB has no "Passing" box.
 */
export function projectionStatGroups(
  statLine: Record<string, number> | undefined,
  position: string | null,
  sport: Sport,
  seasonLong: boolean,
): ProjectionStatGroup[] {
  if (!statLine) return [];
  const fmt = (v: number) =>
    (seasonLong ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString("en-US", {
      maximumFractionDigits: 1,
    });

  const out: ProjectionStatGroup[] = [];
  for (const [groupKey, entries] of orderedGroups(position, sport)) {
    const parts: string[] = [];
    for (const [key, label] of entries) {
      const raw = statLine[key];
      if (!raw) continue;
      const v = seasonLong ? Math.round(raw) : Math.round(raw * 10) / 10;
      if (v === 0) continue; // drops sub-rounding noise (e.g. 0.4 INT over a season)
      parts.push(`${fmt(raw)} ${label}`);
    }
    if (parts.length) {
      out.push({ group: GROUP_LABELS[groupKey] ?? groupKey, stats: parts.join(", ") });
    }
  }
  return out;
}
