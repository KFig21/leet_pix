// Anti-spam / interaction rules (see spec).

/** Minimum time between a user's polls, in milliseconds (4 hours). */
export const POLL_COOLDOWN_MS = 4 * 60 * 60 * 1000;

/** Votes required on *other* users' polls to bypass the cooldown. */
export const VOTES_TO_BYPASS_COOLDOWN = 5;

/** A poll referencing a player with a game today locks this long before kickoff. */
export const GAME_LOCK_LEAD_MS = 5 * 60 * 1000;

/** Min/max selectable options per poll. */
export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 4;

/** Hot/cold streak thresholds (consecutive correct/incorrect resolved votes). */
export const HOT_STREAK_THRESHOLD = 3;
export const COLD_STREAK_THRESHOLD = 3;
