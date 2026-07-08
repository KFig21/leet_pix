import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PollCard } from "@/components/PollCard/PollCard";
import { UserRow } from "@/components/UserRow/UserRow";
import { Loader } from "@/components/Loader/Loader";
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
  const { session } = useAuth();
  const viewingOwn = !!session && session.user.id === owner?.id;

  const posts = useQuery({
    queryKey: ["profile-polls", username],
    queryFn: () => api.get<PollView[]>(`/profiles/${username}/polls`),
    enabled: tab === "posts",
  });
  const picks = useQuery({
    queryKey: ["profile-picks", username],
    queryFn: () => api.get<PickView[]>(`/profiles/${username}/votes`),
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
        {tab === "posts" && <PollList query={posts} empty="No posts yet." />}
        {tab === "picks" && (
          <PickList query={picks} owner={owner} viewingOwn={viewingOwn} />
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

function Loading() {
  return <Loader />;
}
function Empty({ text }: { text: string }) {
  return <p className="profile-tabs__msg">{text}</p>;
}

function PollList({ query, empty }: { query: QueryLike<PollView>; empty: string }) {
  if (query.isLoading) return <Loading />;
  if (!query.data?.length) return <Empty text={empty} />;
  return (
    <>
      {query.data.map((poll) => (
        <PollCard key={poll.id} poll={poll} />
      ))}
    </>
  );
}

function PickList({
  query,
  owner,
  viewingOwn,
}: {
  query: QueryLike<PickView>;
  owner?: ProfileSummary;
  viewingOwn: boolean;
}) {
  if (query.isLoading) return <Loading />;
  if (!query.data?.length) return <Empty text="No picks yet." />;
  return (
    <>
      {query.data.map((pick) => (
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
