import type { PlayerGame } from "@/types";
import "./PlayerMeta.scss";

interface Props {
  injuryStatus?: string | null;
  game?: PlayerGame | null;
  className?: string;
}

// Short injury designation + tone. Sleeper reports full words; we abbreviate.
const INJURY: Record<string, { short: string; tone: "warn" | "danger" }> = {
  Questionable: { short: "Q", tone: "warn" },
  Doubtful: { short: "D", tone: "warn" },
  Out: { short: "OUT", tone: "danger" },
  IR: { short: "IR", tone: "danger" },
  PUP: { short: "PUP", tone: "danger" },
  Sus: { short: "SUS", tone: "danger" },
  NA: { short: "NA", tone: "danger" },
};

function kickoffLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Compact secondary line: "@ DAL · Sun 1:00 PM" plus an injury pill. Renders
// nothing when there's neither a game nor an injury.
export function PlayerMeta({ injuryStatus, game, className }: Props) {
  const injury = injuryStatus ? (INJURY[injuryStatus] ?? null) : null;
  if (!game && !injury) return null;

  return (
    <span className={`player-meta${className ? ` ${className}` : ""}`}>
      {game && (
        <span className="player-meta__game">
          {game.atHome ? "vs" : "@"} {game.opponent} · {kickoffLabel(game.kickoff)}
        </span>
      )}
      {injury && (
        <span
          className={`player-meta__injury player-meta__injury--${injury.tone}`}
          title={injuryStatus ?? undefined}
        >
          {injury.short}
        </span>
      )}
    </span>
  );
}
