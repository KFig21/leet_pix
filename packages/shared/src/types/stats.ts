// Read-model shapes returned by the stats API. These are computed server-side
// from resolved PollResults — not user input — so they're plain types, not Zod.

export type StatWindow = "day" | "week" | "month" | "year" | "lifetime";

export interface AccuracyStats {
  window: StatWindow;
  totalVotes: number;
  correct: number;
  incorrect: number;
  accuracy: number; // 0..1
  // Risk-adjusted score: rewards correct picks on low-consensus options.
  score: number;
}

export interface StreakInfo {
  current: number; // positive = hot (correct), negative = cold (incorrect)
  isHot: boolean;
  isCold: boolean;
  longestWin: number;
}

// A single graded pick within a day, for the heat-map day drill-down.
export interface HeatmapPick {
  pollId: string;
  question: string; // compact verb, e.g. "Start"
  player: string; // the player this user picked
  correct: boolean;
}

// One cell of the GitHub-style participation heat map.
export interface HeatmapCell {
  date: string; // YYYY-MM-DD
  votes: number;
  correct: number;
  // Net hot/cold tint for the day: -1..1
  intensity: number;
  // The day's graded picks (newest first), shown when a cell is clicked.
  picks: HeatmapPick[];
}

export interface ProfileStatsResponse {
  accuracyByWindow: Record<StatWindow, AccuracyStats>;
  streak: StreakInfo;
  heatmap: HeatmapCell[];
}
