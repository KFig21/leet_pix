import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import {
  POLL_QUESTION_LABELS,
  PollQuestionType,
  formatKeeperCost,
  teamColor,
} from "@leetpix/shared";
import type { Avatar as AvatarData } from "@leetpix/shared";
import { api } from "@/lib/api";
import { getPollRules } from "@/lib/pollRules";
import { statSummary } from "@/lib/statSummary";
import { useAuth } from "@/context/AuthContext";
import { usePreferences } from "@/context/PreferencesContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Avatar } from "@/components/Avatar/Avatar";
import { PlayerMeta } from "@/components/PlayerMeta/PlayerMeta";
import { TeamTag } from "@/components/TeamTag/TeamTag";
import { StreakBadge } from "@/components/StreakBadge/StreakBadge";
import { SportIcon } from "@/components/SportIcon/SportIcon";
import { ScoringBadge } from "@/components/ScoringBadge/ScoringBadge";
import { LeagueBadge } from "@/components/LeagueBadge/LeagueBadge";
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
  // Keeper polls are about season/dynasty value, so the next scheduled game is
  // just clutter — suppress it (injury designations still show).
  const isKeeper = poll.questionType === PollQuestionType.KEEP;
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
          if (resolved) {
            cls.push(
              o.isWinner
                ? "poll-card__option--winner"
                : "poll-card__option--loser",
            );
          }

          // ── Shared pieces (arranged differently on mobile vs desktop) ──────
          const nameEl = (
            <span className="poll-card__option-label">
              {resolved && o.isWinner && (
                <EmojiEventsIcon className="poll-card__trophy" />
              )}
              <span className="poll-card__option-name">{o.playerName}</span>
            </span>
          );
          const cost = formatKeeperCost({
            round: o.keeperRound,
            pick: o.keeperPick,
            leagueSize: poll.leagueSize,
          });
          const keeperEl = cost ? (
            <span
              className="poll-card__keeper"
              title="Keeper cost — the draft slot given up to keep this player"
            >
              {cost}
            </span>
          ) : null;
          const streakEl = !resolved ? (
            <StreakBadge streak={o.player?.streak} />
          ) : null;
          // Projection: quiet, labeled PROJ so it never reads as a result.
          const projEl =
            !resolved && points != null ? (
              <span className="poll-card__proj" title="Projected points">
                <span className="poll-card__proj-tag">PROJ</span>
                {points}
              </span>
            ) : null;
          // Final score: the standout number (Futura italic bold, dimmed for
          // the non-winner).
          const scoreEl =
            resolved && points != null ? (
              <span
                className={`poll-card__score${o.isWinner ? "" : " poll-card__score--dim"}`}
                title="Final points"
              >
                {points}
                <span className="poll-card__score-unit">pts</span>
              </span>
            ) : null;
          // Compact headline stats on resolved options ("9 rec · 154 yds · 2 TD").
          const stats = resolved ? statSummary(o.statLine, poll.sport) : null;
          // The profile owner's pick / your own vote — borderless, avatar +
          // colored text. On resolved polls they read "✓" / "✗ you".
          const ownedBadge = owned ? (
            <span
              className={`poll-card__you${pickWrong ? " poll-card__you--wrong" : pickRight ? " poll-card__you--right" : ""}`}
            >
              <Avatar avatar={pick!.avatar} size={16} />
              {resolved ? (pickRight ? "✓" : "✗") : "picked"}
            </span>
          ) : null;
          const myBadge =
            voted === o.id && !pick?.isSelf ? (
              <span
                className={`poll-card__you${youWrong ? " poll-card__you--wrong" : youRight ? " poll-card__you--right" : ""}`}
              >
                {me?.avatar && <Avatar avatar={me.avatar} size={16} />}
                {resolved ? (youRight ? "✓ you" : "✗ you") : "You"}
              </span>
            ) : null;
          const youBadge = (
            <>
              {ownedBadge}
              {myBadge}
            </>
          );
          const hasYouBadge = ownedBadge != null || myBadge != null;
          const pctEl = (
            <span
              className={`poll-card__pct${resolved ? (o.isWinner ? " poll-card__pct--win" : " poll-card__pct--lose") : ""}`}
            >
              {pct}%
            </span>
          );
          // Mobile line-2 right corner: voter avatars + tally ("You & 36
          // others" / "70 votes"); on resolved options your grade instead.
          const iVoted = voted === o.id;
          const others = votes - (iVoted ? 1 : 0);
          const tallyText = iVoted
            ? others > 0
              ? `You & ${others} other${others === 1 ? "" : "s"}`
              : "You"
            : `${votes} vote${votes === 1 ? "" : "s"}`;
          const faces = (o.votes ?? []).slice(0, 3);
          const tallyEl =
            resolved && hasYouBadge ? (
              youBadge
            ) : (
              <>
                {ownedBadge}
                {!resolved && faces.length > 0 && (
                  <span className="poll-card__faces">
                    {faces.map((v, i) => (
                      <Avatar key={i} avatar={v.voter.avatar} size={16} />
                    ))}
                  </span>
                )}
                <span className="poll-card__tally">{tallyText}</span>
              </>
            );
          // Mobile line 2 text: "QB · DET" (+ matchup / stats after it).
          const posTeam = [o.player?.position, o.player?.team]
            .filter(Boolean)
            .join(" · ");
          const dotColor = teamColor(o.player?.team, poll.sport)?.bg;

          return (
            <li key={o.id}>
              <button
                className={cls.join(" ")}
                disabled={resolved ? !o.statLine : !canVote}
                onClick={(e) => onOption(e, o)}
              >
                <span className="poll-card__option-fill" style={{ width: `${pct}%` }} />

                {isMobile ? (
                  // Two-line layout: name + PROJ + score/% on top; team dot ·
                  // pos · matchup (or stats / keeper cost) + tally below.
                  <span className="poll-card__m">
                    <span className="poll-card__m-row">
                      <span className="poll-card__m-id">
                        {nameEl}
                        {projEl}
                      </span>
                      <span className="poll-card__m-num">
                        {scoreEl}
                        {pctEl}
                      </span>
                    </span>
                    <span className="poll-card__m-row poll-card__m-sub">
                      {dotColor && (
                        <span
                          className="poll-card__team-dot"
                          style={{ background: dotColor }}
                        />
                      )}
                      {posTeam && (
                        <span className="poll-card__m-meta">
                          {posTeam}
                          {stats ? ` · ${stats}` : ""}
                        </span>
                      )}
                      {keeperEl}
                      {!resolved && (
                        <PlayerMeta
                          className="poll-card__option-meta"
                          game={isKeeper ? null : o.game}
                          injuryStatus={o.player?.injuryStatus}
                        />
                      )}
                      {streakEl}
                      <span className="poll-card__m-tally">{tallyEl}</span>
                    </span>
                  </span>
                ) : (
                  // Single line: name · pos · team badge · matchup/stats, PROJ
                  // on the left; score → your grade → % pinned right.
                  <span className="poll-card__d">
                    {nameEl}
                    {o.player?.position && (
                      <span className="poll-card__pos">{o.player.position}</span>
                    )}
                    <TeamTag abbr={o.player?.team} sport={poll.sport} />
                    {keeperEl}
                    {stats && <span className="poll-card__stats">{stats}</span>}
                    {!resolved && (
                      <PlayerMeta
                        className="poll-card__option-meta"
                        game={isKeeper ? null : o.game}
                        injuryStatus={o.player?.injuryStatus}
                      />
                    )}
                    {streakEl}
                    {projEl}
                    <span className="poll-card__d-num">
                      {scoreEl}
                      {youBadge}
                      {!resolved && faces.length > 0 && (
                        <span className="poll-card__faces">
                          {faces.map((v, i) => (
                            <Avatar key={i} avatar={v.voter.avatar} size={16} />
                          ))}
                        </span>
                      )}
                      {pctEl}
                    </span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="poll-card__badges">
        <HorizonBadge horizon={poll.horizon} />
        <ResolutionBadge
          questionType={poll.questionType}
          evaluationWeeks={poll.evaluationWeeks}
        />
        {poll.league ? (
          <LeagueBadge league={poll.league} />
        ) : (
          <ScoringBadge
            scoringPreset={poll.scoringPreset}
            scoringFormat={poll.scoringFormat}
          />
        )}
        {isUpset && (
          <span
            className="poll-card__upset"
            title="The winner wasn't the projected favorite"
          >
            Upset
          </span>
        )}
      </div>

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
        {resolved ? (
          <span className="poll-card__resolved-tag">
            Resolved{poll.week ? ` · Wk ${poll.week}` : ""}
          </span>
        ) : (
          <PollCountdown lockAt={poll.lockAt} status={poll.status} />
        )}
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
