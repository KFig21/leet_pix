import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sport,
  PollLockType,
  PollHorizon,
  PollQuestionType,
  POLL_QUESTION_LABELS,
  POLL_HORIZON_LABELS,
  POLL_HORIZON_HINTS,
  HORIZON_QUESTIONS,
  groupFootballPositions,
  overallPickNumber,
  SPORT_PRESETS,
  SCORING_PRESET_LABELS,
  GAME_LOCK_LEAD_MS,
  isScoreablePoll,
  isWindowedPoll,
  teamColor,
  type ScoringPreset,
  type ScoringRuleValue,
} from "@leetpix/shared";
import ScheduleIcon from "@mui/icons-material/Schedule";
import CloseIcon from "@mui/icons-material/Close";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal/Modal";
import { Loader } from "@/components/Loader/Loader";
import { PollCard } from "@/components/PollCard/PollCard";
import { SportIcon } from "@/components/SportIcon/SportIcon";
import { ScoringBadge } from "@/components/ScoringBadge/ScoringBadge";
import { LeagueBadge } from "@/components/LeagueBadge/LeagueBadge";
import { ResolutionBadge } from "@/components/ResolutionBadge/ResolutionBadge";
import { HorizonBadge } from "@/components/HorizonBadge/HorizonBadge";
import { MultiSelect, type Option } from "@/components/MultiSelect/MultiSelect";
import { DateTimePicker } from "@/components/DateTimePicker/DateTimePicker";
import { TeamTag } from "@/components/TeamTag/TeamTag";
import { PlayerMeta } from "@/components/PlayerMeta/PlayerMeta";
import {
  ScoringFormatCreatorPage,
  type SavedScoringFormat,
} from "@/pages/ScoringFormatCreator/ScoringFormatCreatorPage";
import {
  LeagueCreatorPage,
  type SavedLeague,
} from "@/pages/LeagueCreator/LeagueCreatorPage";
import type {
  PlayerGame,
  PollView,
  ProfileSummary,
  ScoringFormatSummary,
  LeagueSummary,
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
  rules: Record<string, ScoringRuleValue>;
}

// A saved league as returned by /leagues (a superset of LeagueSummary).
interface LeagueOption extends LeagueSummary {
  sport: Sport;
}

