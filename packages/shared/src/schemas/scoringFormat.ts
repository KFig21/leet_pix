import { z } from "zod";
import { Sport } from "../enums";

// A custom scoring format maps a stat category key -> points per unit.
// e.g. { passingYards: 0.04, passingTd: 4, interception: -2, reception: 1 }
export const scoringRulesSchema = z.record(z.string(), z.number());
export type ScoringRules = z.infer<typeof scoringRulesSchema>;

export const createScoringFormatSchema = z.object({
  name: z.string().min(1).max(40),
  sport: z.nativeEnum(Sport),
  rules: scoringRulesSchema,
});
export type CreateScoringFormatInput = z.infer<typeof createScoringFormatSchema>;
