import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import {
  Sport,
  SPORT_PRESETS,
  SCORING_PRESET_LABELS,
  LINEUP_SLOTS,
  LINEUP_SLOT_LABELS,
  LINEUP_SLOT_HINTS,
  DEFAULT_FOOTBALL_LINEUP,
  startingSpots,
  rosterSize,
  type LineupSlots,
  type LineupSlot,
  type ScoringPreset,
} from "@leetpix/shared";
import { api } from "@/lib/api";
import { Modal } from "@/components/Modal/Modal";
import { ScoringBadge } from "@/components/ScoringBadge/ScoringBadge";
import {
  ScoringFormatCreatorPage,
  type SavedScoringFormat,
} from "@/pages/ScoringFormatCreator/ScoringFormatCreatorPage";
import type { ScoringFormatSummary } from "@/types";
import "./LeagueCreatorPage.scss";

interface ScoringFormat {
  id: string;
  name: string;
  sport: Sport;
  rules: Record<string, number>;
}

// Per-slot max so counts stay sane (matches the shared zod bounds).
const SLOT_MAX: Record<LineupSlot, number> = {
  QB: 5,
  RB: 10,
  WR: 10,
  TE: 5,
  FLEX: 5,
  SUPERFLEX: 3,
  K: 3,
  DST: 3,
  IDP: 10,
  BENCH: 20,
};

// The saved-league shape the API returns (and onSaved hands back).
export interface SavedLeague {
  id: string;
  name: string;
  numTeams: number;
}

interface Props {
  // Embedded (modal) mode: hides the page header and, on save, calls onSaved
  // with the created league instead of navigating away.
  embedded?: boolean;
  onSaved?: (league: SavedLeague) => void;
}

