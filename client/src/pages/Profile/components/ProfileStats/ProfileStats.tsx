import { useState } from "react";
import GridOnIcon from "@mui/icons-material/GridOn";
import type { ProfileStatsResponse, StatWindow } from "@leetpix/shared";
import { Modal } from "@/components/Modal/Modal";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Heatmap } from "../Heatmap/Heatmap";
import "./ProfileStats.scss";

interface Props {
  stats?: ProfileStatsResponse;
}

const WINDOWS: { key: StatWindow; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "lifetime", label: "Lifetime" },
];

// Always-visible stats block: window selector, accuracy/picks/streak, heat map.
export function ProfileStats({ stats }: Props) {
  const [window, setWindow] = useState<StatWindow>("lifetime");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const isMobile = useIsMobile();
  const acc = stats?.accuracyByWindow[window];
  const streak = stats?.streak;

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
          <span className="profile-stats__heatmap-label">Participation</span>
          <Heatmap cells={stats?.heatmap ?? []} />
        </div>
      )}

      {showHeatmap && (
        <Modal title="Participation" onClose={() => setShowHeatmap(false)} wide>
          <div className="profile-stats__heatmap-scroll">
            <div className="profile-stats__heatmap-wide">
              <Heatmap cells={stats?.heatmap ?? []} />
            </div>
          </div>
        </Modal>
      )}
    </section>
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
