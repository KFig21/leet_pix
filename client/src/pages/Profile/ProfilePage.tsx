import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/Avatar/Avatar";
import { FollowButton } from "@/components/FollowButton/FollowButton";
import { ProfileEditor } from "./components/ProfileEditor/ProfileEditor";
import { ProfileStats } from "./components/ProfileStats/ProfileStats";
import { ProfileTabs } from "./components/ProfileTabs/ProfileTabs";
import type { ProfileStatsResponse } from "@leetpix/shared";
import type { ProfileSummary } from "@/types";
import "./ProfilePage.scss";

interface ProfileDetail extends ProfileSummary {
  bio: string | null;
  isFollowing: boolean;
  _count: {
    followers: number;
    following: number;
    polls: number;
    votes: number;
  };
}

export function ProfilePage() {
  const { username = "" } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [editing, setEditing] = useState(false);

  const profile = useQuery({
    queryKey: ["profile", username],
    queryFn: () => api.get<ProfileDetail>(`/profiles/${username}`),
  });
  const stats = useQuery({
    queryKey: ["stats", username],
    queryFn: () => api.get<ProfileStatsResponse>(`/stats/${username}`),
  });

  // Only the signed-in owner of this profile may edit it.
  const isOwn = !!session && session.user.id === profile.data?.id;

  return (
    <div className="profile">
      <header className="profile__header">
        {profile.data && <Avatar avatar={profile.data.avatar} size={64} />}
        <div className="profile__identity">
          <h1 className="profile__name">
            {profile.data?.displayName ?? username}
            {stats.data?.streak.isHot && <span title="Hot streak"> 🔥</span>}
          </h1>
          <span className="profile__handle">@{username}</span>
          {profile.data?.bio && (
            <p className="profile__bio">{profile.data.bio}</p>
          )}
        </div>
        {isOwn && !editing && (
          <button className="profile__edit" onClick={() => setEditing(true)}>
            Edit profile
          </button>
        )}
        {!isOwn && profile.data && (
          <span className="profile__action">
            <FollowButton
              userId={profile.data.id}
              initialFollowing={profile.data.isFollowing}
            />
          </span>
        )}
      </header>

      {editing ? (
        <section className="profile__editor">
          <ProfileEditor
            onCancel={() => setEditing(false)}
            onSaved={(updated) => {
              setEditing(false);
              if (updated.username !== username) {
                navigate(`/u/${updated.username}`, { replace: true });
              }
            }}
          />
        </section>
      ) : (
        <>
          <ProfileStats stats={stats.data} />
          <ProfileTabs
            username={username}
            counts={profile.data?._count}
            owner={profile.data}
          />
        </>
      )}
    </div>
  );
}
