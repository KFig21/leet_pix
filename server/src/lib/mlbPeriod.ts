// Baseball has no weekly structure, so we reuse the (season, week) resolution
// engine by keying baseball stats and polls to the game's calendar date in US
// Eastern (MLB's reference), encoded as YYYYMMDD in the `week` slot.
export function mlbPeriod(kickoff: Date): { season: number; week: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(kickoff);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return { season: Number(y), week: Number(`${y}${m}${d}`) };
}
