import { useState } from "react";
import GroupsIcon from "@mui/icons-material/Groups";
import {
  SCORING_PRESET_LABELS,
  SCORING_PRESET_RULES,
  LINEUP_SLOTS,
  LINEUP_SLOT_LABELS,
  statLabel,
  formatScoringRule,
  type ScoringPreset,
  type LineupSlot,
} from "@leetpix/shared";
import { Modal } from "@/components/Modal/Modal";
import type { LeagueSummary } from "@/types";
import "./LeagueBadge.scss";

interface Props {
  league: LeagueSummary;
}

// League-aware scoring badge: "12-team PPR". Clicking opens a modal with the
// team count, starting lineup (positional scarcity), and scoring values.
export function LeagueBadge({ league }: Props) {
  const [open, setOpen] = useState(false);

  const scoringLabel = league.scoringPreset
    ? SCORING_PRESET_LABELS[league.scoringPreset]
    : (league.scoringFormat?.name ?? "Custom");
  const rules = league.scoringPreset
    ? SCORING_PRESET_RULES[league.scoringPreset as ScoringPreset]
    : (league.scoringFormat?.rules ?? {});

  // Starting slots (everything but the bench) that actually have a count.
  const starters = LINEUP_SLOTS.filter(
    (s) => s !== "BENCH" && (league.lineup[s] || 0) > 0,
  );

  return (
    <>
      <button
        type="button"
        className="league-badge"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <GroupsIcon className="league-badge__icon" />
        {league.numTeams}-team {scoringLabel}
      </button>

      {open && (
        <Modal title={league.name} onClose={() => setOpen(false)}>
          <div className="league-badge__body">
            <p className="league-badge__teams">
              <strong>{league.numTeams}</strong> teams
            </p>

            <div className="league-badge__section">
              <h4 className="league-badge__heading">Starting lineup</h4>
              <ul className="league-badge__lineup">
                {starters.map((s) => (
                  <li key={s} className="league-badge__slot">
                    <span className="league-badge__slot-count">
                      {league.lineup[s as LineupSlot]}
                    </span>
                    {LINEUP_SLOT_LABELS[s as LineupSlot]}
                  </li>
                ))}
                {(league.lineup.BENCH || 0) > 0 && (
                  <li className="league-badge__slot league-badge__slot--bench">
                    <span className="league-badge__slot-count">
                      {league.lineup.BENCH}
                    </span>
                    Bench
                  </li>
                )}
              </ul>
            </div>

            <div className="league-badge__section">
              <h4 className="league-badge__heading">{scoringLabel} scoring</h4>
              <ul className="league-badge__rules">
                {Object.entries(rules).map(([key, value]) => (
                  <li key={key} className="league-badge__rule">
                    <span>{statLabel(key)}</span>
                    <strong>{formatScoringRule(key, value)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
