import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { POLL_QUESTION_LABELS } from "@leetpix/shared";
import type { Avatar as AvatarData } from "@leetpix/shared";
import { api } from "@/lib/api";
import { getPollRules } from "@/lib/pollRules";
import { useAuth } from "@/context/AuthContext";
import { usePreferences } from "@/context/PreferencesContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Avatar } from "@/components/Avatar/Avatar";
import { PlayerMeta } from "@/components/PlayerMeta/PlayerMeta";
import { TeamTag } from "@/components/TeamTag/TeamTag";
import { StreakBadge } from "@/components/StreakBadge/StreakBadge";
import { SportIcon } from "@/components/SportIcon/SportIcon";
import { ScoringBadge } from "@/components/ScoringBadge/ScoringBadge";
import { ResolutionBadge } from "@/components/ResolutionBadge/ResolutionBadge";
import { HorizonBadge } from "@/components/HorizonBadge/HorizonBadge";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { PollCountdown } from "@/components/PollCountdown/PollCountdown";
import {
  ScoringBreakdownModal,
  type BreakdownOption,
} from "@/components/ScoringBreakdownModal/ScoringBreakdownModal";
import type { PollOptionView, PollView } from "@/types";
import "./PollCard.scss";

interface Props {
  poll: PollView;
  pick?: { optionId: string; avatar: AvatarData; isSelf?: boolean };
  // Static render for the create-screen preview: no navigation on click. The
  // scoring/resolution badges stay interactive (they open their own modals).
  preview?: boolean;
}

const REFRESH_KEYS = ["timeline", "explore-polls", "profile-polls", "profile-picks"];
const stop = (e: React.MouseEvent) => e.stopPropagation();