export function PollCreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sport, setSport] = useState<Sport>(Sport.FOOTBALL);
  const [horizon, setHorizon] = useState<PollHorizon>(PollHorizon.SEASON);
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
  // Opinion polls close at an author-set deadline (ISO); add/drop tally over N weeks.
  const [deadline, setDeadline] = useState("");
  const [weeks, setWeeks] = useState(4);
  // Keeper polls: optional league size (teams) → enables overall pick numbers.
  const [leagueSize, setLeagueSize] = useState("");
  // Shared player-search filters (apply to every option's dropdown).
  const [teamFilters, setTeamFilters] = useState<string[]>([]);
  const [positionFilters, setPositionFilters] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Sub-wizards open in modals so in-progress poll inputs aren't lost.
  const [showScoringWizard, setShowScoringWizard] = useState(false);
  const [showLeagueWizard, setShowLeagueWizard] = useState(false);

  // A format/league just created in a modal: cache it, select it, close.
  const onScoringSaved = (fmt: SavedScoringFormat) => {
    qc.invalidateQueries({ queryKey: ["scoring-formats"] });
    setScoring(`custom:${fmt.id}`);
    setShowScoringWizard(false);
  };
  const onLeagueSaved = (league: SavedLeague) => {
    qc.invalidateQueries({ queryKey: ["leagues"] });
    setScoring(`league:${league.id}`);
    setShowLeagueWizard(false);
  };

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
  const keeper = questionType === PollQuestionType.KEEP;
  const leagueSizeNum = leagueSize ? Number(leagueSize) : undefined;

  const { data: customFormats } = useQuery({
    queryKey: ["scoring-formats"],
    queryFn: () => api.get<ScoringFormat[]>("/scoring-formats"),
  });
  const { data: leagues } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => api.get<LeagueOption[]>("/leagues"),
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
  const leaguesForSport = (leagues ?? []).filter((l) => l.sport === sport);

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
  // Football has many positions now (offense + IDP), so group them under headers
  // — offense/kicker/team-D first, then IDP. Baseball stays a flat sorted list.
  const positionOptions: Option[] =
    sport === Sport.FOOTBALL
      ? groupFootballPositions(facets?.positions ?? []).flatMap((g) => [
          { value: `__grp:${g.label}`, label: g.label, heading: true },
          ...g.positions.map((p) => ({ value: p, label: p })),
        ])
      : (facets?.positions ?? []).map((p) => ({ value: p, label: p }));

  const setOption = (i: number, pick: PlayerPick | null) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? pick : o)));

  // Switching horizon re-scopes the question list; keep the current question if
  // it's valid for the new horizon, else fall back to that horizon's default.
  const changeHorizon = (next: PollHorizon) => {
    setHorizon(next);
    const allowed = HORIZON_QUESTIONS[next];
    if (!allowed.includes(questionType)) setQuestionType(allowed[0]);
  };

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
        horizon,
        questionType,
        // Opinion polls have no game to key off, so they close at a deadline
        // (the picker already emits an ISO string).
        lockType: opinion ? PollLockType.FIXED_TIME : PollLockType.GAME_START,
        lockAt: opinion ? deadline : undefined,
        evaluationWeeks: windowed ? weeks : undefined,
        // A league supplies its own leagueSize, so only send a manual one when
        // there's no league attached.
        leagueSize: keeper && kind !== "league" ? leagueSizeNum : undefined,
        leagueId: kind === "league" ? val : undefined,
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
  const selectedLeague =
    scoringKind === "league"
      ? (leaguesForSport.find((l) => l.id === scoringVal) ?? null)
      : null;
  const previewFormat =
    scoringKind === "custom"
      ? customForSport.find((f) => f.id === scoringVal)
      : undefined;
  // Scoring badge props derived from the current selection (shared by the form
  // badge and the preview card). A league carries its own scoring, so the plain
  // preset/format badge props are blank when a league is selected.
  const scoringPreset: ScoringPreset | null =
    scoringKind === "preset" ? (scoringVal as ScoringPreset) : null;
  const scoringFormatSummary: ScoringFormatSummary | null = previewFormat
    ? { id: previewFormat.id, name: previewFormat.name, rules: previewFormat.rules }
    : null;
  // A league dictates the team count; otherwise keeper polls use the manual field.
  const effectiveLeagueSize = selectedLeague ? selectedLeague.numTeams : leagueSizeNum;
  const noDupes = new Set(picks.map((p) => p.playerId)).size === picks.length;
  const canPreview = picks.length >= 2 && !!me && noDupes;
  const previewPoll: PollView | null = me
    ? {
        id: "preview",
        sport,
        horizon,
        questionType,
        status: "OPEN",
        lockAt: opinion && deadline ? deadline : null,
        createdAt: new Date().toISOString(),
        author: me,
        myVoteOptionId: null,
        scoringPreset: selectedLeague ? null : scoringPreset,
        scoringFormat: selectedLeague ? null : scoringFormatSummary,
        league: selectedLeague,
        evaluationWeeks: windowed ? weeks : null,
        leagueSize: keeper ? (effectiveLeagueSize ?? null) : null,
        options: picks.map((o, i) => ({
          id: `preview-${i}`,
          playerName: o.playerName,
          keeperRound: o.keeperRound ?? null,
          keeperPick: o.keeperPick ?? null,
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
          <label className="poll-create__label">League Type</label>
          <HorizonBadge horizon={horizon} />
        </div>
        <select
          className="poll-create__select"
          value={horizon}
          onChange={(e) => changeHorizon(e.target.value as PollHorizon)}
        >
          {Object.values(PollHorizon).map((h) => (
            <option key={h} value={h}>
              {POLL_HORIZON_LABELS[h]}
            </option>
          ))}
        </select>
        <p className="poll-create__hint">{POLL_HORIZON_HINTS[horizon]}</p>

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
          {HORIZON_QUESTIONS[horizon].map((value) => (
            <option key={value} value={value}>
              {POLL_QUESTION_LABELS[value]}
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
            <DateTimePicker
              value={deadline}
              onChange={setDeadline}
              placeholder="Pick a closing date & time"
            />
          </>
        )}

        <div className="poll-create__label-row">
          <label className="poll-create__label">League or scoring</label>
          {selectedLeague ? (
            <LeagueBadge league={selectedLeague} />
          ) : (
            <ScoringBadge
              scoringPreset={scoringPreset}
              scoringFormat={scoringFormatSummary}
            />
          )}
        </div>
        <select
          className="poll-create__select"
          value={scoring}
          onChange={(e) => setScoring(e.target.value)}
        >
          {leaguesForSport.length > 0 && (
            <optgroup label="Your leagues">
              {leaguesForSport.map((l) => (
                <option key={l.id} value={`league:${l.id}`}>
                  {l.numTeams}-team {l.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Scoring only">
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
          </optgroup>
        </select>
        <div className="poll-create__links">
          {sport === Sport.FOOTBALL && (
            <button
              type="button"
              className="poll-create__link"
              onClick={() => setShowLeagueWizard(true)}
            >
              + Set up a league
            </button>
          )}
          <button
            type="button"
            className="poll-create__link"
            onClick={() => setShowScoringWizard(true)}
          >
            + Create a custom scoring format
          </button>
        </div>

        {/* League size sits after scoring: picking a league overrides it. */}
        {keeper && !selectedLeague && (
          <>
            <label className="poll-create__label">League size (teams)</label>
            <input
              type="number"
              min={2}
              max={32}
              inputMode="numeric"
              className="poll-create__select"
              placeholder="Optional — e.g. 10"
              value={leagueSize}
              onChange={(e) => setLeagueSize(e.target.value)}
            />
            <p className="poll-create__hint">
              Optional. Turns each keeper's round &amp; pick into the true overall
              pick number.
            </p>
          </>
        )}
        {keeper && selectedLeague && (
          <p className="poll-create__hint">
            Using {selectedLeague.numTeams} teams from{" "}
            <strong>{selectedLeague.name}</strong> for keeper pick numbers.
          </p>
        )}

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
          <div key={i} className="poll-create__player-slot">
            <PlayerSelect
              sport={sport}
              value={opt}
              onChange={(pick) => setOption(i, pick)}
              placeholder={`Player ${i + 1}`}
              teams={teamFilters}
              positions={positionFilters}
              excludeIds={options
                .filter((o, idx): o is PlayerPick => o !== null && idx !== i)
                .map((o) => o.playerId)}
              hideGame={keeper}
            />
            {/* Keeper polls: capture the draft slot forfeited for this player. */}
            {keeper && opt && (
              <div className="poll-create__keeper">
                <span className="poll-create__keeper-title">
                  Keeper cost{" "}
                  <span className="poll-create__keeper-optional">(optional)</span>
                </span>
                <div className="poll-create__keeper-fields">
                  <label className="poll-create__keeper-field">
                    Round
                    <input
                      type="number"
                      min={1}
                      max={30}
                      className="poll-create__keeper-input"
                      value={opt.keeperRound ?? ""}
                      onChange={(e) =>
                        setOption(i, {
                          ...opt,
                          keeperRound: e.target.value
                            ? Number(e.target.value)
                            : null,
                          // A pick can't stand without a round.
                          keeperPick: e.target.value ? opt.keeperPick ?? null : null,
                        })
                      }
                    />
                  </label>
                  <label className="poll-create__keeper-field">
                    Pick
                    <input
                      type="number"
                      min={1}
                      max={effectiveLeagueSize ?? 32}
                      className="poll-create__keeper-input"
                      disabled={opt.keeperRound == null}
                      value={opt.keeperPick ?? ""}
                      onChange={(e) =>
                        setOption(i, {
                          ...opt,
                          keeperPick: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </label>
                  {(() => {
                    const overall = overallPickNumber({
                      round: opt.keeperRound,
                      pick: opt.keeperPick,
                      leagueSize: effectiveLeagueSize,
                    });
                    return overall != null ? (
                      <span className="poll-create__keeper-overall">
                        = Pick #{overall}
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>
            )}
          </div>
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

      {showScoringWizard && (
        <Modal
          title="New scoring format"
          onClose={() => setShowScoringWizard(false)}
          wide
        >
          <ScoringFormatCreatorPage
            embedded
            initialSport={sport}
            onSaved={onScoringSaved}
          />
        </Modal>
      )}

      {showLeagueWizard && (
        <Modal
          title="New league"
          onClose={() => setShowLeagueWizard(false)}
          wide
        >
          <LeagueCreatorPage embedded onSaved={onLeagueSaved} />
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
