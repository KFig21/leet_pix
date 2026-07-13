import BoltIcon from "@mui/icons-material/Bolt";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AllInclusiveIcon from "@mui/icons-material/AllInclusive";
import {
  PollHorizon,
  POLL_HORIZON_LABELS,
  POLL_HORIZON_HINTS,
  type PollHorizon as Horizon,
} from "@leetpix/shared";
import "./HorizonBadge.scss";

interface Props {
  horizon: Horizon;
}

const ICONS: Record<Horizon, typeof BoltIcon> = {
  [PollHorizon.DAILY]: BoltIcon,
  [PollHorizon.SEASON]: CalendarMonthIcon,
  [PollHorizon.DYNASTY]: AllInclusiveIcon,
};

// Small non-interactive pill showing a poll's framing (Daily / Season / Dynasty).
export function HorizonBadge({ horizon }: Props) {
  const Icon = ICONS[horizon];
  return (
    <span
      className={`horizon-badge horizon-badge--${horizon.toLowerCase()}`}
      title={POLL_HORIZON_HINTS[horizon]}
    >
      <Icon className="horizon-badge__icon" />
      {POLL_HORIZON_LABELS[horizon]}
    </span>
  );
}
