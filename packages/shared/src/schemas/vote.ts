import { z } from "zod";

export const castVoteSchema = z.object({
  pollId: z.string().uuid(),
  optionId: z.string().uuid(),
});
export type CastVoteInput = z.infer<typeof castVoteSchema>;
