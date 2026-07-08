import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import "./ExplorePage.scss";

const INITIAL_USERS = 3;

export function ExplorePage() {
  const [filters, setFilters] = useState<PollFilterState>(defaultPollFilters);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const setRail = useSetRightRail();

  useEffect(() => {
    setRail(<PollFilters value={filters} onChange={setFilters} />);
    return () => setRail(null);
  }, [filters, setRail]);

  const users = useQuery({
    queryKey: ["explore-users"],
    queryFn: () => api.get<ProfileSummary[]>("/explore/users"),
  });
  const shownUsers = showAllUsers
    ? users.data
    : users.data?.slice(0, INITIAL_USERS);

  const polls = useQuery({
    queryKey: ["explore-polls"],
    queryFn: () => api.get<PollView[]>("/explore/polls"),
  });
  const shownPolls = polls.data?.filter((p) => matchesPollFilters(p, filters));

  return (
    <div className="explore">
      <header className="explore__header">Explore</header>

      <section className="explore__section">
        <h2 className="explore__title">Who to follow</h2>
        {users.isLoading && <Loader />}
        {users.data?.length === 0 && (
          <p className="explore__msg">No suggestions yet — check back as more people join.</p>
        )}
        {shownUsers?.map((u) => (
          <UserRow key={u.id} profile={u} action={<FollowButton userId={u.id} />} />
        ))}
        {!showAllUsers && (users.data?.length ?? 0) > INITIAL_USERS && (
          <button
            className="explore__more"
            onClick={() => setShowAllUsers(true)}
          >
            See more profiles
          </button>
        )}
      </section>

      <section className="explore__section">
        <h2 className="explore__title">Trending polls</h2>
        {polls.isLoading && <Loader />}
        {polls.data && polls.data.length > 0 && shownPolls?.length === 0 && (
          <p className="explore__msg">No polls match these filters.</p>
        )}
        {polls.data?.length === 0 && (
          <p className="explore__msg">No polls yet. Be the first to post one!</p>
        )}
        {shownPolls?.map((p) => (
          <PollCard key={p.id} poll={p} />
        ))}
      </section>

      <section className="explore__section">
        <h2 className="explore__title">Games &amp; events</h2>
        <p className="explore__msg">
          Live games and matchups will appear here once the stats data source is
          connected.
        </p>
      </section>
    </div>
  );
}
