import { z } from "zod";
import { Sport } from "../enums";
import { catalogByKey } from "../statCatalog";

// A custom scoring format maps a stat category key -> its award. Count stats
// store a plain number of points (e.g. passingTd: 4). Rate stats store the
// intended framing { points, per } (e.g. passingYards: { points: 1, per: 25 } —
// "1 pt per 25 yards"), NOT the collapsed points-per-unit, so the exact intent
// (and any custom per) survives round-trips and displays faithfully. Scoring
// converts to points-per-unit at read time (see ruleToPointsPerUnit).
const points = z.number().finite().gte(-100).lte(100);
export const rateRuleSchema = z.object({
  points,
  per: z.number().int().min(1).max(1000),
});
export const scoringRuleValueSchema = z.union([points, rateRuleSchema]);
export type ScoringRuleValue = z.infer<typeof scoringRuleValueSchema>;

export const scoringRulesSchema = z.record(z.string(), scoringRuleValueSchema);
export type ScoringRules = z.infer<typeof scoringRulesSchema>;

export const createScoringFormatSchema = z
  .object({
    name: z.string().min(1).max(40),
    sport: z.nativeEnum(Sport),
    rules: scoringRulesSchema,
  })
  .superRefine((val, ctx) => {
    const catalog = catalogByKey(val.sport);
    const keys = Object.keys(val.rules);
    if (keys.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rules"],
        message: "A scoring format needs at least one category.",
      });
    }
    // Reject any key that isn't a real scoreable category for this sport —
    // otherwise a typo'd key would save but silently never score. Keys may be
    // position-scoped as "<base>.<POS>" (e.g. "rushingTd.QB"); those are valid
    // only when the base category declares that position as overridable.
    for (const key of keys) {
      const dot = key.indexOf(".");
      const base = dot === -1 ? key : key.slice(0, dot);
      const pos = dot === -1 ? null : key.slice(dot + 1);
      const cat = catalog.get(base);
      if (!cat) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rules", key],
          message: `Unknown ${val.sport.toLowerCase()} stat category: ${base}`,
        });
        continue;
      }
      if (pos && !(cat.overridePositions ?? []).includes(pos)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rules", key],
          message: `${cat.label} can't be scored per-position for ${pos}`,
        });
      }
    }
  });
export type CreateScoringFormatInput = z.infer<typeof createScoringFormatSchema>;
