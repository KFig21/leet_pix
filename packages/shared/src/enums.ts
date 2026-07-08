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
};

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
};

/** Whether a poll type produces a correct/incorrect outcome (affects stats). */
export function isScoreablePoll(q: PollQuestionType): boolean {
  return QUESTION_RESOLUTION[q] !== "OPINION";
}

/** Add/drop are scored over a multi-week window (rest are single-game). */
export function isWindowedPoll(q: PollQuestionType): boolean {
  return q === PollQuestionType.ADD || q === PollQuestionType.DROP;
}
