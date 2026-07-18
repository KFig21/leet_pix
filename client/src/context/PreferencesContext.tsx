import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// Which secondary pieces of a poll option to show on cards. Player name and the
// vote share always show; everything here is optional so users can de-clutter.
export interface PollCardPrefs {
  projection: boolean; // PROJ / season projection number
  position: boolean; // QB / WR / … chip
  team: boolean; // team badge (desktop) / color dot (mobile)
  matchup: boolean; // opponent + kickoff time
  injury: boolean; // injury designation (Q / OUT / …)
  streak: boolean; // hot/cold streak badge
  keeperCost: boolean; // keeper round · pick cost
  voterAvatars: boolean; // stack of recent voter avatars
  voteCount: boolean; // "You & 3 others" / "12 votes" tally
  stats: boolean; // resolved stat line ("9 rec · 154 yds")
}

export const DEFAULT_POLL_CARD_PREFS: PollCardPrefs = {
  projection: true,
  position: true,
  team: true,
  matchup: true,
  injury: true,
  streak: true,
  keeperCost: true,
  voterAvatars: true,
  voteCount: true,
  stats: true,
};

// "Simple" preset — every optional field off, for a bare-bones card.
export const SIMPLE_POLL_CARD_PREFS: PollCardPrefs = (
  Object.keys(DEFAULT_POLL_CARD_PREFS) as (keyof PollCardPrefs)[]
).reduce((acc, k) => ({ ...acc, [k]: false }), {} as PollCardPrefs);

// Order + labels for the settings customizer (drives the toggle list).
export const POLL_CARD_PREF_FIELDS: { key: keyof PollCardPrefs; label: string }[] =
  [
    { key: "projection", label: "Projected points" },
    { key: "position", label: "Position" },
    { key: "team", label: "Team" },
    { key: "matchup", label: "Matchup & kickoff" },
    { key: "injury", label: "Injury status" },
    { key: "streak", label: "Hot/cold streak" },
    { key: "keeperCost", label: "Keeper cost" },
    { key: "voterAvatars", label: "Voter avatars" },
    { key: "voteCount", label: "Vote tally" },
    { key: "stats", label: "Final stat line" },
  ];

interface PreferencesValue {
  // When true, voting is a two-step confirm instead of one tap.
  confirmVotes: boolean;
  setConfirmVotes: (v: boolean) => void;
  // Which poll-card fields to show.
  pollCard: PollCardPrefs;
  setPollCardPref: (key: keyof PollCardPrefs, value: boolean) => void;
  resetPollCard: () => void;
  // Apply the "Simple" preset (everything off).
  simplePollCard: () => void;
}

const PreferencesContext = createContext<PreferencesValue | undefined>(undefined);
const STORAGE_KEY = "leetpix-confirm-votes";
const POLL_CARD_KEY = "leetpix-pollcard-prefs";

// Read stored poll-card prefs, merged over defaults so fields added later
// default to visible rather than undefined.
function loadPollCardPrefs(): PollCardPrefs {
  try {
    const raw = localStorage.getItem(POLL_CARD_KEY);
    if (!raw) return DEFAULT_POLL_CARD_PREFS;
    return {
      ...DEFAULT_POLL_CARD_PREFS,
      ...(JSON.parse(raw) as Partial<PollCardPrefs>),
    };
  } catch {
    return DEFAULT_POLL_CARD_PREFS;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [confirmVotes, setConfirmVotes] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) === "true",
  );
  const [pollCard, setPollCard] = useState<PollCardPrefs>(loadPollCardPrefs);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(confirmVotes));
  }, [confirmVotes]);

  useEffect(() => {
    localStorage.setItem(POLL_CARD_KEY, JSON.stringify(pollCard));
  }, [pollCard]);

  const setPollCardPref = (key: keyof PollCardPrefs, value: boolean) =>
    setPollCard((prev) => ({ ...prev, [key]: value }));
  const resetPollCard = () => setPollCard(DEFAULT_POLL_CARD_PREFS);
  const simplePollCard = () => setPollCard(SIMPLE_POLL_CARD_PREFS);

  return (
    <PreferencesContext.Provider
      value={{
        confirmVotes,
        setConfirmVotes,
        pollCard,
        setPollCardPref,
        resetPollCard,
        simplePollCard,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx)
    throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