// Self-contained poll card. Clicking the card opens the detail page; the author
// identity links to their profile; option buttons vote (open polls) or open a
// scoring breakdown (resolved polls).
export function PollCard({ poll, pick, preview }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { confirmVotes } = usePreferences();
  const isMobile = useIsMobile();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<{ avatar: AvatarData }>("/profiles/me"),
  });
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Options shown in the breakdown modal (one when a row is clicked, all via
  // the "view all" button).
  const [breakdownList, setBreakdownList] = useState<PollOptionView[] | null>(
    null,
  );

  const voted = poll.myVoteOptionId ?? null;
  const isOwn = session?.user.id === poll.author.id;
  const resolved = poll.status === "RESOLVED";
  const canVote = poll.status === "OPEN" && !voted && !isOwn;
  const totalVotes = poll.options.reduce((n, o) => n + (o._count?.votes ?? 0), 0);

  // Projected favorite: the single option with the highest projected points
  // (frozen at lock). A tie leaves no favorite, so we never call one arbitrarily.
  // Purely from data already on the options — no extra fetch.
  const projFavoriteId = (() => {
    const vals = poll.options
      .map((o) => o.projectedPoints)
      .filter((p): p is number => p != null);
    if (vals.length < 2) return null;
    const top = Math.max(...vals);
    const leaders = poll.options.filter((o) => o.projectedPoints === top);
    return leaders.length === 1 ? leaders[0].id : null;
  })();
  // Upset: the poll resolved and the winner isn't who the projections favored.
  const winnerId = poll.options.find((o) => o.isWinner)?.id ?? null;
  const isUpset =
    resolved && projFavoriteId != null && winnerId != null && projFavoriteId !== winnerId;

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

  const onOption = (e: React.MouseEvent, o: PollOptionView) => {
    e.stopPropagation();
    if (resolved) {
      if (o.statLine) setBreakdownList([o]); // detail view carries stat lines
      return;
    }
    if (!canVote) return;
    if (confirmVotes) setPending(o.id);
    else vote.mutate(o.id);
  };

  return (
    <article
      className={`poll-card${preview ? " poll-card--preview" : ""}`}
      onClick={preview ? undefined : () => navigate(`/polls/${poll.id}`)}
    >
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
          {resolved && poll.options.some((o) => o.statLine) && (
            <button
              type="button"
              className="poll-card__breakdown-icon"
              title="Scoring breakdown"
              aria-label="Scoring breakdown"
              onClick={(e) => {
                e.stopPropagation();
                setBreakdownList(poll.options.filter((o) => o.statLine));
              }}
            >
              <LeaderboardIcon />
            </button>
          )}
          <SportIcon sport={poll.sport} className="poll-card__sport" />
          <StatusBadge status={poll.status} />
        </span>
      </header>

      <p className="poll-card__question">
        {POLL_QUESTION_LABELS[poll.questionType]}
      </p>

      <div className="poll-card__badges">
        <HorizonBadge horizon={poll.horizon} />
        <ResolutionBadge
          questionType={poll.questionType}
          evaluationWeeks={poll.evaluationWeeks}
        />
        <ScoringBadge
          scoringPreset={poll.scoringPreset}
          scoringFormat={poll.scoringFormat}
        />
        {isUpset && (
          <span
            className="poll-card__upset"
            title="The winner wasn't the projected favorite"
          >
            Upset
          </span>
        )}
        {/* On phones the countdown moves down to the footer (bottom-right). */}
        {!isMobile && (
          <PollCountdown lockAt={poll.lockAt} status={poll.status} />
        )}
      </div>

      <ul className="poll-card__options">
        {poll.options.map((o) => {
          const votes = o._count?.votes ?? 0;
          const pct = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
          const points = resolved ? o.actualPoints : o.projectedPoints;
          // How the viewer's own vote graded.
          const youWrong = resolved && voted === o.id && !o.isWinner;
          const youRight = resolved && voted === o.id && o.isWinner;
          // How the profile owner's pick graded (profile Picks tab).
          const owned = pick?.optionId === o.id;
          const pickWrong = resolved && owned && !o.isWinner;
          const pickRight = resolved && owned && o.isWinner;
          const cls = ["poll-card__option"];
          if (voted === o.id) {
            cls.push(
              youWrong
                ? "poll-card__option--voted-wrong"
                : "poll-card__option--voted",
            );
          }
          // The owner's losing pick gets the same red border as a wrong vote.
          if (pickWrong) cls.push("poll-card__option--voted-wrong");
          if (pending === o.id) cls.push("poll-card__option--pending");
          if (resolved && o.isWinner) cls.push("poll-card__option--winner");
          return (
            <li key={o.id}>
              <button
                className={cls.join(" ")}
                disabled={resolved ? !o.statLine : !canVote}
                onClick={(e) => onOption(e, o)}
              >
                <span className="poll-card__option-fill" style={{ width: `${pct}%` }} />
                <span className="poll-card__option-content">
                  <span className="poll-card__option-label">
                    {resolved && o.isWinner && (
                      <EmojiEventsIcon className="poll-card__trophy" />
                    )}
                    <span className="poll-card__option-name">{o.playerName}</span>
                  </span>
                  <TeamTag abbr={o.player?.team} sport={poll.sport} />
                  {!resolved && <StreakBadge streak={o.player?.streak} />}
                  {!resolved && (
                    <PlayerMeta
                      className="poll-card__option-meta"
                      game={o.game}
                      injuryStatus={o.player?.injuryStatus}
                    />
                  )}
                  {points != null &&
                    (resolved ? (
                      // Actual, final points.
                      <span className="poll-card__pts-actual" title="Final points">
                        {points} pts
                      </span>
                    ) : (
                      // Projection — labeled so it's never mistaken for a result.
                      <span
                        className={`poll-card__proj${projFavoriteId === o.id ? " poll-card__proj--favorite" : ""}`}
                        title={
                          projFavoriteId === o.id
                            ? "Projected to win"
                            : "Projected points"
                        }
                      >
                        {projFavoriteId === o.id && (
                          <TrendingUpIcon className="poll-card__proj-icon" />
                        )}
                        <span className="poll-card__proj-tag">PROJ</span>
                        {points}
                      </span>
                    ))}
                  <span className="poll-card__option-right">
                  {owned && (
                    <span
                      className={`poll-card__badge${pickWrong ? " poll-card__badge--wrong" : pickRight ? " poll-card__badge--right" : ""}`}
                    >
                      <Avatar avatar={pick!.avatar} size={16} />
                      picked
                    </span>
                  )}
                  {voted === o.id && !pick?.isSelf && (
                    <span
                      className={`poll-card__badge poll-card__badge--you${youWrong ? " poll-card__badge--wrong" : youRight ? " poll-card__badge--right" : ""}`}
                    >
                      {me?.avatar && <Avatar avatar={me.avatar} size={16} />}
                      You
                    </span>
                  )}
                  <span className="poll-card__pct">{pct}%</span>
                  </span>
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
        <span>
          {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
          {voted ? " · you voted" : ""}
        </span>
        {isMobile && <PollCountdown lockAt={poll.lockAt} status={poll.status} />}
      </footer>

      {breakdownList && (
        <ScoringBreakdownModal
          rules={getPollRules(poll)}
          scoringPreset={poll.scoringPreset}
          scoringFormat={poll.scoringFormat}
          options={breakdownList.map(
            (o): BreakdownOption => ({
              playerName: o.playerName,
              position: o.player?.position ?? null,
              statLine: o.statLine ?? {},
              total: o.actualPoints,
              isWinner: o.isWinner,
            }),
          )}
          onClose={() => setBreakdownList(null)}
        />
      )}
    </article>
  );
}
