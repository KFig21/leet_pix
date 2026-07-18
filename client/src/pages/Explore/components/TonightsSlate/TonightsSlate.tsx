import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Sport } from "@leetpix/shared";
import { api } from "@/lib/api";
import { Loader } from "@/components/Loader/Loader";
import { TeamTag } from "@/components/TeamTag/TeamTag";
import "./TonightsSlate.scss";

interface GameSummary {
  id: string;
  sport: Sport;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  status: string;
}
interface Slate {
  label: string; // "Tonight" | "Upcoming"
  games: GameSummary[];
}

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
});
const dayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
});

// Right-side status/time for a game row. Upcoming games (days out) show the date
// and time; today's games show just the time.
function gameWhen(g: GameSummary, upcoming: boolean): string {
  if (g.status === "IN_PROGRESS") return "LIVE";
  if (g.status === "FINAL") return "Final";
  if (g.status === "POSTPONED") return "PPD";
  const t = new Date(g.kickoff);
  return upcoming
    ? `${dayFmt.format(t)} · ${timeFmt.format(t)}`
    : timeFmt.format(t);
}

// The day's slate. Tapping a game opens recent polls about either team's players
// (search by gameId). Sport is controlled by the parent.
export function TonightsSlate({ sport }: { sport: Sport }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["slate", sport],
    queryFn: () => api.get<Slate>(`/explore/slate?sport=${sport}`),
  });

  const upcoming = data?.label === "Upcoming";

  return (
    <section className="slate">
      <h2 className="slate__title">
        {data?.label === "Upcoming" ? "Upcoming games" : "Tonight's slate"}
      </h2>

      {isLoading && <Loader />}
      {data && data.games.length === 0 && (
        <p className="slate__msg">No games scheduled right now.</p>
      )}

      <div className="slate__list">
        {data?.games.map((g) => (
          <button
            key={g.id}
            type="button"
            className="slate__row"
            onClick={() => navigate(`/search?gameId=${g.id}`)}
          >
            <span className="slate__teams">
              <TeamTag abbr={g.awayTeam} sport={g.sport} />
              <span className="slate__at">@</span>
              <TeamTag abbr={g.homeTeam} sport={g.sport} />
            </span>
            <span
              className={`slate__when${
                g.status === "IN_PROGRESS" ? " slate__when--live" : ""
              }`}
            >
              {gameWhen(g, upcoming)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
