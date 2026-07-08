import LockIcon from "@mui/icons-material/Lock";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { PollStatus } from "@leetpix/shared";
import "./StatusBadge.scss";

const LABEL: Record<PollStatus, string> = {
  OPEN: "Open",
  LOCKED: "Locked",
  RESOLVED: "Resolved",
};

// Colored status pill: green (open, with a live dot), amber (locked), blue (resolved).
export function StatusBadge({ status }: { status: PollStatus }) {
  return (
    <span className={`status-badge status-badge--${status.toLowerCase()}`}>
      {status === "OPEN" && <span className="status-badge__dot" />}
      {status === "LOCKED" && <LockIcon className="status-badge__icon" />}
      {status === "RESOLVED" && <CheckCircleIcon className="status-badge__icon" />}
      {LABEL[status]}
    </span>
  );
}
