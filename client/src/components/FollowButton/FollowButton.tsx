import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import "./FollowButton.scss";

interface Props {
  userId: string;
  initialFollowing?: boolean;
  // Label shown in the not-following state (e.g. "Follow back").
  followLabel?: string;
}

// Toggles a follow relationship. Refreshes the timeline so a newly-followed
// user's polls appear. Deliberately does NOT refetch suggestion lists — the
// row stays put so an accidental click can be undone via "Unfollow".
export function FollowButton({
  userId,
  initialFollowing = false,
  followLabel = "Follow",
}: Props) {
  const qc = useQueryClient();
  const [following, setFollowing] = useState(initialFollowing);

  const toggle = useMutation({
    mutationFn: () =>
      following
        ? api.del(`/profiles/${userId}/follow`)
        : api.post(`/profiles/${userId}/follow`),
    onSuccess: () => {
      setFollowing((f) => !f);
      qc.invalidateQueries({ queryKey: ["timeline"] });
      // Keep profile follower/following counts and lists fresh.
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["profile-followers"] });
      qc.invalidateQueries({ queryKey: ["profile-following"] });
    },
  });

  return (
    <button
      className={`follow-btn${following ? " follow-btn--following" : ""}`}
      onClick={() => toggle.mutate()}
      disabled={toggle.isPending}
    >
      {following ? (
        <>
          <span className="follow-btn__text">Following</span>
          <span className="follow-btn__hover-text">Unfollow</span>
        </>
      ) : (
        followLabel
      )}
    </button>
  );
}
