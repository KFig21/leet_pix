import { useState } from "react";
import LockIcon from "@mui/icons-material/Lock";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { PollStatus } from "@leetpix/shared";
import { Modal } from "@/components/Modal/Modal";
import "./StatusBadge.scss";

const LABEL: Record<PollStatus, string> = {
  OPEN: "Open",
  LOCKED: "Locked",
  RESOLVED: "Resolved",
};

const DESC: Record<PollStatus, string> = {
  OPEN: "Voting is live. You can change or withdraw your vote until the poll locks.",
  LOCKED:
    "Voting has closed and every pick is frozen while the games play out.",
  RESOLVED:
    "The evaluation window is over and the poll is graded — results are final.",
};

const ORDER: PollStatus[] = ["OPEN", "LOCKED", "RESOLVED"];

// Static pill markup, reused by the trigger button, the modal title, and the
// explainer rows.
function pillContent(status: PollStatus) {
  return (
    <>
      {status === "OPEN" && <span className="status-badge__dot" />}
      {status === "LOCKED" && <LockIcon className="status-badge__icon" />}
      {status === "RESOLVED" && (
        <CheckCircleIcon className="status-badge__icon" />
      )}
      {LABEL[status]}
    </>
  );
}

// Colored status pill: green (open, with a live dot), amber (locked), blue
// (resolved). Clicking it opens a modal explaining the poll lifecycle.
export function StatusBadge({ status }: { status: PollStatus }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`status-badge status-badge--${status.toLowerCase()}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {pillContent(status)}
      </button>

      {open && (
        <Modal
          title="Poll status"
          titleAccessory={
            <span
              className={`status-badge status-badge--${status.toLowerCase()} status-badge--static`}
            >
              {pillContent(status)}
            </span>
          }
          onClose={() => setOpen(false)}
        >
          <ul className="status-badge__list">
            {ORDER.map((s) => (
              <li
                key={s}
                className={`status-badge__row${s === status ? " status-badge__row--on" : ""}`}
              >
                <span
                  className={`status-badge status-badge--${s.toLowerCase()} status-badge--static`}
                >
                  {pillContent(s)}
                </span>
                <p>{DESC[s]}</p>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}
