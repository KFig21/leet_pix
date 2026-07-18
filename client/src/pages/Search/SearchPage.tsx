import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { api } from "@/lib/api";
import { useSetRightRail } from "@/context/RightRailContext";
import { PollCard } from "@/components/PollCard/PollCard";
import { UserRow } from "@/components/UserRow/UserRow";
import { FollowButton } from "@/components/FollowButton/FollowButton";
import { Loader } from "@/components/Loader/Loader";
import {
  PollFilters,
  matchesPollFilters,
  defaultPollFilters,
  type PollFilterState,
} from "@/components/PollFilters/PollFilters";
import type { PollView, ProfileSummary } from "@/types";
import "./SearchPage.scss";

interface SearchResults {
  // Present for related-poll lookups (a specific player or game).
  label?: string;
  users: ProfileSummary[];
  polls: PollView[];
  formats: { id: string; name: string }[];
}

const INITIAL_USERS = 3;

// Search + discovery. A player/game deep-link (?playerId= / ?gameId=) shows that
// subject's recent polls; typing runs a text search; an empty box shows the
// explore feed (who to follow, trending polls).
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const playerId = params.get("playerId") ?? "";
  const gameId = params.get("gameId") ?? "";
  const related = !!(playerId || gameId);

  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<PollFilterState>(defaultPollFilters);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const setRail = useSetRightRail();

  const searching = q.trim().length >= 2;
  // A text search takes precedence over a deep-link once the user starts typing.
  const mode = searching ? "text" : related ? "related" : "idle";

  const queryStr =
    mode === "text"
      ? `q=${encodeURIComponent(q.trim())}`
      : mode === "related"
        ? playerId
          ? `playerId=${playerId}`
          : `gameId=${gameId}`
        : null;

  // Filters live in the rail only while browsing the explore feed.
  useEffect(() => {
    setRail(
      mode === "idle" ? <PollFilters value={filters} onChange={setFilters} /> : null,
    );
    return () => setRail(null);
  }, [mode, filters, setRail]);

  const changeQ = (val: string) => {
    setQ(val);
    // Leaving a deep-link view as soon as they type a real query.
    if (related && val.trim().length >= 2) setParams({}, { replace: true });
  };
  const clearRelated = () => setParams({}, { replace: true });

  const suggested = useQuery({
    queryKey: ["explore-users"],
    queryFn: () => api.get<ProfileSummary[]>("/explore/users"),
    enabled: mode === "idle",
  });
  const shownUsers = showAllUsers
    ? suggested.data
    : suggested.data?.slice(0, INITIAL_USERS);

  const explorePolls = useQuery({
    queryKey: ["explore-polls"],
    queryFn: () => api.get<PollView[]>("/explore/polls"),
    enabled: mode === "idle",
  });
  const shownPolls = explorePolls.data?.filter((p) =>
    matchesPollFilters(p, filters),
  );

  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ["search", queryStr],
    queryFn: () => api.get<SearchResults>(`/search?${queryStr}`),
    enabled: !!queryStr,
  });

  return (
    <div className="search">
      <header className="search__header">
        <span className="search__box">
          <SearchIcon className="search__icon" />
          <input
            className="search__input"
            placeholder="Search players, polls, people…"
            value={q}
            onChange={(e) => changeQ(e.target.value)}
          />
        </span>
      </header>

      {mode === "related" ? (
        <div className="search__results">
          <div className="search__context">
            <span className="search__context-label">
              Recent polls · <strong>{results?.label ?? "…"}</strong>
            </span>
            <button
              type="button"
              className="search__context-clear"
              onClick={clearRelated}
              aria-label="Clear"
            >
              <CloseIcon fontSize="small" />
            </button>
          </div>
          {resultsLoading && <Loader />}
          {results && results.polls.length === 0 && (
            <p className="search__msg">
              No polls about {results.label} yet — be the first to post one.
            </p>
          )}
          {results?.polls.map((p) => (
            <PollCard key={p.id} poll={p} />
          ))}
        </div>
      ) : mode === "text" ? (
        <div className="search__results">
          {resultsLoading && <Loader />}
          {results?.users.map((u) => (
            <UserRow
              key={u.id}
              profile={u}
              action={<FollowButton userId={u.id} />}
            />
          ))}
          {results?.polls.map((p) => (
            <PollCard key={p.id} poll={p} />
          ))}
          {results &&
            results.users.length === 0 &&
            results.polls.length === 0 && (
              <p className="search__msg">No matches for “{q.trim()}”.</p>
            )}
        </div>
      ) : (
        <>
          <section className="search__section">
            <h2 className="search__title">Who to follow</h2>
            {suggested.isLoading && <Loader />}
            {suggested.data?.length === 0 && (
              <p className="search__msg">
                No suggestions yet — check back as more people join.
              </p>
            )}
            {shownUsers?.map((u) => (
              <UserRow
                key={u.id}
                profile={u}
                action={<FollowButton userId={u.id} />}
              />
            ))}
            {!showAllUsers && (suggested.data?.length ?? 0) > INITIAL_USERS && (
              <button
                className="search__more"
                onClick={() => setShowAllUsers(true)}
              >
                See more profiles
              </button>
            )}
          </section>

          <section className="search__section">
            <h2 className="search__title">Trending polls</h2>
            {explorePolls.isLoading && <Loader />}
            {explorePolls.data &&
              explorePolls.data.length > 0 &&
              shownPolls?.length === 0 && (
                <p className="search__msg">No polls match these filters.</p>
              )}
            {explorePolls.data?.length === 0 && (
              <p className="search__msg">No polls yet. Be the first to post one!</p>
            )}
            {shownPolls?.map((p) => (
              <PollCard key={p.id} poll={p} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}
