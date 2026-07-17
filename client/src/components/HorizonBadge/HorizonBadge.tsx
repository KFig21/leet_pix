import { useState } from "react";
import BoltIcon from "@mui/icons-material/Bolt";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AllInclusiveIcon from "@mui/icons-material/AllInclusive";
import {
  PollHorizon,
  POLL_HORIZON_LABELS,
  POLL_HORIZON_HINTS,
  type PollHorizon as Horizon,
} from "@leetpix/shared";
import { Modal } from "@/components/Modal/Modal";
import "./HorizonBadge.scss";

interface Props {
  horizon: Horizon;
}

const ICONS: Record<Horizon, typeof BoltIcon> = {
  [PollHorizon.DAILY]: BoltIcon,
  [PollHorizon.SEASON]: CalendarMonthIcon,
  [PollHorizon.DYNASTY]: AllInclusiveIcon,
};

const ORDER: Horizon[] = [
  PollHorizon.DAILY,
  PollHorizon.SEASON,
  PollHorizon.DYNASTY,
];

// Clickable pill showing a poll's league type (Daily / Season / Dynasty). Opens
// a modal explaining the three, matching the other clickable badges.
export function HorizonBadge({ horizon }: Props) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[horizon];

  return (
    <>
      <button
        type="button"
        className={`horizon-badge horizon-badge--${horizon.toLowerCase()}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Icon className="horizon-badge__icon" />
        {POLL_HORIZON_LABELS[horizon]}
      </button>

      {open && (
        <Modal
          title="League type"
          titleAccessory={
            <span
              className={`horizon-badge horizon-badge--${horizon.toLowerCase()} horizon-badge--static`}
            >
              <Icon className="horizon-badge__icon" />
              {POLL_HORIZON_LABELS[horizon]}
            </span>
          }
          onClose={() => setOpen(false)}
        >
          <ul className="horizon-badge__list">
            {ORDER.map((h) => {
              const RowIcon = ICONS[h];
              return (
                <li
                  key={h}
                  className={`horizon-badge__row${h === horizon ? " horizon-badge__row--on" : ""}`}
                >
                  <RowIcon className="horizon-badge__row-icon" />
                  <div>
                    <strong>{POLL_HORIZON_LABELS[h]}</strong>
                    <p>{POLL_HORIZON_HINTS[h]}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Modal>
      )}
    </>
  );
}
