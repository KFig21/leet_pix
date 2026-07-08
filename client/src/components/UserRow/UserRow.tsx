import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Avatar } from "@/components/Avatar/Avatar";
import type { ProfileSummary } from "@/types";
import "./UserRow.scss";

interface Props {
  profile: ProfileSummary;
  // Optional trailing control (e.g. a follow button). Kept outside the Link
  // so it isn't a nested interactive element.
  action?: ReactNode;
}

// A person in a list: followers/following, search results, who-to-follow.
export function UserRow({ profile, action }: Props) {
  return (
    <div className="user-row">
      <Link to={`/u/${profile.username}`} className="user-row__main">
        <Avatar avatar={profile.avatar} size={40} />
        <div className="user-row__names">
          <span className="user-row__display">{profile.displayName}</span>
          <span className="user-row__handle">@{profile.username}</span>
        </div>
      </Link>
      {action && <div className="user-row__action">{action}</div>}
    </div>
  );
}
