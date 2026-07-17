import TuneIcon from "@mui/icons-material/Tune";
import SportsScoreIcon from "@mui/icons-material/SportsScore";
import ForumIcon from "@mui/icons-material/Forum";
import SportsIcon from "@mui/icons-material/Sports";
import LockIcon from "@mui/icons-material/Lock";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ScheduleIcon from "@mui/icons-material/Schedule";
import {
  Sport,
  SPORT_COLORS,
  SCORING_PRESET_LABELS,
  isScoreablePoll,
} from "@leetpix/shared";
import { MultiSelect, type Option } from "@/components/MultiSelect/MultiSelect";
import { SportIcon } from "@/components/SportIcon/SportIcon";
import type { PollView } from "@/types";
import "./PollFilters.scss";

const ICON_SX = { fontSize: 16 };
// A live "Open" dot, matching StatusBadge — no dedicated icon reads as "open".
const OpenDot = () => <span className="poll-filters__dot" />;

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
const HOUR = 60 * 60 * 1000;
const MIN15 = 15 * 60 * 1000;

// Milliseconds a "Closing" option covers. Selections are OR'd, so several add up
// to the widest window.
const CLOSING_WINDOW: Record<string, number> = {
  MIN15,
  HOUR,
  SOON: DAY,
  WEEK: 7 * DAY,
};

const DIMENSIONS: { key: keyof PollFilterState; label: string; options: Option[] }[] =
  [
    {
      key: "sport",
      label: "Sport",
      options: [
        {
          value: "FOOTBALL",
          label: "Football",
          color: SPORT_COLORS.FOOTBALL,
          icon: <SportIcon sport={Sport.FOOTBALL} style={{ fontSize: 16 }} />,
        },
        {
          value: "BASEBALL",
          label: "Baseball",
          color: SPORT_COLORS.BASEBALL,
          icon: <SportIcon sport={Sport.BASEBALL} style={{ fontSize: 16 }} />,
        },
      ],
    },
    {
      key: "type",
      label: "Type",
      options: [
        {
          value: "SCORED",
          label: "Scored",
          color: "var(--color-scored)",
          icon: <SportsScoreIcon sx={ICON_SX} />,
        },
        {
          value: "OPINION",
          label: "Opinion",
          color: "var(--text-secondary)",
          icon: <ForumIcon sx={ICON_SX} />,
        },
      ],
    },
    {
      key: "scoring",
      label: "Scoring",
      options: [
        ...SCORING_LABELS.map((l) => ({
          value: l,
          label: l,
          color: "var(--color-info)",
          icon: <SportsIcon sx={ICON_SX} />,
        })),
        {
          value: "Custom",
          label: "Custom",
          color: "var(--color-info)",
          icon: <SportsIcon sx={ICON_SX} />,
        },
      ],
    },
    {
      key: "status",
      label: "Status",
      options: [
        {
          value: "OPEN",
          label: "Open",
          color: "var(--color-success)",
          icon: <OpenDot />,
        },
        {
          value: "LOCKED",
          label: "Locked",
          color: "var(--color-warning)",
          icon: <LockIcon sx={ICON_SX} />,
        },
        {
          value: "RESOLVED",
          label: "Resolved",
          color: "var(--color-info)",
          icon: <CheckCircleIcon sx={ICON_SX} />,
        },
      ],
    },
    {
      key: "voted",
      label: "Your vote",
      options: [
        {
          value: "VOTED",
          label: "Voted",
          color: "var(--accent)",
          icon: <CheckCircleIcon sx={ICON_SX} />,
        },
        {
          value: "NOT_VOTED",
          label: "Not voted",
          color: "var(--text-secondary)",
          icon: <RadioButtonUncheckedIcon sx={ICON_SX} />,
        },
      ],
    },
    {
      key: "closing",
      label: "Closing",
      options: [
        {
          value: "MIN15",
          label: "Within 15 min",
          color: "var(--color-danger)",
          icon: <ScheduleIcon sx={ICON_SX} />,
        },
        {
          value: "HOUR",
          label: "Within 1h",
          color: "var(--color-warning)",
          icon: <ScheduleIcon sx={ICON_SX} />,
        },
        {
          value: "SOON",
          label: "Within 24h",
          color: "var(--color-info)",
          icon: <ScheduleIcon sx={ICON_SX} />,
        },
        {
          value: "WEEK",
          label: "This week",
          color: "var(--text-secondary)",
          icon: <ScheduleIcon sx={ICON_SX} />,
        },
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

  // An OPEN poll whose lock time has passed reads as Locked (the status job may
  // not have flipped it yet), matching what the card shows.
  const lockPassed =
    poll.lockAt != null && new Date(poll.lockAt).getTime() <= Date.now();
  const status =
    poll.status === "OPEN" && lockPassed ? "LOCKED" : poll.status;
  if (f.status.length && !f.status.includes(status)) return false;

  const voted = poll.myVoteOptionId != null ? "VOTED" : "NOT_VOTED";
  if (f.voted.length && !f.voted.includes(voted)) return false;

  if (f.closing.length) {
    if (!poll.lockAt) return false;
    const ms = new Date(poll.lockAt).getTime() - Date.now();
    if (ms <= 0) return false;
    const limit = Math.max(...f.closing.map((v) => CLOSING_WINDOW[v] ?? DAY));
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
      return {
        key: dim.key,
        val,
        label: opt?.label ?? val,
        color: opt?.color,
        icon: opt?.icon,
      };
    }),
  );

  return (
    <div className="poll-filters">
      <div className="poll-filters__top">
        <h3 className="poll-filters__heading">
          <TuneIcon fontSize="small" /> Filters
        </h3>
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
              {a.icon && <span className="poll-filters__pill-icon">{a.icon}</span>}
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
