import { Sport, SCORING_PRESET_LABELS, isScoreablePoll } from "@leetpix/shared";
import { MultiSelect, type Option } from "@/components/MultiSelect/MultiSelect";
import { SportIcon } from "@/components/SportIcon/SportIcon";
import type { PollView } from "@/types";
import "./PollFilters.scss";

const FOOTBALL_COLOR = "#e8833a";
const BASEBALL_COLOR = "#3b82f6";

// Each dimension holds the set of chosen values (empty = no filter). Values
// within a dimension are OR'd; dimensions are AND'd.
export interface PollFilterState {
  sport: string[];
  type: string[];
  scoring: string[];
  status: string[];
  voted: string[];
  closing: string[];
}

export const defaultPollFilters: PollFilterState = {
  sport: [],
  type: [],
  scoring: [],
  status: [],
  voted: [],
  closing: [],
};

const SCORING_LABELS = Array.from(new Set(Object.values(SCORING_PRESET_LABELS)));
const DAY = 24 * 60 * 60 * 1000;

const DIMENSIONS: { key: keyof PollFilterState; label: string; options: Option[] }[] =
  [
    {
      key: "sport",
      label: "Sport",
      options: [
        {
          value: "FOOTBALL",
          label: "Football",
          color: FOOTBALL_COLOR,
          icon: <SportIcon sport={Sport.FOOTBALL} style={{ fontSize: 16 }} />,
        },
        {
          value: "BASEBALL",
          label: "Baseball",
          color: BASEBALL_COLOR,
          icon: <SportIcon sport={Sport.BASEBALL} style={{ fontSize: 16 }} />,
        },
      ],
    },
    {
      key: "type",
      label: "Type",
      options: [
        { value: "SCORED", label: "Scored" },
        { value: "OPINION", label: "Opinion" },
      ],
    },
    {
      key: "scoring",
      label: "Scoring",
      options: [
        ...SCORING_LABELS.map((l) => ({ value: l, label: l })),
        { value: "Custom", label: "Custom" },
      ],
    },
    {
      key: "status",
      label: "Status",
      options: [
        { value: "OPEN", label: "Open" },
        { value: "CLOSED", label: "Closed" },
      ],
    },
    {
      key: "voted",
      label: "Your vote",
      options: [
        { value: "VOTED", label: "Voted" },
        { value: "NOT_VOTED", label: "Not voted" },
      ],
    },
    {
      key: "closing",
      label: "Closing",
      options: [
        { value: "SOON", label: "Within 24h" },
        { value: "WEEK", label: "This week" },
      ],
    },
  ];

function pollScoringLabel(poll: PollView): string | null {
  if (poll.scoringPreset) return SCORING_PRESET_LABELS[poll.scoringPreset];
  if (poll.scoringFormat) return "Custom";
  return null;
}

export function matchesPollFilters(poll: PollView, f: PollFilterState): boolean {
  if (f.sport.length && !f.sport.includes(poll.sport)) return false;

  const type = isScoreablePoll(poll.questionType) ? "SCORED" : "OPINION";
  if (f.type.length && !f.type.includes(type)) return false;

  const label = pollScoringLabel(poll);
  if (f.scoring.length && (!label || !f.scoring.includes(label))) return false;

  const status = poll.status === "OPEN" ? "OPEN" : "CLOSED";
  if (f.status.length && !f.status.includes(status)) return false;

  const voted = poll.myVoteOptionId != null ? "VOTED" : "NOT_VOTED";
  if (f.voted.length && !f.voted.includes(voted)) return false;

  if (f.closing.length) {
    if (!poll.lockAt) return false;
    const ms = new Date(poll.lockAt).getTime() - Date.now();
    if (ms <= 0) return false;
    const limit = f.closing.includes("WEEK") ? 7 * DAY : DAY;
    if (ms > limit) return false;
  }

  return true;
}

interface Props {
  value: PollFilterState;
  onChange: (next: PollFilterState) => void;
}

export function PollFilters({ value, onChange }: Props) {
  const toggle = (key: keyof PollFilterState, val: string) => {
    const arr = value[key];
    onChange({
      ...value,
      [key]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val],
    });
  };

  // Flattened active selections for the removable pills.
  const active = DIMENSIONS.flatMap((dim) =>
    value[dim.key].map((val) => {
      const opt = dim.options.find((o) => o.value === val);
      return { key: dim.key, val, label: opt?.label ?? val, color: opt?.color };
    }),
  );

  return (
    <div className="poll-filters">
      <div className="poll-filters__top">
        <h3 className="poll-filters__heading">Filters</h3>
        {active.length > 0 && (
          <button
            className="poll-filters__clear"
            onClick={() => onChange(defaultPollFilters)}
          >
            Clear all
          </button>
        )}
      </div>

      <div className="poll-filters__selects">
        {DIMENSIONS.map((dim) => (
          <MultiSelect
            key={dim.key}
            label={dim.label}
            options={dim.options}
            selected={value[dim.key]}
            onToggle={(val) => toggle(dim.key, val)}
          />
        ))}
      </div>

      {active.length > 0 && (
        <div className="poll-filters__active">
          {active.map((a) => (
            <span
              key={`${a.key}-${a.val}`}
              className="poll-filters__pill"
              style={{ background: a.color ?? "var(--accent)" }}
            >
              {a.label}
              <button
                type="button"
                className="poll-filters__pill-close"
                aria-label={`Remove ${a.label}`}
                onClick={() => toggle(a.key, a.val)}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
