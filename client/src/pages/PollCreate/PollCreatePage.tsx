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
  isScoreablePoll,
  isWindowedPoll,
  type ScoringPreset,
} from "@leetpix/shared";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal/Modal";
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

  const opinion = !isScoreablePoll(questionType);
  const windowed = isWindowedPoll(questionType);

  const { data: customFormats } = useQuery({
    queryKey: ["scoring-formats"],
    queryFn: () => api.get<ScoringFormat[]>("/scoring-formats"),
  });
  const presets = SPORT_PRESETS[sport];
  const customForSport = (customFormats ?? []).filter((f) => f.sport === sport);

  const setOption = (i: number, pick: PlayerPick | null) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? pick : o)));

  const changeSport = (next: Sport) => {
    setSport(next);
    setOptions([null, null]); // picks are sport-specific
    setScoring(`preset:${SPORT_PRESETS[next][0]}`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const picks = options.filter((o): o is PlayerPick => o !== null);
    if (picks.length < 2) {
      setError("Pick at least 2 players.");
      return;
    }
    if (opinion && !deadline) {
      setError("Set a closing time for this poll.");
      return;
    }
    const [kind, val] = scoring.split(":");
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
      // The 4h cooldown / 5-vote bypass rule returns 429 — surface it in a modal.
      if (err instanceof ApiError && err.status === 429) {
        setCooldown(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Failed to create poll");
      }
    }
  };

  return (
    <div className="poll-create">
      <header className="poll-create__header">New poll</header>
      <form className="poll-create__form" onSubmit={submit}>
        <label className="poll-create__label">Sport</label>
        <select
          className="poll-create__select"
          value={sport}
          onChange={(e) => changeSport(e.target.value as Sport)}
        >
          <option value={Sport.FOOTBALL}>Football</option>
          <option value={Sport.BASEBALL}>Baseball</option>
        </select>

        <label className="poll-create__label">Question</label>
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

        <label className="poll-create__label">Scoring format</label>
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
        {options.map((opt, i) => (
          <PlayerSelect
            key={i}
            sport={sport}
            value={opt}
            onChange={(pick) => setOption(i, pick)}
            placeholder={`Player ${i + 1}`}
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
        {error && <p className="poll-create__error">{error}</p>}
        <button className="poll-create__submit">Post poll</button>
      </form>

      {cooldown && (
        <Modal title="Hang on — you're on cooldown" onClose={() => setCooldown(null)}>
          <p className="poll-create__cooldown-msg">{cooldown}</p>
          <div className="poll-create__cooldown-actions">
            <button
              type="button"
              className="poll-create__cooldown-vote"
              onClick={() => navigate("/explore")}
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
