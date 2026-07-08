import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useSetRightRail } from "@/context/RightRailContext";
import { PollCard } from "@/components/PollCard/PollCard";
import { Loader } from "@/components/Loader/Loader";
import {
  PollFilters,
  matchesPollFilters,
  defaultPollFilters,
  type PollFilterState,
} from "@/components/PollFilters/PollFilters";
import type { PollView } from "@/types";
import "./TimelinePage.scss";

export function TimelinePage() {
  const [filters, setFilters] = useState<PollFilterState>(defaultPollFilters);
  const setRail = useSetRightRail();
  const { data, isLoading, error } = useQuery({
    queryKey: ["timeline"],
    queryFn: () => api.get<PollView[]>("/polls/timeline"),
  });

  // Render the filters into the right rail.
  useEffect(() => {
    setRail(<PollFilters value={filters} onChange={setFilters} />);
    return () => setRail(null);
  }, [filters, setRail]);

  const shown = data?.filter((p) => matchesPollFilters(p, filters));

  return (
    <div className="timeline">
      <header className="timeline__header">Home</header>

      {isLoading && <Loader />}
      {error && <p className="timeline__msg">Couldn’t load your timeline.</p>}
      {data?.length === 0 && (
        <div className="timeline__empty">
          <p className="timeline__msg">
            Your timeline is empty. Follow some people to see their polls.
          </p>
          <Link to="/explore" className="timeline__cta">
            Explore accounts &amp; polls
          </Link>
        </div>
      )}
      {data && data.length > 0 && shown?.length === 0 && (
        <p className="timeline__msg">No polls match these filters.</p>
      )}

      {shown?.map((poll) => (
        <PollCard key={poll.id} poll={poll} />
      ))}
    </div>
  );
}
