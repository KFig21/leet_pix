import { Sport } from "./enums";

// ── Hot / cold streaks ───────────────────────────────────────────────────────
// A player's recent form relative to their own baseline. We score each recent
// game under the sport's reference preset, then compare the average of the most
// recent games to the average of the games just before them. Because it's
// self-relative, the comparison is position-agnostic (a QB and a WR are each
// judged against themselves, not each other).

export type PlayerStreakStatus = "hot" | "cold";

export interface PlayerStreak {
  status: PlayerStreakStatus;
  // Reference-preset points: average of the recent window vs the prior window.
  recentAvg: number;
  baselineAvg: number;
  // Total scored games considered (recent + baseline).
  games: number;
}

// The most recent games form the "recent" window; the games before them (up to
// the same count) form the baseline. Need at least MIN_GAMES total to judge.
export const STREAK_RECENT_GAMES = 3;
export const STREAK_MIN_GAMES = 4;

// Recent form must beat/trail the baseline by BOTH a ratio and an absolute
// margin, so tiny numbers (a deep-bench player) don't flip on noise.
const HOT_RATIO = 1.25;
const COLD_RATIO = 0.75;
const MIN_MARGIN: Record<Sport, number> = {
  [Sport.FOOTBALL]: 4,
  [Sport.BASEBALL]: 3,
};

// Absolute production gates, so a streak reflects real form and not just noisy
// movement around a player's own baseline:
//   • HOT_FLOOR   — recent avg must clear this to count as hot, so a bench guy
//     bumping from ~0 to a couple points isn't "hot".
//   • COLD_CEILING — recent avg must sit at/below this to count as cold, so a
//     still-productive player who merely cooled off a hot streak (e.g. a hitter
//     averaging ~6 pts) isn't wrongly tagged "cold".
// Reference-preset scale: football is HALF_PPR offense; baseball is Standard,
// where a single=1, HR=4, RBI=1, walk=1 — a genuine hitter slump lands ≤3/gm.
const HOT_FLOOR: Record<Sport, number> = {
  [Sport.FOOTBALL]: 8,
  [Sport.BASEBALL]: 5,
};
const COLD_CEILING: Record<Sport, number> = {
  [Sport.FOOTBALL]: 6,
  [Sport.BASEBALL]: 3,
};

/**
 * Classify recent form vs baseline into a hot/cold streak, or null if neither.
 * `recentAvg`/`baselineAvg` are average reference-preset points per game.
 */
export function classifyStreak(
  sport: Sport,
  recentAvg: number,
  baselineAvg: number,
  games: number,
): PlayerStreakStatus | null {
  if (games < STREAK_MIN_GAMES) return null;
  const margin = MIN_MARGIN[sport];
  if (
    recentAvg >= HOT_FLOOR[sport] &&
    recentAvg >= baselineAvg * HOT_RATIO &&
    recentAvg - baselineAvg >= margin
  ) {
    return "hot";
  }
  if (
    recentAvg <= COLD_CEILING[sport] &&
    recentAvg <= baselineAvg * COLD_RATIO &&
    baselineAvg - recentAvg >= margin
  ) {
    return "cold";
  }
  return null;
}

export function streakLabel(status: PlayerStreakStatus): string {
  return status === "hot" ? "Hot" : "Cold";
}

export function streakEmoji(status: PlayerStreakStatus): string {
  return status === "hot" ? "🔥" : "🧊";
}
