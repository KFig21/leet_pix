import { useEffect, useState } from "react";
import ScheduleIcon from "@mui/icons-material/Schedule";
import type { PollStatus } from "@leetpix/shared";
import "./PollCountdown.scss";

interface Props {
  lockAt: string | null;
  status: PollStatus;
}

function remaining(ms: number): string {
  const m = Math.floor(ms / 60000);
  const days = Math.floor(m / 1440);
  if (days > 0) return `${days}d ${Math.floor((m % 1440) / 60)}h`;
  const hours = Math.floor(m / 60);
  if (hours > 0) return `${hours}h ${m % 60}m`;
  return `${Math.max(m, 1)}m`;
}

// "Closes in …" indicator. Real countdown for deadline (opinion) polls; a
// placeholder for game-locked polls until we wire game times.
export function PollCountdown({ lockAt, status }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  let text: string;
  if (status !== "OPEN") {
    text = "Closed";
  } else if (!lockAt) {
    text = "Locks at game start";
  } else {
    const ms = new Date(lockAt).getTime() - now;
    text = ms <= 0 ? "Closing…" : `Closes in ${remaining(ms)}`;
  }

  return (
    <span className="poll-countdown">
      <ScheduleIcon className="poll-countdown__icon" />
      {text}
    </span>
  );
}
