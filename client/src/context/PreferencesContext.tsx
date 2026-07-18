import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";

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

// Legacy pre-scoping keys: one shared bucket for the whole browser, regardless
// of which account was signed in. That let two accounts on the same device
// silently overwrite each other's settings. Keys below are now scoped per user
// (`.${userId}` suffix); the legacy bucket is migrated into the first user who
// loads after this ships, then cleared so it can't leak into anyone else's.
const LEGACY_CONFIRM_KEY = "leetpix-confirm-votes";
const LEGACY_POLL_CARD_KEY = "leetpix-pollcard-prefs";
const confirmVotesKey = (userId: string) => `${LEGACY_CONFIRM_KEY}.${userId}`;
const pollCardKey = (userId: string) => `${LEGACY_POLL_CARD_KEY}.${userId}`;

function loadConfirmVotes(userId: string): boolean {
  try {
    const scoped = localStorage.getItem(confirmVotesKey(userId));
    if (scoped != null) return scoped === "true";
    const legacy = localStorage.getItem(LEGACY_CONFIRM_KEY);
    if (legacy != null) {
      localStorage.removeItem(LEGACY_CONFIRM_KEY);
      localStorage.setItem(confirmVotesKey(userId), legacy);
      return legacy === "true";
    }
  } catch {
    /* storage unavailable — default */
  }
  return false;
}

// Read this user's stored poll-card prefs, merged over defaults so fields added
// later default to visible rather than undefined.
function loadPollCardPrefs(userId: string): PollCardPrefs {
  try {
    const scoped = localStorage.getItem(pollCardKey(userId));
    if (scoped) {
      return {
        ...DEFAULT_POLL_CARD_PREFS,
        ...(JSON.parse(scoped) as Partial<PollCardPrefs>),
      };
    }
    const legacy = localStorage.getItem(LEGACY_POLL_CARD_KEY);
    if (legacy) {
      localStorage.removeItem(LEGACY_POLL_CARD_KEY);
      const merged = {
        ...DEFAULT_POLL_CARD_PREFS,
        ...(JSON.parse(legacy) as Partial<PollCardPrefs>),
      };
      localStorage.setItem(pollCardKey(userId), JSON.stringify(merged));
      return merged;
    }
  } catch {
    /* storage unavailable or corrupt — default */
  }
  return DEFAULT_POLL_CARD_PREFS;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [confirmVotes, setConfirmVotes] = useState(false);
  const [pollCard, setPollCard] = useState<PollCardPrefs>(DEFAULT_POLL_CARD_PREFS);

  // Load this user's own stored prefs whenever the signed-in user changes —
  // covers switching accounts on the same device without a full page reload.
  // Signing out (userId -> null) resets to defaults so nothing lingers on a
  // shared device between sessions.
  useEffect(() => {
    if (!userId) {
      setConfirmVotes(false);
      setPollCard(DEFAULT_POLL_CARD_PREFS);
      return;
    }
    setConfirmVotes(loadConfirmVotes(userId));
    setPollCard(loadPollCardPrefs(userId));
  }, [userId]);

  // Persist on change. Deliberately NOT triggered by `userId` (only read from
  // its closure): the load effect above updates confirmVotes/pollCard on a
  // user switch, and these effects are keyed on those values, so they fire
  // AFTER the load completes, writing the new user's own loaded value back
  // under the new user's key. If `userId` were also a trigger here, this
  // effect would fire immediately on the switch — before the load effect's
  // setState lands — and write the PREVIOUS user's still-in-state value under
  // the NEW user's key, contaminating it.
  useEffect(() => {
    if (!userId) return;
    localStorage.setItem(confirmVotesKey(userId), String(confirmVotes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmVotes]);

  useEffect(() => {
    if (!userId) return;
    localStorage.setItem(pollCardKey(userId), JSON.stringify(pollCard));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
