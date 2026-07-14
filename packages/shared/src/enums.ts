// Domain enums shared across client + server. Keep in sync with prisma/schema.prisma.

export const Sport = {
  FOOTBALL: "FOOTBALL",
  BASEBALL: "BASEBALL",
} as const;
export type Sport = (typeof Sport)[keyof typeof Sport];

export const PollStatus = {
  OPEN: "OPEN",
  LOCKED: "LOCKED",
  RESOLVED: "RESOLVED",
} as const;
export type PollStatus = (typeof PollStatus)[keyof typeof PollStatus];

export const PollLockType = {
  // Locks at an explicit timestamp set by the author.
  FIXED_TIME: "FIXED_TIME",
  // Locks 5 minutes before the earliest game involving a referenced player.
  GAME_START: "GAME_START",
} as const;
export type PollLockType = (typeof PollLockType)[keyof typeof PollLockType];

// Built-in scoring presets. Custom user formats live in the ScoringFormat table.
export const ScoringPreset = {
  FOOTBALL_STANDARD: "FOOTBALL_STANDARD",
  FOOTBALL_HALF_PPR: "FOOTBALL_HALF_PPR",
  FOOTBALL_PPR: "FOOTBALL_PPR",
  BASEBALL_STANDARD: "BASEBALL_STANDARD",
} as const;
export type ScoringPreset = (typeof ScoringPreset)[keyof typeof ScoringPreset];

// Preset poll prompts. Users pick one instead of typing free text (keeps the
// platform low-moderation and structured). Keep in sync with prisma schema.
export const PollQuestionType = {
  START: "START",
  BENCH: "BENCH",
  ADD: "ADD",
  DROP: "DROP",
  TRADE_FOR: "TRADE_FOR",
  TRADE_AWAY: "TRADE_AWAY",
  BUY_LOW: "BUY_LOW",
  KEEP: "KEEP",
} as const;
export type PollQuestionType =
  (typeof PollQuestionType)[keyof typeof PollQuestionType];

// Human-readable prompt shown on the poll for each type.
export const POLL_QUESTION_LABELS: Record<PollQuestionType, string> = {
  START: "Who should I start?",
  BENCH: "Who should I bench?",
  ADD: "Who should I add?",
  DROP: "Who should I drop?",
  TRADE_FOR: "Who should I target in a trade?",
  TRADE_AWAY: "Who should I trade away?",
  BUY_LOW: "Who's a good buy-low?",
  KEEP: "Who should I keep?",
};

// The time horizon / league context a poll is framed in. Orthogonal to the
// question type — it gates which questions the creator offers and shows as a
// badge. Keep in sync with prisma schema (PollHorizon).
export const PollHorizon = {
  DAILY: "DAILY",
  SEASON: "SEASON",
  DYNASTY: "DYNASTY",
} as const;
export type PollHorizon = (typeof PollHorizon)[keyof typeof PollHorizon];

export const POLL_HORIZON_LABELS: Record<PollHorizon, string> = {
  DAILY: "Daily",
  SEASON: "Season",
  DYNASTY: "Dynasty",
};

// One-line description of each horizon (creator helper text / tooltips).
export const POLL_HORIZON_HINTS: Record<PollHorizon, string> = {
  DAILY: "One slate — who scores more this game (DFS-style).",
  SEASON: "Rest-of-season — lineup, waivers, and trades.",
  DYNASTY: "Multi-year value — keepers and long-term trades.",
};

// Which question types each horizon offers. A question can appear in more than
// one horizon (a start/bench call fits both daily and season). The first entry
// is the horizon's default question in the creator.
export const HORIZON_QUESTIONS: Record<PollHorizon, PollQuestionType[]> = {
  // DFS has no bench — you just set a lineup, so daily is a "who to play" call.
  DAILY: [PollQuestionType.START],
  SEASON: [
    PollQuestionType.START,
    PollQuestionType.BENCH,
    PollQuestionType.ADD,
    PollQuestionType.DROP,
    PollQuestionType.TRADE_FOR,
    PollQuestionType.TRADE_AWAY,
    // Single-season keeper leagues keep a player from last year (forfeiting the
    // draft round they were taken in); a complete redraft follows.
    PollQuestionType.KEEP,
  ],
  DYNASTY: [
    PollQuestionType.KEEP,
    PollQuestionType.BUY_LOW,
    PollQuestionType.TRADE_FOR,
    PollQuestionType.TRADE_AWAY,
  ],
};

/** Whether a question type is valid for a given horizon. */
export function isQuestionForHorizon(
  horizon: PollHorizon,
  q: PollQuestionType,
): boolean {
  return HORIZON_QUESTIONS[horizon].includes(q);
}

// How a poll is graded once it locks:
//  HIGH    → correct answer is the option that scores the MOST points
//  LOW     → correct answer is the option that scores the FEWEST points
//  OPINION → subjective; never graded (shows consensus only, no PollResults)
export const PollResolutionMode = {
  HIGH: "HIGH",
  LOW: "LOW",
  OPINION: "OPINION",
} as const;
export type PollResolutionMode =
  (typeof PollResolutionMode)[keyof typeof PollResolutionMode];

export const QUESTION_RESOLUTION: Record<
  PollQuestionType,
  PollResolutionMode
> = {
  START: "HIGH",
  ADD: "HIGH",
  BENCH: "LOW",
  DROP: "LOW",
  TRADE_FOR: "OPINION",
  TRADE_AWAY: "OPINION",
  BUY_LOW: "OPINION",
  KEEP: "OPINION",
};

/** Whether a poll type produces a correct/incorrect outcome (affects stats). */
export function isScoreablePoll(q: PollQuestionType): boolean {
  return QUESTION_RESOLUTION[q] !== "OPINION";
}

/** Add/drop are scored over a multi-week window (rest are single-game). */
export function isWindowedPoll(q: PollQuestionType): boolean {
  return q === PollQuestionType.ADD || q === PollQuestionType.DROP;
}
