// Current NFL season/week from Sleeper (cached 1h). Used to tag new polls with
// the week they'll be graded against. Returns null off-season / on failure.
let cache: { season: number; week: number; at: number } | null = null;

export async function getNflState(): Promise<{ season: number; week: number } | null> {
  if (cache && Date.now() - cache.at < 3_600_000) return cache;
  try {
    const res = await fetch("https://api.sleeper.app/v1/state/nfl");
    if (!res.ok) return null;
    const s = (await res.json()) as { season?: string; week?: number };
    if (!s.season) return null;
    cache = { season: Number(s.season), week: Number(s.week) || 1, at: Date.now() };
    return cache;
  } catch {
    return null;
  }
}
