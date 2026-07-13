import { streakEmoji, streakLabel, type PlayerStreak } from "@leetpix/shared";
import "./StreakBadge.scss";

interface Props {
  streak?: PlayerStreak | null;
  className?: string;
}

// Small recent-form pill: 🔥 Hot / 🧊 Cold, with the recent-vs-baseline scoring
// in the tooltip. Renders nothing when there's no streak.
export function StreakBadge({ streak, className }: Props) {
  if (!streak) return null;
  const title = `${streakLabel(streak.status)} — ${streak.recentAvg} pts over last ${Math.min(
    streak.games,
    3,
  )} (${streak.baselineAvg} baseline)`;
  return (
    <span
      className={`streak-badge streak-badge--${streak.status}${
        className ? ` ${className}` : ""
      }`}
      title={title}
    >
      <span className="streak-badge__emoji" aria-hidden>
        {streakEmoji(streak.status)}
      </span>
      {streakLabel(streak.status)}
    </span>
  );
}
