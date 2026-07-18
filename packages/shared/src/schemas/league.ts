import { z } from "zod";
import { Sport, ScoringPreset } from "../enums";
import { SPORT_PRESETS } from "../scoring";
import {
  ALL_LINEUP_SLOTS,
  LINEUP_SLOT_MAX,
  slotsForSport,
  startingSpots,
  type LineupSlot,
} from "../lineup";

// A league bundles team count + starting lineup + scoring. Slots differ by sport
// (football skill positions vs. baseball field positions); scoring is exactly
// one of a preset or a saved custom format, mirroring a poll.

// Every possible slot is an optional, capped count; a given league only carries
// its own sport's slots (validated below).
const slotShape = Object.fromEntries(
  ALL_LINEUP_SLOTS.map((s) => [
    s,
    z.number().int().min(0).max(LINEUP_SLOT_MAX[s]).optional(),
  ]),
) as Record<LineupSlot, z.ZodOptional<z.ZodNumber>>;

export const lineupSlotsSchema = z.object(slotShape);
export type LineupSlotsInput = z.infer<typeof lineupSlotsSchema>;

export const createLeagueSchema = z
  .object({
    name: z.string().min(1).max(40),
    sport: z.nativeEnum(Sport),
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
  .refine((d) => startingSpots(d.lineup) > 0, {
    message: "Set at least one starting spot",
    path: ["lineup"],
  })
  // Reject slots that don't belong to the chosen sport, and a preset from the
  // wrong sport — so a baseball league can't carry football slots/scoring.
  .superRefine((d, ctx) => {
    const allowed = new Set(slotsForSport(d.sport));
    for (const [slot, count] of Object.entries(d.lineup)) {
      if ((count ?? 0) > 0 && !allowed.has(slot as LineupSlot)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${slot} is not a ${d.sport.toLowerCase()} slot`,
          path: ["lineup", slot],
        });
      }
    }
    if (d.scoringPreset && !SPORT_PRESETS[d.sport].includes(d.scoringPreset)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${d.scoringPreset} is not a ${d.sport.toLowerCase()} preset`,
        path: ["scoringPreset"],
      });
    }
  });
export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;
