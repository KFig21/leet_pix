import { useState } from "react";
import SportsIcon from "@mui/icons-material/Sports";
import {
  SCORING_PRESET_LABELS,
  SCORING_PRESET_RULES,
  statLabel,
  formatScoringRule,
  type ScoringPreset,
} from "@leetpix/shared";
import { Modal } from "@/components/Modal/Modal";
import type { ScoringFormatSummary } from "@/types";
import "./ScoringBadge.scss";

interface Props {
  scoringPreset: ScoringPreset | null;
  scoringFormat: ScoringFormatSummary | null;
}

// Badge showing the poll's scoring format ("PPR", "Standard", or "Custom").
// Clicking it opens a modal detailing the point values.
export function ScoringBadge({ scoringPreset, scoringFormat }: Props) {
  const [open, setOpen] = useState(false);

  if (!scoringPreset && !scoringFormat) return null;

  const label = scoringPreset
    ? SCORING_PRESET_LABELS[scoringPreset]
    : "Custom";
  const title = scoringPreset
    ? `${SCORING_PRESET_LABELS[scoringPreset]} scoring`
    : (scoringFormat?.name ?? "Custom scoring");
  const rules = scoringPreset
    ? SCORING_PRESET_RULES[scoringPreset]
    : (scoringFormat?.rules ?? {});

  return (
    <>
      <button
        type="button"
        className="scoring-badge"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <SportsIcon className="scoring-badge__icon" />
        {label}
      </button>

      {open && (
        <Modal
          title={title}
          titleAccessory={
            <span className="scoring-badge scoring-badge--static">
              <SportsIcon className="scoring-badge__icon" />
              {label}
            </span>
          }
          onClose={() => setOpen(false)}
        >
          <ul className="scoring-badge__rules">
            {Object.entries(rules).map(([key, value]) => (
              <li key={key} className="scoring-badge__rule">
                <span>{statLabel(key)}</span>
                <strong>{formatScoringRule(key, value)}</strong>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}
