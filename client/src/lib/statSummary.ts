import { Sport } from "@leetpix/shared";

// Compact, priority-ordered stat line for a resolved option, e.g.
// "9 rec · 154 yds · 2 TD". The first three present stats win, so a QB reads
// "305 pass yds · 2 pass TD · 1 INT" while a WR reads like the example.
type Fmt = [key: string, label: (v: number) => string];

const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

const FOOTBALL: Fmt[] = [
  ["passingYards", (v) => `${num(v)} pass yds`],
  ["passingTd", (v) => `${num(v)} pass TD`],
  ["interception", (v) => `${num(v)} INT`],
  ["rushingYards", (v) => `${num(v)} rush yds`],
  ["rushingTd", (v) => `${num(v)} rush TD`],
  ["reception", (v) => `${num(v)} rec`],
  ["receivingYards", (v) => `${num(v)} yds`],
  ["receivingTd", (v) => `${num(v)} TD`],
  ["fumbleLost", (v) => `${num(v)} FUM`],
  ["idpTackleSolo", (v) => `${num(v)} tkl`],
  ["idpSack", (v) => `${num(v)} sack`],
  ["dstSack", (v) => `${num(v)} sack`],
  ["dstInt", (v) => `${num(v)} INT`],
];

const BASEBALL: Fmt[] = [
  // Pitching first: an IP line means a pitching performance.
  ["inningsPitched", (v) => `${num(v)} IP`],
  ["strikeoutPitched", (v) => `${num(v)} K`],
  ["earnedRun", (v) => `${num(v)} ER`],
  // Hitting.
  ["homeRun", (v) => `${num(v)} HR`],
  ["rbi", (v) => `${num(v)} RBI`],
  ["run", (v) => `${num(v)} R`],
  ["stolenBase", (v) => `${num(v)} SB`],
  ["double", (v) => `${num(v)} 2B`],
  ["triple", (v) => `${num(v)} 3B`],
  ["single", (v) => `${num(v)} 1B`],
  ["walk", (v) => `${num(v)} BB`],
];

/**
 * Up to three headline stats joined with dots, or null when the line has
 * nothing worth showing.
 */
export function statSummary(
  line: Record<string, number> | undefined,
  sport: Sport,
): string | null {
  if (!line) return null;
  const order = sport === Sport.BASEBALL ? BASEBALL : FOOTBALL;
  const parts: string[] = [];
  for (const [key, fmt] of order) {
    const v = line[key];
    if (v) parts.push(fmt(v));
    if (parts.length === 3) break;
  }
  return parts.length ? parts.join(" · ") : null;
}
