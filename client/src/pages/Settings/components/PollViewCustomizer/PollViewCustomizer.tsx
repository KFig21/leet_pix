import {
  PollHorizon,
  PollQuestionType,
  ScoringPreset,
  Sport,
  type Avatar,
} from "@leetpix/shared";
import { PollCard } from "@/components/PollCard/PollCard";
import { Toggle } from "@/components/Toggle/Toggle";
import {
  usePreferences,
  POLL_CARD_PREF_FIELDS,
  DEFAULT_POLL_CARD_PREFS,
} from "@/context/PreferencesContext";
import type { PollView } from "@/types";
import "./PollViewCustomizer.scss";

const AV = (bgColor: string, emoji: string): Avatar => ({
  bgColor,
  shape: "circle",
  emoji,
  iconColor: "#ffffff",
});

const AUTHOR = {
  id: "sample-author",
  username: "sample",
  displayName: "Sample",
  avatar: AV("#7c3aed", "🏈"),
};

const VOTERS = [
  { voter: { avatar: AV("#e8833a", "🔥") } },
  { voter: { avatar: AV("#3b82f6", "⚾") } },
  { voter: { avatar: AV("#16a34a", "🏆") } },
];

const BASE = {
  sport: Sport.FOOTBALL,
  horizon: PollHorizon.SEASON,
  status: "OPEN" as const,
  createdAt: new Date().toISOString(),
  author: AUTHOR,
  scoringPreset: ScoringPreset.FOOTBALL_PPR,
  scoringFormat: null,
  league: null,
  evaluationWeeks: null,
};

// A weekly "who should I start" poll — the common case.
const WEEKLY: PollView = {
  ...BASE,
  id: "preview-weekly",
  questionType: PollQuestionType.START,
  lockAt: null,
  myVoteOptionId: "w2",
  leagueSize: null,
  options: [
    {
      id: "w1",
      playerId: "w1",
      playerName: "Ja'Marr Chase",
      projectedPoints: 19.5,
      actualPoints: null,
      isWinner: false,
      player: {
        team: "CIN",
        position: "WR",
        injuryStatus: null,
        streak: { status: "hot", recentAvg: 22, baselineAvg: 15, games: 6 },
      },
      game: { opponent: "TB", atHome: true, kickoff: futureKick(3) },
      _count: { votes: 4 },
      votes: VOTERS.slice(0, 2),
    },
    {
      id: "w2",
      playerId: "w2",
      playerName: "Amon-Ra St. Brown",
      projectedPoints: 17.4,
      actualPoints: null,
      isWinner: false,
      player: { team: "DET", position: "WR", injuryStatus: "Questionable", streak: null },
      game: { opponent: "NO", atHome: true, kickoff: futureKick(3) },
      _count: { votes: 6 },
      votes: VOTERS,
    },
    {
      id: "w3",
      playerId: "w3",
      playerName: "CeeDee Lamb",
      projectedPoints: 15.8,
      actualPoints: null,
      isWinner: false,
      player: { team: "DAL", position: "WR", injuryStatus: null, streak: null },
      game: { opponent: "NYG", atHome: false, kickoff: futureKick(4) },
      _count: { votes: 2 },
      votes: VOTERS.slice(2, 3),
    },
  ],
};

// A keeper poll — different context (draft cost, no weekly matchup).
const KEEPER: PollView = {
  ...BASE,
  id: "preview-keeper",
  questionType: PollQuestionType.KEEP,
  lockAt: null,
  myVoteOptionId: null,
  leagueSize: 12,
  options: [
    {
      id: "k1",
      playerId: "k1",
      playerName: "Lamar Jackson",
      keeperRound: 3,
      keeperPick: 3,
      projectedPoints: 388.2,
      actualPoints: null,
      isWinner: false,
      player: { team: "BAL", position: "QB", injuryStatus: null, streak: null },
      game: null,
      _count: { votes: 3 },
      votes: VOTERS.slice(0, 3),
    },
    {
      id: "k2",
      playerId: "k2",
      playerName: "Josh Allen",
      keeperRound: 2,
      keeperPick: 10,
      projectedPoints: 402.6,
      actualPoints: null,
      isWinner: false,
      player: { team: "BUF", position: "QB", injuryStatus: null, streak: null },
      game: null,
      _count: { votes: 5 },
      votes: VOTERS.slice(0, 2),
    },
  ],
};

// Kickoff a few days out so the countdown reads naturally in the preview.
function futureKick(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

// Settings panel: toggle which fields appear on poll cards, with a live preview
// (a weekly and a keeper example, since the info shown differs by question).
export function PollViewCustomizer() {
  const { pollCard, setPollCardPref, resetPollCard } = usePreferences();
  const isDefault = POLL_CARD_PREF_FIELDS.every(
    ({ key }) => pollCard[key] === DEFAULT_POLL_CARD_PREFS[key],
  );

  return (
    <div className="poll-customizer">
      <div className="poll-customizer__head">
        <p className="settings__hint poll-customizer__hint">
          Hide the details you don't need to make cards easier to scan.
        </p>
        <button
          type="button"
          className="poll-customizer__reset"
          onClick={resetPollCard}
          disabled={isDefault}
        >
          Reset
        </button>
      </div>

      <div className="poll-customizer__toggles">
        {POLL_CARD_PREF_FIELDS.map(({ key, label }) => (
          <label key={key} className="poll-customizer__toggle">
            <span>{label}</span>
            <Toggle
              checked={pollCard[key]}
              onChange={(v) => setPollCardPref(key, v)}
              aria-label={label}
            />
          </label>
        ))}
      </div>

      <div className="poll-customizer__previews">
        <span className="poll-customizer__preview-label">Weekly matchup</span>
        <div className="poll-customizer__preview">
          <PollCard poll={WEEKLY} preview />
        </div>
        <span className="poll-customizer__preview-label">Keeper</span>
        <div className="poll-customizer__preview">
          <PollCard poll={KEEPER} preview />
        </div>
      </div>
    </div>
  );
}
