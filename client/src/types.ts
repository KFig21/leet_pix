// Client view-models for API responses. These mirror the server's Prisma
// includes; keep loose since the API shape is the source of truth.
import type {
  Avatar,
  Sport,
  PollStatus,
  PollQuestionType,
  ScoringPreset,
} from "@leetpix/shared";

export interface ScoringFormatSummary {
  id: string;
  name: string;
  rules: Record<string, number>;
}

export interface ProfileSummary {
  id: string;
  username: string;
  displayName: string;
  avatar: Avatar;
}

// A player's game this week (football), attached to poll options + search results.
export interface PlayerGame {
  opponent: string;
  atHome: boolean;
  kickoff: string;
  status?: string;
}

export interface PollOptionView {
  id: string;
  playerName: string;
  projectedPoints: number | null;
  actualPoints: number | null;
  isWinner: boolean;
  // Merged actual stat line (resolved polls, detail view only) — for the breakdown.
  statLine?: Record<string, number>;
  // Player meta + upcoming game (attached server-side).
  player?: {
    team: string | null;
    position: string | null;
    injuryStatus: string | null;
  } | null;
  game?: PlayerGame | null;
  _count?: { votes: number };
}

export interface PollView {
  id: string;
  sport: Sport;
  questionType: PollQuestionType;
  status: PollStatus;
  lockAt: string | null;
  createdAt: string;
  author: ProfileSummary;
  options: PollOptionView[];
  // The viewer's own vote on this poll, if any (set by authed feeds).
  myVoteOptionId?: string | null;
  // Scoring: exactly one of these is set.
  scoringPreset: ScoringPreset | null;
  scoringFormat: ScoringFormatSummary | null;
  // Weeks the outcome is tallied over (add/drop); null otherwise.
  evaluationWeeks: number | null;
}

// Detailed poll (in-depth view) also carries each option's voters.
export interface PollDetailOption extends PollOptionView {
  votes: { id: string; voter: ProfileSummary }[];
}
export interface PollDetail extends Omit<PollView, "options"> {
  options: PollDetailOption[];
}

// A user's vote ("pick") joined with the poll and the option they chose.
export interface PickView {
  id: string;
  createdAt: string;
  option: { id: string; playerName: string };
  poll: PollView;
}

// ── Notifications ──────────────────────────────────────────
interface NotificationBase {
  id: string;
  read: boolean;
  createdAt: string;
}
export interface FollowNotification extends NotificationBase {
  kind: "follow";
  actor: ProfileSummary;
  // Whether the viewer already follows the actor back.
  youFollow: boolean;
}
export interface VoteNotification extends NotificationBase {
  kind: "vote";
  poll: { id: string; questionType: PollQuestionType };
  actors: ProfileSummary[];
  count: number;
}
export interface OutcomeNotification extends NotificationBase {
  kind: "outcome";
  poll: { id: string; questionType: PollQuestionType };
  // True when the viewer authored the poll; otherwise they voted on it.
  isAuthor: boolean;
  // For voters: whether their pick was correct (null if not scored/available).
  correct: boolean | null;
}
export type NotificationItem =
  | FollowNotification
  | VoteNotification
  | OutcomeNotification;
