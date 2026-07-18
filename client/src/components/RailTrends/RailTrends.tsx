import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Sport, type PlayerStreak } from "@leetpix/shared";
import { api } from "@/lib/api";
import { TeamTag } from "@/components/TeamTag/TeamTag";
import { StreakBadge } from "@/components/StreakBadge/StreakBadge";
import "./RailTrends.scss";

interface DiscoveryPlayer {
  id: string;
  fullName: string;
  team: string | null;
  position: string | null;
  sport: Sport;
  streak: PlayerStreak | null;
  pollCount?: number;
}
interface GameSummary {
  id: string;
  sport: Sport;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  status: string;
}

const SPORTS: { value: Sport; label: string }[] = [
  { value: Sport.FOOTBALL, label: "FB" },
  { value: Sport.BASEBALL, label: "BB" },
];
const LIMIT = 4;

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
});
const dayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
});
// Compact right-aligned when: date + time for upcoming, time for today.
function gameWhen(kickoff: string, upcoming: boolean): string {
  const t = new Date(kickoff);
  return upcoming ? `${dayFmt.format(t)} · ${timeFmt.format(t)}` : timeFmt.format(t);
}

// Compact "trends" card for the home right rail: a few trending players and the
// day's games. Tapping either jumps to its recent polls; "See all" opens Explore.
export function RailTrends() {
  const [sport, setSport] = useState<Sport>(Sport.FOOTBALL);
  const navigate = useNavigate();

  const players = useQuery({
    queryKey: ["explore-players", sport],
    queryFn: () =>
      api.get<{ trending: DiscoveryPlayer[] }>(`/explore/players?sport=${sport}`),
  });
  const slate = useQuery({
    queryKey: ["slate", sport],
    queryFn: () =>
      api.get<{ label: string; games: GameSummary[] }>(`/explore/slate?sport=${sport}`),
  });

  const trending = players.data?.trending.slice(0, LIMIT) ?? [];
  const games = slate.data?.games.slice(0, LIMIT) ?? [];

  return (
    <div className="rail-trends">
      <div className="rail-trends__head">
        <span className="rail-trends__title">Trends</span>
        <div className="rail-trends__sports" role="tablist" aria-label="Sport">
          {SPORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="tab"
              aria-selected={sport === s.value}
              className={`rail-trends__sport${
                sport === s.value ? " rail-trends__sport--on" : ""
              }`}
              onClick={() => setSport(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {trending.length > 0 && (
        <div className="rail-trends__group">
          <span className="rail-trends__group-title">Trending players</span>
          {trending.map((p) => (
            <button
              key={p.id}
              type="button"
              className="rail-trends__row"
              onClick={() => navigate(`/search?playerId=${p.id}`)}
            >
              <TeamTag abbr={p.team ?? undefined} sport={p.sport} />
              <span className="rail-trends__name">{p.fullName}</span>
              {p.streak && <StreakBadge streak={p.streak} />}
            </button>
          ))}
        </div>
      )}

      {games.length > 0 && (
        <div className="rail-trends__group">
          <span className="rail-trends__group-title">
            {slate.data?.label === "Upcoming" ? "Upcoming games" : "Tonight's games"}
          </span>
          {games.map((g) => (
            <button
              key={g.id}
              type="button"
              className="rail-trends__row"
              onClick={() => navigate(`/search?gameId=${g.id}`)}
            >
              <span className="rail-trends__game">
                {g.awayTeam} <span className="rail-trends__at">@</span> {g.homeTeam}
              </span>
              <span className="rail-trends__when">
                {gameWhen(g.kickoff, slate.data?.label === "Upcoming")}
              </span>
            </button>
          ))}
        </div>
      )}

      {trending.length === 0 && games.length === 0 && (
        <p className="rail-trends__empty">No trends yet.</p>
      )}

      <Link to="/trending" className="rail-trends__all">
        See all →
      </Link>
    </div>
  );
}
