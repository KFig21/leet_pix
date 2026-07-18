import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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

// Trending works year-round; hot/cold only when games have been played recently.
const GROUPS: { key: keyof ExplorePlayersData; label: string }[] = [
  { key: "trending", label: "Trending players" },
  { key: "hot", label: "Heating up" },
  { key: "cold", label: "Cooling off" },
];

// Discovery lists on the explore screen. Tapping a player opens their recent
// polls (search by playerId). Sport is controlled by the parent.
export function ExplorePlayers({ sport }: { sport: Sport }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["explore-players", sport],
    queryFn: () => api.get<ExplorePlayersData>(`/explore/players?sport=${sport}`),
  });

  const empty =
    data && !data.hot.length && !data.cold.length && !data.trending.length;

  return (
    <div className="explore-players">
      {isLoading && <Loader />}
      {empty && (
        <p className="explore-players__msg">
          No player trends yet — check back once more games and polls roll in.
        </p>
      )}

      {data &&
        GROUPS.map(({ key, label }) => {
          const list = data[key];
          if (!list.length) return null;
          return (
            <section key={key} className="explore-players__group">
              <h2 className="explore-players__group-title">{label}</h2>
              <div className="explore-players__list">
                {list.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="explore-players__row"
                    onClick={() => navigate(`/search?playerId=${p.id}`)}
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
