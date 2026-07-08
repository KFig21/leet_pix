import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Avatar as AvatarData } from "@leetpix/shared";
import { api } from "@/lib/api";
import { Loader } from "@/components/Loader/Loader";
import { AvatarEditor } from "../AvatarEditor/AvatarEditor";
import "./ProfileEditor.scss";

interface MeProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatar: AvatarData;
}

interface Props {
  onSaved?: (profile: MeProfile) => void;
  onCancel?: () => void;
}

const DEFAULT_AVATAR: AvatarData = {
  bgColor: "#2fa84f",
  shape: "circle",
  icon: "football",
  iconColor: "#ffffff",
};

export function ProfileEditor({ onSaved, onCancel }: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<MeProfile>("/profiles/me"),
  });

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<AvatarData>(DEFAULT_AVATAR);
  const [status, setStatus] = useState<string | null>(null);

  // Hydrate the form once the profile loads.
  useEffect(() => {
    if (!data) return;
    setUsername(data.username);
    setDisplayName(data.displayName);
    setBio(data.bio ?? "");
    setAvatar({ ...DEFAULT_AVATAR, ...data.avatar });
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api.put<MeProfile>("/profiles/me", { username, displayName, bio, avatar }),
    onSuccess: (updated) => {
      setStatus("Saved");
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      onSaved?.(updated);
    },
    onError: (e) => setStatus(e instanceof Error ? e.message : "Save failed"),
  });

  if (isLoading) return <Loader />;

  return (
    <form
      className="profile-editor"
      onSubmit={(e) => {
        e.preventDefault();
        setStatus(null);
        save.mutate();
      }}
    >
      <AvatarEditor value={avatar} onChange={setAvatar} />

      <label className="profile-editor__field">
        <span>Username</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={3}
          maxLength={20}
          required
        />
      </label>

      <label className="profile-editor__field">
        <span>Display name</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
          required
        />
      </label>

      <label className="profile-editor__field">
        <span>Bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={160}
          rows={3}
        />
      </label>

      <div className="profile-editor__actions">
        {status && <span className="profile-editor__status">{status}</span>}
        {onCancel && (
          <button
            type="button"
            className="profile-editor__cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button className="profile-editor__save" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
