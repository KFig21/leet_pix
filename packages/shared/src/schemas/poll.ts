import { z } from "zod";
import {
  Sport,
  PollLockType,
  PollHorizon,
  ScoringPreset,
  PollQuestionType,
  isWindowedPoll,
  isQuestionForHorizon,
} from "../enums";
import { MIN_POLL_OPTIONS, MAX_POLL_OPTIONS } from "../constants";

// A single poll option references a real player (resolved against stats source).
export const pollOptionInputSchema = z.object({
  playerId: z.string().min(1),
  playerName: z.string().min(1).max(60),
  // Keeper polls: the draft round forfeited to keep this player. Optional; only
  // meaningful for KEEP questions (ignored otherwise).
  keeperRound: z.number().int().min(1).max(30).optional(),
});
export type PollOptionInput = z.infer<typeof pollOptionInputSchema>;

export const createPollSchema = z
  .object({
    sport: z.nativeEnum(Sport),
    // Framing/league context (daily / season / dynasty).
    horizon: z.nativeEnum(PollHorizon),
    // Preset prompt (no free text). Display label from POLL_QUESTION_LABELS.
    questionType: z.nativeEnum(PollQuestionType),
    options: z
      .array(pollOptionInputSchema)
      .min(MIN_POLL_OPTIONS)
      .max(MAX_POLL_OPTIONS),
    lockType: z.nativeEnum(PollLockType),
    // Required when lockType === FIXED_TIME.
    lockAt: z.string().datetime().optional(),
    // Either a built-in preset or a saved custom format id (exactly one).
    scoringPreset: z.nativeEnum(ScoringPreset).optional(),
    scoringFormatId: z.string().uuid().optional(),
    // Weeks the outcome is tallied over (add/drop only).
    evaluationWeeks: z.number().int().min(1).max(18).optional(),
  })
  .refine((d) => d.lockType !== PollLockType.FIXED_TIME || !!d.lockAt, {
    message: "lockAt is required for fixed-time polls",
    path: ["lockAt"],
  })
  .refine((d) => !!d.scoringPreset !== !!d.scoringFormatId, {
    message: "Provide exactly one of scoringPreset or scoringFormatId",
    path: ["scoringPreset"],
  })
  .refine((d) => !isWindowedPoll(d.questionType) || d.evaluationWeeks != null, {
    message: "Add/drop polls need an evaluation window (weeks)",
    path: ["evaluationWeeks"],
  })
  .refine((d) => isQuestionForHorizon(d.horizon, d.questionType), {
    message: "This question isn't available for the selected horizon",
    path: ["questionType"],
  });
export type CreatePollInput = z.infer<typeof createPollSchema>;
