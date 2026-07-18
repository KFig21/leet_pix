import { useEffect, useState } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSetRightRail } from "@/context/RightRailContext";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { PollCard } from "@/components/PollCard/PollCard";
import { UserRow } from "@/components/UserRow/UserRow";
import { Loader } from "@/components/Loader/Loader";
import {
  PollFilters,
  matchesPollFilters,
  defaultPollFilters,
  type PollFilterState,
} from "@/components/PollFilters/PollFilters";
import type { PollView, PickView, ProfileSummary } from "@/types";
import "./ProfileTabs.scss";

type Tab = "posts" | "picks" | "followers" | "following";

interface Props {
  username: string;
  counts?: {
    polls: number;
    followers: number;
    following: number;
    votes: number;
  };
  // The profile owner — used to badge their picked option in the Picks tab.
  owner?: ProfileSummary;
}

export function ProfileTabs({ username, counts, owner }: Props) {
  const [tab, setTab] = useState<Tab>("posts");
  const [filters, setFilters] = useState<PollFilterState>(defaultPollFilters);
  const { session } = useAuth();
  const setRail = useSetRightRail();
  const viewingOwn = !!session && session.user.id === owner?.id;

  // The poll tabs (posts/picks) get the shared filter panel in the right rail;
  // the people tabs (followers/following) don't filter, so clear it.
  const showFilters = tab === "posts" || tab === "picks";
  useEffect(() => {
    setRail(showFilters ? <PollFilters value={filters} onChange={setFilters} /> : null);
    return () => setRail(null);
  }, [showFilters, filters, setRail]);

  const posts = useInfiniteQuery({
    queryKey: ["profile-polls", username],
    queryFn: ({ pageParam }) =>
      api.get<InfinitePage<PollView>>(
        `/profiles/${username}/polls?limit=20${pageParam ? `&cursor=${pageParam}` : ""}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: tab === "posts",
  });
  const picks = useInfiniteQuery({
    queryKey: ["profile-picks", username],
    queryFn: ({ pageParam }) =>
      api.get<InfinitePage<PickView>>(
        `/profiles/${username}/votes?limit=20${pageParam ? `&cursor=${pageParam}` : ""}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: tab === "picks",
  });
  const followers = useQuery({
    queryKey: ["profile-followers", username],
    queryFn: () => api.get<ProfileSummary[]>(`/profiles/${username}/followers`),
    enabled: tab === "followers",
  });
  const following = useQuery({
    queryKey: ["profile-following", username],
    queryFn: () => api.get<ProfileSummary[]>(`/profiles/${username}/following`),
    enabled: tab === "following",
  });

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "posts", label: "Posts", count: counts?.polls },
    { key: "picks", label: "Picks", count: counts?.votes },
    { key: "followers", label: "Followers", count: counts?.followers },
    { key: "following", label: "Following", count: counts?.following },
  ];

  return (
    <div className="profile-tabs">
      <div className="profile-tabs__bar" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            className={`profile-tabs__tab${tab === t.key ? " profile-tabs__tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className="profile-tabs__count">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="profile-tabs__content">
        {tab === "posts" && (
          <PollList query={posts} filters={filters} empty="No posts yet." />
        )}
        {tab === "picks" && (
          <PickList
            query={picks}
            filters={filters}
            owner={owner}
            viewingOwn={viewingOwn}
          />
        )}
        {tab === "followers" && (
          <PeopleList query={followers} empty="No followers yet." />
        )}
        {tab === "following" && (
          <PeopleList query={following} empty="Not following anyone yet." />
        )}
      </div>
    </div>
  );
}

interface QueryLike<T> {
  data?: T[];
  isLoading: boolean;
}

interface InfinitePage<T> {
  items: T[];
  nextCursor: string | null;
}

// Structural subset of useInfiniteQuery's result the feed lists need.
interface InfiniteQueryLike<T> {
  data?: { pages: InfinitePage<T>[] };
  isLoading: boolean;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

function Loading() {
  return <Loader />;
}
function Empty({ text }: { text: string }) {
  return <p className="profile-tabs__msg">{text}</p>;
}

// Sentinel + "loading more" spinner shared by the paginated feed lists.
function LoadMore({ query }: { query: InfiniteQueryLike<unknown> }) {
  const ref = useInfiniteScroll(
    query.fetchNextPage,
    query.hasNextPage && !query.isFetchingNextPage,
  );
  return (
    <>
      <div ref={ref} className="profile-tabs__sentinel" />
      {query.isFetchingNextPage && <Loader />}
    </>
  );
}

function PollList({
  query,
  filters,
  empty,
}: {
  query: InfiniteQueryLike<PollView>;
  filters: PollFilterState;
  empty: string;
}) {
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  if (query.isLoading) return <Loading />;
  if (items.length === 0) return <Empty text={empty} />;
  const shown = items.filter((p) => matchesPollFilters(p, filters));
  if (shown.length === 0) return <Empty text="No posts match these filters." />;
  return (
    <>
      {shown.map((poll) => (
        <PollCard key={poll.id} poll={poll} />
      ))}
      <LoadMore query={query} />
    </>
  );
}

function PickList({
  query,
  filters,
  owner,
  viewingOwn,
}: {
  query: InfiniteQueryLike<PickView>;
  filters: PollFilterState;
  owner?: ProfileSummary;
  viewingOwn: boolean;
}) {
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  if (query.isLoading) return <Loading />;
  if (items.length === 0) return <Empty text="No picks yet." />;
  const shown = items.filter((pick) => matchesPollFilters(pick.poll, filters));
  if (shown.length === 0) return <Empty text="No picks match these filters." />;
  return (
    <>
      {shown.map((pick) => (
        <PollCard
          key={pick.id}
          poll={pick.poll}
          pick={
            owner
              ? { optionId: pick.option.id, avatar: owner.avatar, isSelf: viewingOwn }
              : undefined
          }
        />
      ))}
      <LoadMore query={query} />
    </>
  );
}

function PeopleList({
  query,
  empty,
}: {
  query: QueryLike<ProfileSummary>;
  empty: string;
}) {
  if (query.isLoading) return <Loading />;
  if (!query.data?.length) return <Empty text={empty} />;
  return (
    <>
      {query.data.map((p) => (
        <UserRow key={p.id} profile={p} />
      ))}
    </>
  );
}