// League setup wizard: team count + starting lineup + scoring. Reusable across
// polls (attach one so voters see how valuable a position is). Football-only.
export function LeagueCreatorPage({ embedded = false, onSaved }: Props = {}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [numTeams, setNumTeams] = useState(12);
  const [lineup, setLineup] = useState<LineupSlots>({ ...DEFAULT_FOOTBALL_LINEUP });
  // Encoded scoring choice: "preset:FOOTBALL_PPR" or "custom:<id>".
  const [scoring, setScoring] = useState<string>(
    `preset:${SPORT_PRESETS[Sport.FOOTBALL][0]}`,
  );
  // Opens the scoring wizard in a modal so league inputs aren't lost.
  const [showScoringWizard, setShowScoringWizard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: customFormats } = useQuery({
    queryKey: ["scoring-formats"],
    queryFn: () => api.get<ScoringFormat[]>("/scoring-formats"),
  });
  const customForSport = (customFormats ?? []).filter(
    (f) => f.sport === Sport.FOOTBALL,
  );
  const presets = SPORT_PRESETS[Sport.FOOTBALL];

  // Badge props for the currently selected scoring (preview on click).
  const [scoringKind, scoringVal] = scoring.split(":");
  const selectedFormat =
    scoringKind === "custom"
      ? customForSport.find((f) => f.id === scoringVal)
      : undefined;
  const scoringPreset: ScoringPreset | null =
    scoringKind === "preset" ? (scoringVal as ScoringPreset) : null;
  const scoringFormatSummary: ScoringFormatSummary | null = selectedFormat
    ? { id: selectedFormat.id, name: selectedFormat.name, rules: selectedFormat.rules }
    : null;

  // A format just created in the modal: cache it, select it, close the modal.
  const onScoringSaved = (fmt: SavedScoringFormat) => {
    qc.setQueryData<ScoringFormat[]>(["scoring-formats"], (prev) => [
      fmt,
      ...(prev ?? []).filter((f) => f.id !== fmt.id),
    ]);
    qc.invalidateQueries({ queryKey: ["scoring-formats"] });
    setScoring(`custom:${fmt.id}`);
    setShowScoringWizard(false);
  };

  const step = (slot: LineupSlot, delta: number) =>
    setLineup((prev) => ({
      ...prev,
      [slot]: Math.max(0, Math.min(SLOT_MAX[slot], (prev[slot] || 0) + delta)),
    }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (startingSpots(lineup) === 0) {
      setError("Set at least one starting spot.");
      return;
    }
    const [kind, val] = scoring.split(":");
    setSaving(true);
    try {
      const created = await api.post<SavedLeague>("/leagues", {
        name,
        sport: Sport.FOOTBALL,
        numTeams,
        lineup,
        scoringPreset: kind === "preset" ? (val as ScoringPreset) : undefined,
        scoringFormatId: kind === "custom" ? val : undefined,
      });
      if (onSaved) onSaved(created);
      else navigate("/settings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save league.");
      setSaving(false);
    }
  };

  return (
    <div className={`league${embedded ? " league--embedded" : ""}`}>
      {!embedded && <header className="league__header">New league</header>}
      <form className="league__form" onSubmit={save}>
        <label className="league__label">Name</label>
        <input
          className="league__input"
          placeholder='e.g. "Sunday Money League"'
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          required
        />

        <label className="league__label">Number of teams</label>
        <input
          className="league__input"
          type="number"
          min={2}
          max={32}
          inputMode="numeric"
          value={numTeams}
          onChange={(e) => setNumTeams(Number(e.target.value))}
        />

        <div className="league__label-row">
          <label className="league__label">Starting lineup</label>
          <span className="league__roster">
            {startingSpots(lineup)} starters · {rosterSize(lineup)} roster
          </span>
        </div>
        <div className="league__slots">
          {LINEUP_SLOTS.map((slot) => (
            <div key={slot} className="league__slot">
              <span className="league__slot-label">
                {LINEUP_SLOT_LABELS[slot]}
                {LINEUP_SLOT_HINTS[slot] && (
                  <span className="league__slot-hint">
                    {LINEUP_SLOT_HINTS[slot]}
                  </span>
                )}
              </span>
              <div className="league__stepper">
                <button
                  type="button"
                  className="league__step"
                  aria-label={`Fewer ${LINEUP_SLOT_LABELS[slot]}`}
                  disabled={(lineup[slot] || 0) === 0}
                  onClick={() => step(slot, -1)}
                >
                  <RemoveIcon fontSize="small" />
                </button>
                <span className="league__count">{lineup[slot] || 0}</span>
                <button
                  type="button"
                  className="league__step"
                  aria-label={`More ${LINEUP_SLOT_LABELS[slot]}`}
                  disabled={(lineup[slot] || 0) >= SLOT_MAX[slot]}
                  onClick={() => step(slot, 1)}
                >
                  <AddIcon fontSize="small" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="league__label-row">
          <label className="league__label">Scoring format</label>
          <ScoringBadge
            scoringPreset={scoringPreset}
            scoringFormat={scoringFormatSummary}
          />
        </div>
        <select
          className="league__input"
          value={scoring}
          onChange={(e) => setScoring(e.target.value)}
        >
          {presets.map((p) => (
            <option key={p} value={`preset:${p}`}>
              {SCORING_PRESET_LABELS[p]}
            </option>
          ))}
          {customForSport.map((f) => (
            <option key={f.id} value={`custom:${f.id}`}>
              {f.name} (custom)
            </option>
          ))}
        </select>
        <button
          type="button"
          className="league__link"
          onClick={() => setShowScoringWizard(true)}
        >
          + Create a custom scoring format
        </button>

        {error && <p className="league__error">{error}</p>}

        <div className="league__footer">
          <button className="league__save" disabled={saving}>
            {saving ? "Saving…" : "Save league"}
          </button>
        </div>
      </form>

      {showScoringWizard && (
        <Modal
          title="New scoring format"
          onClose={() => setShowScoringWizard(false)}
          wide
        >
          <ScoringFormatCreatorPage
            embedded
            initialSport={Sport.FOOTBALL}
            onSaved={onScoringSaved}
          />
        </Modal>
      )}
    </div>
  );
}
