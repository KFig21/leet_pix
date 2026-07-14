import { useState } from "react";
import GridOnIcon from "@mui/icons-material/GridOn";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import type {
  ProfileStatsResponse,
  StatWindow,
  HeatmapCell,
} from "@leetpix/shared";
import { Modal } from "@/components/Modal/Modal";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Heatmap } from "../Heatmap/Heatmap";
import "./ProfileStats.scss";

interface Props {
  stats?: ProfileStatsResponse;
}

const WINDOWS: { key: StatWindow; label: string; days: number | null; span: string }[] = [
  { key: "day", label: "Day", days: 1, span: "Today" },
  { key: "week", label: "Week", days: 7, span: "Last 7 days" },
  { key: "month", label: "Month", days: 30, span: "Last 30 days" },
  { key: "year", label: "Year", days: 365, span: "Last year" },
  { key: "lifetime", label: "Lifetime", days: null, span: "All time" },
];

// Start-of-window date (mirrors the server's windowStart). Null = lifetime.
function windowStart(days: number | null): Date | null {
  if (days == null) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// Always-visible stats block: window selector, accuracy/picks/streak, heat map.
export function ProfileStats({ stats }: Props) {
  const [window, setWindow] = useState<StatWindow>("lifetime");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [day, setDay] = useState<HeatmapCell | null>(null);
  const isMobile = useIsMobile();
  const meta = WINDOWS.find((w) => w.key === window)!;
  const acc = stats?.accuracyByWindow[window];
  const streak = stats?.streak;
  const activeSince = windowStart(meta.days);

  const streakLabel = streak?.isHot
    ? `🔥 ${streak.current}`
    : streak?.isCold
      ? `🧊 ${Math.abs(streak.current)}`
      : String(streak?.current ?? 0);

  return (
    <section className="profile-stats">
      <div className="profile-stats__windows">
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            className={`profile-stats__window${window === w.key ? " profile-stats__window--active" : ""}`}
            onClick={() => setWindow(w.key)}
          >
            {w.label}
          </button>
        ))}
        {/* On phones the heatmap opens in a modal from this compact grid icon. */}
        {isMobile && (
          <button
            className="profile-stats__heatmap-icon"
            onClick={() => setShowHeatmap(true)}
            aria-label="Participation activity"
            title="Participation"
          >
            <GridOnIcon />
          </button>
        )}
      </div>

      <div className="profile-stats__figures">
        <Figure value={`${acc ? Math.round(acc.accuracy * 100) : 0}%`} label="Accuracy" />
        <Figure value={acc?.totalVotes ?? 0} label="Picks" />
        <Figure value={acc?.correct ?? 0} label="Correct" />
        <Figure value={acc ? Math.round(acc.score) : 0} label="Score" />
        <Figure value={streakLabel} label="Streak" />
      </div>

      {!isMobile && (
        <div className="profile-stats__heatmap">
          <div className="profile-stats__heatmap-head">
            <span className="profile-stats__heatmap-label">Participation</span>
            <span className="profile-stats__heatmap-span">{meta.span}</span>
          </div>
          <Heatmap
            cells={stats?.heatmap ?? []}
            activeSince={activeSince}
            onSelectDay={setDay}
          />
        </div>
      )}

      {showHeatmap && (
        <Modal title="Participation" onClose={() => setShowHeatmap(false)} wide>
          <div className="profile-stats__heatmap-scroll">
            <div className="profile-stats__heatmap-wide">
              <Heatmap
                cells={stats?.heatmap ?? []}
                activeSince={activeSince}
                onSelectDay={setDay}
              />
            </div>
          </div>
        </Modal>
      )}

      {day && <DayModal cell={day} onClose={() => setDay(null)} />}
    </section>
  );
}

// Long-form date for the day drill-down title, e.g. "Mon, Jul 14".
function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Brief per-day recap: each pick as question + player, green if correct, red if
// wrong.
function DayModal({ cell, onClose }: { cell: HeatmapCell; onClose: () => void }) {
  return (
    <Modal title={formatDay(cell.date)} onClose={onClose}>
      <p className="profile-stats__day-summary">
        {cell.correct}/{cell.votes} correct
      </p>
      <ul className="profile-stats__picks">
        {cell.picks.map((p, i) => (
          <li
            key={`${p.pollId}-${i}`}
            className={`profile-stats__pick profile-stats__pick--${p.correct ? "win" : "loss"}`}
          >
            <span className="profile-stats__pick-icon">
              {p.correct ? (
                <CheckIcon fontSize="small" />
              ) : (
                <CloseIcon fontSize="small" />
              )}
            </span>
            <span className="profile-stats__pick-q">{p.question}</span>
            <span className="profile-stats__pick-player">{p.player}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function Figure({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="profile-stats__figure">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
