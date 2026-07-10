import { prisma } from "./prisma";

interface OptionLike {
  playerId: string;
}
interface PollLike {
  status: string;
  season: number | null;
  week: number | null;
  evaluationWeeks: number | null;
  options: OptionLike[];
}

// Attaches a merged ACTUAL stat line to each option of RESOLVED polls so the
// client can render a scoring breakdown. One batched query for the whole list.
export async function attachStatLines<T extends PollLike>(
  polls: T[],
): Promise<T[]> {
  const resolved = polls.filter(
    (p) => p.status === "RESOLVED" && p.season != null && p.week != null,
  );
  if (resolved.length === 0) return polls;

  const pollWeeks = (p: PollLike) =>
    p.evaluationWeeks
      ? Array.from({ length: p.evaluationWeeks }, (_, i) => p.week! + i)
      : [p.week!];

  const seasons = new Set<number>();
  const weeks = new Set<number>();
  const playerIds = new Set<string>();
  for (const p of resolved) {
    seasons.add(p.season!);
    pollWeeks(p).forEach((w) => weeks.add(w));
    p.options.forEach((o) => playerIds.add(o.playerId));
  }

  const lines = await prisma.playerStat.findMany({
    where: {
      kind: "ACTUAL",
      season: { in: [...seasons] },
      week: { in: [...weeks] },
      playerId: { in: [...playerIds] },
    },
    select: { playerId: true, season: true, week: true, stats: true },
  });

  const idx = new Map<string, Record<string, number>>();
  for (const l of lines) {
    idx.set(`${l.playerId}|${l.season}|${l.week}`, l.stats as Record<string, number>);
  }

  for (const p of resolved) {
    const ws = pollWeeks(p);
    for (const o of p.options) {
      const merged: Record<string, number> = {};
      for (const w of ws) {
        const s = idx.get(`${o.playerId}|${p.season}|${w}`);
        if (s) for (const [k, v] of Object.entries(s)) merged[k] = (merged[k] ?? 0) + v;
      }
      (o as OptionLike & { statLine?: Record<string, number> }).statLine = merged;
    }
  }
  return polls;
}
