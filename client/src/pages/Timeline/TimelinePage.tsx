import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useSetRightRail } from "@/context/RightRailContext";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { PollCard } from "@/components/PollCard/PollCard";
import { RailTrends } from "@/components/RailTrends/RailTrends";
import { Loader } from "@/components/Loader/Loader";
import {
  PollFilters,
  matchesPollFilters,
  defaultPollFilters,
  type PollFilterState,
} from "@/components/PollFilters/PollFilters";
import type { PollView } from "@/types";
import "./TimelinePage.scss";

interface TimelinePageData {
  items: PollView[];
  nextCursor: string | null;
}

export function TimelinePage() {
  const [filters, setFilters] = useState<PollFilterState>(defaultPollFilters);
  const setRail = useSetRightRail();
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["timeline"],
    queryFn: ({ pageParam }) =>
      api.get<TimelinePageData>(
        `/polls/timeline?limit=20${pageParam ? `&cursor=${pageParam}` : ""}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  // Render the filters + a compact trends widget into the right rail.
  useEffect(() => {
    setRail(
      <>
        <PollFilters value={filters} onChange={setFilters} />
        <RailTrends />
      </>,
    );
    return () => setRail(null);
  }, [filters, setRail]);

  const polls = data?.pages.flatMap((p) => p.items) ?? [];
  const shown = polls.filter((p) => matchesPollFilters(p, filters));
  const sentinelRef = useInfiniteScroll(
    fetchNextPage,
    hasNextPage && !isFetchingNextPage,
  );

  return (
    <div className="timeline">
      <header className="timeline__header">Home</header>

      {isLoading && <Loader />}
      {error && <p className="timeline__msg">Couldn’t load your timeline.</p>}
      {!isLoading && polls.length === 0 && (
        <div className="timeline__empty">
          <p className="timeline__msg">
            Your timeline is empty. Follow some people to see their polls.
          </p>
          <Link to="/search" className="timeline__cta">
            Explore accounts &amp; polls
          </Link>
        </div>
      )}
      {polls.length > 0 && shown.length === 0 && (
        <p className="timeline__msg">No polls match these filters.</p>
      )}

      {shown.map((poll) => (
        <PollCard key={poll.id} poll={poll} />
      ))}

      <div ref={sentinelRef} className="timeline__sentinel" />
      {isFetchingNextPage && <Loader />}
    </div>
  );
}
