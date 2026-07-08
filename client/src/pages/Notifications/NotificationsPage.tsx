import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { POLL_QUESTION_LABELS } from "@leetpix/shared";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/timeAgo";
import { Avatar } from "@/components/Avatar/Avatar";
import { FollowButton } from "@/components/FollowButton/FollowButton";
import { Loader } from "@/components/Loader/Loader";
import type {
  NotificationItem,
  VoteNotification,
  ProfileSummary,
} from "@/types";
import "./NotificationsPage.scss";

export function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<NotificationItem[]>("/notifications"),
  });

  // Mark everything read once, when the page opens.
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    api
      .post("/notifications/read")
      .then(() => qc.invalidateQueries({ queryKey: ["notifications-unread"] }))
      .catch(() => {});
  }, [qc]);

  return (
    <div className="notifications">
      <header className="notifications__header">Notifications</header>

      {isLoading && <Loader />}
      {data?.length === 0 && (
        <p className="notifications__msg">No notifications yet.</p>
      )}

      {data?.map((n) => (
        <NotificationRow key={`${n.kind}-${n.id}`} n={n} />
      ))}
    </div>
  );
}

function NotificationRow({ n }: { n: NotificationItem }) {
  const cls = `notifications__row${n.read ? "" : " notifications__row--unread"}`;

  if (n.kind === "follow") {
    // A button lives here, so the row is a div with the link scoped to content.
    return (
      <div className={cls}>
        <Link to={`/u/${n.actor.username}`} className="notifications__main">
          <Avatar avatar={n.actor.avatar} size={40} />
          <span className="notifications__text">
            <strong>{n.actor.displayName}</strong> started following you
          </span>
        </Link>
        {n.youFollow ? (
          <span className="notifications__following">Following</span>
        ) : (
          <FollowButton userId={n.actor.id} followLabel="Follow back" />
        )}
        <span className="notifications__time">{timeAgo(n.createdAt)}</span>
      </div>
    );
  }

  if (n.kind === "vote") {
    return (
      <Link to={`/polls/${n.poll.id}`} className={cls}>
        <Avatar avatar={n.actors[0]?.avatar ?? fallbackAvatar} size={40} />
        <span className="notifications__text">
          <VoteText n={n} /> voted on your poll:{" "}
          <strong>{POLL_QUESTION_LABELS[n.poll.questionType]}</strong>
        </span>
        <span className="notifications__time">{timeAgo(n.createdAt)}</span>
      </Link>
    );
  }

  return (
    <Link to={`/polls/${n.poll.id}`} className={cls}>
      <span className="notifications__icon">
        <EmojiEventsIcon />
      </span>
      <span className="notifications__text">
        Your poll <strong>{POLL_QUESTION_LABELS[n.poll.questionType]}</strong> has
        resolved
      </span>
      <span className="notifications__time">{timeAgo(n.createdAt)}</span>
    </Link>
  );
}

// "A", "A and B", or "A, B and N others".
function VoteText({ n }: { n: VoteNotification }) {
  const [a, b] = n.actors;
  if (n.count === 1) return <strong>{a?.displayName}</strong>;
  if (n.count === 2)
    return (
      <>
        <strong>{a?.displayName}</strong> and <strong>{b?.displayName}</strong>
      </>
    );
  return (
    <>
      <strong>{a?.displayName}</strong>, <strong>{b?.displayName}</strong> and{" "}
      {n.count - 2} others
    </>
  );
}

const fallbackAvatar: ProfileSummary["avatar"] = {
  bgColor: "#2fa84f",
  shape: "circle",
  icon: "football",
  iconColor: "#ffffff",
};
