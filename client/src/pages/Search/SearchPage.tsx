import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import { POLL_QUESTION_LABELS } from "@leetpix/shared";
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
  users: ProfileSummary[];
  polls: PollView[];
  formats: { id: string; name: string }[];
}

const INITIAL_USERS = 3;

// Instagram-style discovery: search bar on top. An empty query shows the explore
// feed (who to follow, trending polls); typing shows matching results.
export function SearchPage() {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<PollFilterState>(defaultPollFilters);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const setRail = useSetRightRail();
  const searching = q.trim().length >= 2;

  // Filters live in the rail only while browsing explore (not while searching).
  useEffect(() => {
    setRail(
      searching ? null : <PollFilters value={filters} onChange={setFilters} />,
    );
    return () => setRail(null);
  }, [searching, filters, setRail]);

  const suggested = useQuery({
    queryKey: ["explore-users"],
    queryFn: () => api.get<ProfileSummary[]>("/explore/users"),
    enabled: !searching,
  });
  const shownUsers = showAllUsers
    ? suggested.data
    : suggested.data?.slice(0, INITIAL_USERS);

  const explorePolls = useQuery({
    queryKey: ["explore-polls"],
    queryFn: () => api.get<PollView[]>("/explore/polls"),
    enabled: !searching,
  });
  const shownPolls = explorePolls.data?.filter((p) =>
    matchesPollFilters(p, filters),
  );

  const { data: results } = useQuery({
    queryKey: ["search", q],
    queryFn: () => api.get<SearchResults>(`/search?q=${encodeURIComponent(q)}`),
    enabled: searching,
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
            onChange={(e) => setQ(e.target.value)}
          />
        </span>
      </header>

      {searching ? (
        <div className="search__results">
          {results?.users.map((u) => (
            <Link key={u.id} to={`/u/${u.username}`} className="search__row">
              @{u.username}
            </Link>
          ))}
          {results?.polls.map((p) => (
            <Link key={p.id} to={`/polls/${p.id}`} className="search__row">
              {POLL_QUESTION_LABELS[p.questionType]}
            </Link>
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
