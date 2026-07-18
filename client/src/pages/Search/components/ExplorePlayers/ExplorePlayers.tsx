import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sport, type PlayerStreak } from "@leetpix/shared";
import { api } from "@/lib/api";
import { Loader } from "@/components/Loader/Loader";
import { TeamTag } from "@/components/TeamTag/TeamTag";
import { StreakBadge } from "@/components/StreakBadge/StreakBadge";
import "./ExplorePlayers.scss";

interface DiscoveryPlayer {
  id: string;
  fullName: string;
  team: string | null;
  position: string | null;
  sport: Sport;
  streak: PlayerStreak | null;
  pollCount?: number;
}
interface ExplorePlayersData {
  hot: DiscoveryPlayer[];
  cold: DiscoveryPlayer[];
  trending: DiscoveryPlayer[];
}

const SPORTS: { value: Sport; label: string }[] = [
  { value: Sport.FOOTBALL, label: "Football" },
  { value: Sport.BASEBALL, label: "Baseball" },
];

// Trending works year-round; hot/cold only when games have been played recently.
const GROUPS: { key: keyof ExplorePlayersData; label: string; emoji: string }[] = [
  { key: "trending", label: "Trending", emoji: "📈" },
  { key: "hot", label: "Heating up", emoji: "🔥" },
  { key: "cold", label: "Cooling off", emoji: "🧊" },
];

// Discovery lists on the explore screen. Tapping a player searches for them, so
// you can jump to (or start) polls about that name.
export function ExplorePlayers({ onSelect }: { onSelect: (name: string) => void }) {
  const [sport, setSport] = useState<Sport>(Sport.FOOTBALL);
  const { data, isLoading } = useQuery({
    queryKey: ["explore-players", sport],
    queryFn: () => api.get<ExplorePlayersData>(`/explore/players?sport=${sport}`),
  });

  const empty =
    data && !data.hot.length && !data.cold.length && !data.trending.length;

  return (
    <div className="explore-players">
      <div className="explore-players__head">
        <h2 className="search__title">Players</h2>
        <div className="explore-players__sports" role="tablist" aria-label="Sport">
          {SPORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="tab"
              aria-selected={sport === s.value}
              className={`explore-players__sport${
                sport === s.value ? " explore-players__sport--on" : ""
              }`}
              onClick={() => setSport(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <Loader />}
      {empty && (
        <p className="search__msg">
          No player trends yet — check back once more games and polls roll in.
        </p>
      )}

      {data &&
        GROUPS.map(({ key, label, emoji }) => {
          const list = data[key];
          if (!list.length) return null;
          return (
            <section key={key} className="explore-players__group">
              <h3 className="explore-players__group-title">
                <span aria-hidden>{emoji}</span> {label}
              </h3>
              <div className="explore-players__list">
                {list.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="explore-players__row"
                    onClick={() => onSelect(p.fullName)}
                  >
                    {p.position && (
                      <span className="explore-players__pos">{p.position}</span>
                    )}
                    <TeamTag abbr={p.team ?? undefined} sport={p.sport} />
                    <span className="explore-players__name">{p.fullName}</span>
                    {p.streak && <StreakBadge streak={p.streak} />}
                    {p.pollCount != null && (
                      <span className="explore-players__count">
                        {p.pollCount} {p.pollCount === 1 ? "poll" : "polls"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
