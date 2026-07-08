import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { POLL_QUESTION_LABELS } from "@leetpix/shared";
import type { Avatar as AvatarData } from "@leetpix/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { usePreferences } from "@/context/PreferencesContext";
import { Avatar } from "@/components/Avatar/Avatar";
import { SportIcon } from "@/components/SportIcon/SportIcon";
import { ScoringBadge } from "@/components/ScoringBadge/ScoringBadge";
import { ResolutionBadge } from "@/components/ResolutionBadge/ResolutionBadge";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { PollCountdown } from "@/components/PollCountdown/PollCountdown";
import type { PollView } from "@/types";
import "./PollCard.scss";

interface Props {
  poll: PollView;
  // Badges an option with an avatar + "picked" pill (e.g. a profile's Picks feed).
  // `isSelf` marks that the pick belongs to the signed-in viewer (own profile),
  // so the separate "You" badge is suppressed to avoid a duplicate.
  pick?: { optionId: string; avatar: AvatarData; isSelf?: boolean };
}

// Query keys refreshed after a vote so counts update everywhere the poll appears.
const REFRESH_KEYS = ["timeline", "explore-polls", "profile-polls", "profile-picks"];

const stop = (e: React.MouseEvent) => e.stopPropagation();

// Self-contained poll card. Clicking the card opens the detail page; the author
// identity links to their profile; option buttons vote in place.
export function PollCard({ poll, pick }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { confirmVotes } = usePreferences();
  // Viewer's avatar for the "You" badge (shared cache with the sidebar/editor).
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<{ avatar: AvatarData }>("/profiles/me"),
  });
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const voted = poll.myVoteOptionId ?? null;
  const isOwn = session?.user.id === poll.author.id;
  const canVote = poll.status === "OPEN" && !voted && !isOwn;
  const totalVotes = poll.options.reduce((n, o) => n + (o._count?.votes ?? 0), 0);

  const vote = useMutation({
    mutationFn: (optionId: string) =>
      api.post("/votes", { pollId: poll.id, optionId }),
    onSuccess: () => {
      setPending(null);
      setError(null);
      qc.invalidateQueries({ queryKey: ["poll", poll.id] });
      REFRESH_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Vote failed"),
  });

  const onOption = (e: React.MouseEvent, optionId: string) => {
    e.stopPropagation();
    if (!canVote) return;
    if (confirmVotes) setPending(optionId);
    else vote.mutate(optionId);
  };

  return (
    <article className="poll-card" onClick={() => navigate(`/polls/${poll.id}`)}>
      <header className="poll-card__head">
        <Link
          to={`/u/${poll.author.username}`}
          className="poll-card__identity"
          onClick={stop}
        >
          <Avatar avatar={poll.author.avatar} size={40} />
          <span className="poll-card__names">
            <span className="poll-card__name">{poll.author.displayName}</span>
            <span className="poll-card__handle">@{poll.author.username}</span>
          </span>
        </Link>
        <span className="poll-card__meta">
          <SportIcon sport={poll.sport} className="poll-card__sport" />
          <StatusBadge status={poll.status} />
        </span>
      </header>

      <p className="poll-card__question">
        {POLL_QUESTION_LABELS[poll.questionType]}
      </p>

      <div className="poll-card__badges">
        <ResolutionBadge
          questionType={poll.questionType}
          evaluationWeeks={poll.evaluationWeeks}
        />
        <ScoringBadge
          scoringPreset={poll.scoringPreset}
          scoringFormat={poll.scoringFormat}
        />
        <PollCountdown lockAt={poll.lockAt} status={poll.status} />
      </div>

      <ul className="poll-card__options">
        {poll.options.map((o) => {
          const votes = o._count?.votes ?? 0;
          const pct = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
          const cls = ["poll-card__option"];
          if (voted === o.id) cls.push("poll-card__option--voted");
          if (pending === o.id) cls.push("poll-card__option--pending");
          return (
            <li key={o.id}>
              <button
                className={cls.join(" ")}
                disabled={!canVote}
                onClick={(e) => onOption(e, o.id)}
              >
                <span className="poll-card__option-fill" style={{ width: `${pct}%` }} />
                <span className="poll-card__option-label">{o.playerName}</span>
                {o.projectedPoints != null && (
                  <span className="poll-card__proj">{o.projectedPoints} pts</span>
                )}
                <span className="poll-card__option-right">
                  {pick?.optionId === o.id && (
                    <span className="poll-card__badge">
                      <Avatar avatar={pick.avatar} size={16} />
                      picked
                    </span>
                  )}
                  {voted === o.id && !pick?.isSelf && (
                    <span className="poll-card__badge poll-card__badge--you">
                      {me?.avatar && <Avatar avatar={me.avatar} size={16} />}
                      You
                    </span>
                  )}
                  <span className="poll-card__pct">{pct}%</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {pending && confirmVotes && !voted && (
        <div className="poll-card__confirm">
          <button
            className="poll-card__confirm-btn"
            onClick={(e) => {
              e.stopPropagation();
              vote.mutate(pending);
            }}
            disabled={vote.isPending}
          >
            {vote.isPending ? "Voting…" : "Confirm vote"}
          </button>
          <button
            type="button"
            className="poll-card__cancel-btn"
            onClick={(e) => {
              e.stopPropagation();
              setPending(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p className="poll-card__error">{error}</p>}

      <footer className="poll-card__foot">
        {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
        {voted ? " · you voted" : ""}
      </footer>
    </article>
  );
}
