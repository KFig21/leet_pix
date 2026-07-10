import { SCORING_PRESET_RULES, type ScoringRules } from "@leetpix/shared";
import type { PollView } from "@/types";

// Resolve a poll's active scoring rules (preset or custom format).
export function getPollRules(poll: PollView): ScoringRules {
  if (poll.scoringFormat) return poll.scoringFormat.rules;
  if (poll.scoringPreset) return SCORING_PRESET_RULES[poll.scoringPreset];
  return {};
}
