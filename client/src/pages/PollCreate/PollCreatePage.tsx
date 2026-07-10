import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Sport,
  PollLockType,
  PollQuestionType,
  POLL_QUESTION_LABELS,
  SPORT_PRESETS,
  SCORING_PRESET_LABELS,
  GAME_LOCK_LEAD_MS,
  isScoreablePoll,
  isWindowedPoll,
  teamColor,
  type ScoringPreset,
} from "@leetpix/shared";
import ScheduleIcon from "@mui/icons-material/Schedule";
import CloseIcon from "@mui/icons-material/Close";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal/Modal";
import { Loader } from "@/components/Loader/Loader";
import { PollCard } from "@/components/PollCard/PollCard";
import { SportIcon } from "@/components/SportIcon/SportIcon";
import { ScoringBadge } from "@/components/ScoringBadge/ScoringBadge";
import { ResolutionBadge } from "@/components/ResolutionBadge/ResolutionBadge";
import { MultiSelect } from "@/components/MultiSelect/MultiSelect";
import { TeamTag } from "@/components/TeamTag/TeamTag";
import { PlayerMeta } from "@/components/PlayerMeta/PlayerMeta";
import type {
  PlayerGame,
  PollView,
  ProfileSummary,
  ScoringFormatSummary,
} from "@/types";
import {
  PlayerSelect,
  type PlayerPick,
} from "./components/PlayerSelect/PlayerSelect";
import "./PollCreatePage.scss";

interface ScoringFormat {
  id: string;
  name: string;
  sport: Sport;
  rules: Record<string, number>;
}

