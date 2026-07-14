import { z } from "zod";
import { Sport, ScoringPreset } from "../enums";

// A league bundles team count + starting lineup + scoring. Football-only for now
// (positional scarcity is the football use case); scoring is exactly one of a
// preset or a saved custom format, mirroring a poll.
export const lineupSlotsSchema = z.object({
  QB: z.number().int().min(0).max(5),
  RB: z.number().int().min(0).max(10),
  WR: z.number().int().min(0).max(10),
  TE: z.number().int().min(0).max(5),
  FLEX: z.number().int().min(0).max(5),
  SUPERFLEX: z.number().int().min(0).max(3),
  K: z.number().int().min(0).max(3),
  DST: z.number().int().min(0).max(3),
  IDP: z.number().int().min(0).max(10),
  BENCH: z.number().int().min(0).max(20),
});
export type LineupSlotsInput = z.infer<typeof lineupSlotsSchema>;

export const createLeagueSchema = z
  .object({
    name: z.string().min(1).max(40),
    sport: z.literal(Sport.FOOTBALL),
    numTeams: z.number().int().min(2).max(32),
    lineup: lineupSlotsSchema,
    scoringPreset: z.nativeEnum(ScoringPreset).optional(),
    scoringFormatId: z.string().uuid().optional(),
  })
  .refine((d) => !!d.scoringPreset !== !!d.scoringFormatId, {
    message: "Provide exactly one of scoringPreset or scoringFormatId",
    path: ["scoringPreset"],
  })
  // Need at least one starter to be a meaningful league.
  .refine(
    (d) =>
      d.lineup.QB +
        d.lineup.RB +
        d.lineup.WR +
        d.lineup.TE +
        d.lineup.FLEX +
        d.lineup.SUPERFLEX +
        d.lineup.K +
        d.lineup.DST +
        d.lineup.IDP >
      0,
    { message: "Set at least one starting spot", path: ["lineup"] },
  );
export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;