export function PollCreatePage() {
  const navigate = useNavigate();
  const [sport, setSport] = useState<Sport>(Sport.FOOTBALL);
  const [questionType, setQuestionType] = useState<PollQuestionType>(
    PollQuestionType.START,
  );
  const [options, setOptions] = useState<(PlayerPick | null)[]>([null, null]);
  // Encoded scoring choice: "preset:FOOTBALL_PPR" or "custom:<id>".
  const [scoring, setScoring] = useState<string>(
    `preset:${SPORT_PRESETS[Sport.FOOTBALL][0]}`,
  );
  const [error, setError] = useState<string | null>(null);
  // Cooldown message (429) shown in a modal.
  const [cooldown, setCooldown] = useState<string | null>(null);
  // Opinion polls close at an author-set deadline; add/drop tally over N weeks.
  const [deadline, setDeadline] = useState("");
  const [weeks, setWeeks] = useState(4);
  // Shared player-search filters (apply to every option's dropdown).
  const [teamFilters, setTeamFilters] = useState<string[]>([]);
  const [positionFilters, setPositionFilters] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (setter: typeof setTeamFilters) => (value: string) =>
    setter((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  const toggleTeam = toggle(setTeamFilters);
  const togglePosition = toggle(setPositionFilters);
  const clearFilters = () => {
    setTeamFilters([]);
    setPositionFilters([]);
  };

  const opinion = !isScoreablePoll(questionType);
  const windowed = isWindowedPoll(questionType);

  const { data: customFormats } = useQuery({
    queryKey: ["scoring-formats"],
    queryFn: () => api.get<ScoringFormat[]>("/scoring-formats"),
  });
  const { data: facets } = useQuery({
    queryKey: ["player-facets", sport],
    queryFn: () =>
      api.get<{
        teams: string[];
        positions: string[];
        games: Record<string, PlayerGame>;
      }>(`/players/facets?sport=${sport}`),
  });
  const { data: me } = useQuery({
    queryKey: ["me-profile"],
    queryFn: () => api.get<ProfileSummary>("/profiles/me"),
  });
  const presets = SPORT_PRESETS[sport];
  const customForSport = (customFormats ?? []).filter((f) => f.sport === sport);

  // Filter options for the multi-selects. Teams render as a brand-color pill
  // (readable on the dark theme; matches the selected chips below).
  const teamOptions = (facets?.teams ?? []).map((t) => {
    const game = facets?.games?.[t];
    return {
      value: t,
      label: (
        <span className="poll-create__team-opt">
          <TeamTag abbr={t} sport={sport} />
          {game && <PlayerMeta game={game} />}
        </span>
      ),
    };
  });
  const positionOptions = (facets?.positions ?? []).map((p) => ({
    value: p,
    label: p,
  }));

  const setOption = (i: number, pick: PlayerPick | null) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? pick : o)));

  const changeSport = (next: Sport) => {
    setSport(next);
    setOptions([null, null]); // picks are sport-specific
    setScoring(`preset:${SPORT_PRESETS[next][0]}`);
    setTeamFilters([]); // teams/positions are sport-specific
    setPositionFilters([]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const picks = options.filter((o): o is PlayerPick => o !== null);
    if (picks.length < 2) {
      setError("Pick at least 2 players.");
      return;
    }
    if (new Set(picks.map((p) => p.playerId)).size !== picks.length) {
      setError("Each option must be a different player.");
      return;
    }
    if (opinion && !deadline) {
      setError("Set a closing time for this poll.");
      return;
    }
    const [kind, val] = scoring.split(":");
    setSubmitting(true);
    try {
      const poll = await api.post<{ id: string }>("/polls", {
        sport,
        questionType,
        // Opinion polls have no game to key off, so they close at a deadline.
        lockType: opinion ? PollLockType.FIXED_TIME : PollLockType.GAME_START,
        lockAt: opinion ? new Date(deadline).toISOString() : undefined,
        evaluationWeeks: windowed ? weeks : undefined,
        scoringPreset: kind === "preset" ? (val as ScoringPreset) : undefined,
        scoringFormatId: kind === "custom" ? val : undefined,
        options: picks,
      });
      navigate(`/polls/${poll.id}`);
    } catch (err) {
      setSubmitting(false);
      // The 4h cooldown / 5-vote bypass rule returns 429 — surface it in a modal.
      if (err instanceof ApiError && err.status === 429) {
        setCooldown(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Failed to create poll");
      }
    }
  };

  // Synthesized poll for the live preview, built from current form state.
  const picks = options.filter((o): o is PlayerPick => o !== null);

  // Read-only matchup summary for game-locked football polls: when each picked
  // player plays this week, and the derived lock time (earliest kickoff − lead).
  const pickedGames = picks.filter((p) => p.game);
  const showMatchup = !opinion && pickedGames.length > 0;
  const earliestKickoff = pickedGames.length
    ? Math.min(...pickedGames.map((p) => new Date(p.game!.kickoff).getTime()))
    : null;
  const lockPreview =
    earliestKickoff != null
      ? new Date(earliestKickoff - GAME_LOCK_LEAD_MS)
      : null;
  const fmtDateTime = (d: Date) =>
    d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  const [scoringKind, scoringVal] = scoring.split(":");
  const previewFormat =
    scoringKind === "custom"
      ? customForSport.find((f) => f.id === scoringVal)
      : undefined;
  // Scoring badge props derived from the current selection (shared by the form
  // badge and the preview card).
  const scoringPreset: ScoringPreset | null =
    scoringKind === "preset" ? (scoringVal as ScoringPreset) : null;
  const scoringFormatSummary: ScoringFormatSummary | null = previewFormat
    ? { id: previewFormat.id, name: previewFormat.name, rules: previewFormat.rules }
    : null;
  const noDupes = new Set(picks.map((p) => p.playerId)).size === picks.length;
  const canPreview = picks.length >= 2 && !!me && noDupes;
  const previewPoll: PollView | null = me
    ? {
        id: "preview",
        sport,
        questionType,
        status: "OPEN",
        lockAt: opinion && deadline ? new Date(deadline).toISOString() : null,
        createdAt: new Date().toISOString(),
        author: me,
        myVoteOptionId: null,
        scoringPreset,
        scoringFormat: scoringFormatSummary,
        evaluationWeeks: windowed ? weeks : null,
        options: picks.map((o, i) => ({
          id: `preview-${i}`,
          playerName: o.playerName,
          projectedPoints: null,
          actualPoints: null,
          isWinner: false,
          player: {
            team: o.team ?? null,
            position: o.position ?? null,
            injuryStatus: o.injuryStatus ?? null,
          },
          game: o.game ?? null,
          _count: { votes: 0 },
        })),
      }
    : null;

  return (
    <div className="poll-create">
      <header className="poll-create__header">New poll</header>
      <form className="poll-create__form" onSubmit={submit}>
        <div className="poll-create__label-row">
          <label className="poll-create__label">Sport</label>
          <SportIcon sport={sport} className="poll-create__label-icon" />
        </div>
        <select
          className="poll-create__select"
          value={sport}
          onChange={(e) => changeSport(e.target.value as Sport)}
        >
          <option value={Sport.FOOTBALL}>Football</option>
          <option value={Sport.BASEBALL}>Baseball</option>
        </select>

        <div className="poll-create__label-row">
          <label className="poll-create__label">Question</label>
          <ResolutionBadge
            questionType={questionType}
            evaluationWeeks={windowed ? weeks : null}
          />
        </div>
        <select
          className="poll-create__select"
          value={questionType}
          onChange={(e) => setQuestionType(e.target.value as PollQuestionType)}
        >
          {Object.entries(POLL_QUESTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p
          className={`poll-create__resolution poll-create__resolution--${opinion ? "opinion" : "scored"}`}
        >
          {opinion
            ? "Opinion — shows community consensus, doesn't affect your record."
            : windowed
              ? `Scored — tallied over the evaluation window below.`
              : "Scored — locks at game start; picks count toward your record."}
        </p>

        {windowed && (
          <>
            <label className="poll-create__label">Evaluation window</label>
            <select
              className="poll-create__select"
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 6, 8].map((w) => (
                <option key={w} value={w}>
                  {w} week{w > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </>
        )}

        {opinion && (
          <>
            <label className="poll-create__label">Poll closes</label>
            <input
              type="datetime-local"
              className="poll-create__select"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </>
        )}

        <div className="poll-create__label-row">
          <label className="poll-create__label">Scoring format</label>
          <ScoringBadge
            scoringPreset={scoringPreset}
            scoringFormat={scoringFormatSummary}
          />
        </div>
        <select
          className="poll-create__select"
          value={scoring}
          onChange={(e) => setScoring(e.target.value)}
        >
          {presets.map((p) => (
            <option key={p} value={`preset:${p}`}>
              {SCORING_PRESET_LABELS[p]}
            </option>
          ))}
          {customForSport.map((f) => (
            <option key={f.id} value={`custom:${f.id}`}>
              {f.name} (custom)
            </option>
          ))}
        </select>
        <Link to="/scoring/new" className="poll-create__link">
          + Create a custom scoring format
        </Link>

        <label className="poll-create__label">Players</label>
        <div className="poll-create__filters">
          <MultiSelect
            label="Team"
            options={teamOptions}
            selected={teamFilters}
            onToggle={toggleTeam}
            wideMenu
          />
          <MultiSelect
            label="Position"
            options={positionOptions}
            selected={positionFilters}
            onToggle={togglePosition}
          />
        </div>
        {(teamFilters.length > 0 || positionFilters.length > 0) && (
          <div className="poll-create__chips">
            {teamFilters.map((t) => {
              const c = teamColor(t, sport);
              return (
                <button
                  key={`team-${t}`}
                  type="button"
                  className="poll-create__chip"
                  style={c ? { background: c.bg, color: c.fg } : undefined}
                  onClick={() => toggleTeam(t)}
                >
                  <span className="poll-create__chip-label">{t}</span>
                  <CloseIcon className="poll-create__chip-x" />
                </button>
              );
            })}
            {positionFilters.map((p) => (
              <button
                key={`pos-${p}`}
                type="button"
                className="poll-create__chip poll-create__chip--pos"
                onClick={() => togglePosition(p)}
              >
                <span className="poll-create__chip-label">{p}</span>
                <CloseIcon className="poll-create__chip-x" />
              </button>
            ))}
            <button
              type="button"
              className="poll-create__chip-clear"
              onClick={clearFilters}
            >
              Clear all
            </button>
          </div>
        )}
        {options.map((opt, i) => (
          <PlayerSelect
            key={i}
            sport={sport}
            value={opt}
            onChange={(pick) => setOption(i, pick)}
            placeholder={`Player ${i + 1}`}
            teams={teamFilters}
            positions={positionFilters}
            excludeIds={options
              .filter((o, idx): o is PlayerPick => o !== null && idx !== i)
              .map((o) => o.playerId)}
          />
        ))}
        {options.length < 4 && (
          <button
            type="button"
            className="poll-create__add"
            onClick={() => setOptions([...options, null])}
          >
            + Add option
          </button>
        )}

        {showMatchup && (
          <div className="poll-create__matchup">
            <div className="poll-create__matchup-head">
              <ScheduleIcon className="poll-create__matchup-icon" />
              {lockPreview
                ? `Locks ${fmtDateTime(lockPreview)}`
                : "Locks at game start"}
            </div>
            <ul className="poll-create__matchup-list">
              {picks.map((p) => (
                <li key={p.playerId} className="poll-create__matchup-row">
                  <TeamTag abbr={p.team} sport={sport} />
                  <span className="poll-create__matchup-name">{p.playerName}</span>
                  <span className="poll-create__matchup-game">
                    {p.game
                      ? `${p.game.atHome ? "vs" : "@"} ${p.game.opponent} · ${fmtDateTime(new Date(p.game.kickoff))}`
                      : "no game this week"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="poll-create__error">{error}</p>}
        <div className="poll-create__actions">
          <button
            type="button"
            className="poll-create__preview-btn"
            onClick={() => setShowPreview(true)}
            disabled={!canPreview}
            title={canPreview ? undefined : "Pick at least 2 players to preview"}
          >
            Preview
          </button>
          <button className="poll-create__submit" disabled={submitting}>
            Post poll
          </button>
        </div>
      </form>

      {submitting && (
        <div className="poll-create__submitting" aria-live="polite" aria-busy="true">
          <Loader />
          <span className="poll-create__submitting-text">Posting your poll…</span>
        </div>
      )}

      {showPreview && previewPoll && (
        <Modal title="Preview" onClose={() => setShowPreview(false)} wide>
          <div className="poll-create__preview">
            <PollCard poll={previewPoll} preview />
          </div>
        </Modal>
      )}

      {cooldown && (
        <Modal title="Hang on — you're on cooldown" onClose={() => setCooldown(null)}>
          <p className="poll-create__cooldown-msg">{cooldown}</p>
          <div className="poll-create__cooldown-actions">
            <button
              type="button"
              className="poll-create__cooldown-vote"
              onClick={() => navigate("/search")}
            >
              Go vote on polls
            </button>
            <button
              type="button"
              className="poll-create__cooldown-dismiss"
              onClick={() => setCooldown(null)}
            >
              Got it
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
