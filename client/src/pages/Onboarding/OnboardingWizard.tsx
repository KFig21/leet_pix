import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import type { Avatar as AvatarData } from "@leetpix/shared";
import { api, ApiError } from "@/lib/api";
import { usePreferences } from "@/context/PreferencesContext";
import { Loader } from "@/components/Loader/Loader";
import { Toggle } from "@/components/Toggle/Toggle";
import { AvatarEditor } from "@/pages/Profile/components/AvatarEditor/AvatarEditor";
import { PollViewCustomizer } from "@/pages/Settings/components/PollViewCustomizer/PollViewCustomizer";
import { LeagueCreatorPage } from "@/pages/LeagueCreator/LeagueCreatorPage";
import { ScoringFormatCreatorPage } from "@/pages/ScoringFormatCreator/ScoringFormatCreatorPage";
import "./OnboardingPage.scss";

interface MeProfile {
  username: string;
  displayName: string;
  bio: string | null;
  avatar: AvatarData;
}

const DEFAULT_AVATAR: AvatarData = {
  bgColor: "#2fa84f",
  shape: "circle",
  icon: "football",
  iconColor: "#ffffff",
};

// Step metadata (index === wizard step). `skippable` shows a Skip control.
interface StepMeta {
  title: string;
  subtitle: string;
  skippable?: boolean;
}
const STEPS: StepMeta[] = [
  { title: "Welcome to LeetPix", subtitle: "Let's get your account set up." },
  { title: "Pick a username", subtitle: "This is your @handle. It has to be unique." },
  { title: "Choose an avatar", subtitle: "Pick an icon or emoji and colors." },
  { title: "Add a bio", subtitle: "Tell people about your fantasy takes.", skippable: true },
  { title: "Set up a league", subtitle: "Attach your real scoring so polls are judged by your rules.", skippable: true },
  { title: "Create a scoring format", subtitle: "Or build a custom scoring format from scratch.", skippable: true },
  { title: "Voting confirmation", subtitle: "Decide whether votes need a confirm tap." },
  { title: "Customize your poll view", subtitle: "Hide any details you don't want on cards." },
];

const LAST = STEPS.length - 1;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

interface Props {
  startStep: number;
}

export function OnboardingWizard({ startStep }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { confirmVotes, setConfirmVotes } = usePreferences();

  const [step, setStep] = useState(Math.min(Math.max(startStep, 0), LAST));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<AvatarData>(DEFAULT_AVATAR);

  // Prefill from the profile (a resuming user may already have some fields).
  // New users have no row yet, so tolerate a 404.
  // Separate key from the shared ["me"] query (used by AppLayout/Tutorial with a
  // non-tolerant queryFn) so the two don't clash on the same cache entry.
  const meQuery = useQuery({
    queryKey: ["onboarding-me"],
    queryFn: async () => {
      try {
        return await api.get<MeProfile>("/profiles/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
  });
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || meQuery.data === undefined) return;
    prefilled.current = true;
    const me = meQuery.data;
    if (!me) return;
    if (me.username && !me.username.startsWith("user_")) setUsername(me.username);
    if (me.avatar) setAvatar({ ...DEFAULT_AVATAR, ...me.avatar });
    if (me.bio) setBio(me.bio);
  }, [meQuery.data]);

  // ── Username availability (debounced) ──────────────────────────────────────
  const [debouncedName, setDebouncedName] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(username.trim()), 350);
    return () => clearTimeout(t);
  }, [username]);
  const formatValid = USERNAME_RE.test(debouncedName);
  const availQuery = useQuery({
    queryKey: ["username-available", debouncedName],
    queryFn: () =>
      api.get<{ available: boolean; valid: boolean }>(
        `/profiles/username-available?u=${encodeURIComponent(debouncedName)}`,
      ),
    enabled: formatValid,
    staleTime: 30_000,
  });
  const checking =
    username.trim() !== debouncedName || (formatValid && availQuery.isFetching);
  const available = formatValid && availQuery.data?.available === true;

  // ── Navigation ─────────────────────────────────────────────────────────────
  // Persist the resume point best-effort; no need to refetch status mid-session
  // (the wizard owns `step` locally, and completion is handled in finish()).
  const persistStep = (n: number) => {
    api.patch("/profiles/me/onboarding", { step: n }).catch(() => {});
  };
  const go = (n: number) => {
    const clamped = Math.min(Math.max(n, 0), LAST);
    setStep(clamped);
    setError(null);
    persistStep(clamped);
  };

  const saveProfile = async (patch: Partial<MeProfile>) => {
    await api.put("/profiles/me", patch);
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const handleNext = async () => {
    setError(null);
    setBusy(true);
    try {
      if (step === 1) {
        await saveProfile({ username: debouncedName, displayName: debouncedName });
      } else if (step === 2) {
        await saveProfile({ avatar });
      } else if (step === 3) {
        await saveProfile({ bio: bio.trim() });
      }
      go(step + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.patch("/profiles/me/onboarding", { complete: true });
      // Flip the gate's cached status immediately so /home doesn't bounce back.
      qc.setQueryData(["onboarding-status"], { step: LAST, completed: true });
      navigate("/home", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't finish setup");
      setBusy(false);
    }
  };

  const meta = STEPS[step];

  return (
    <div className="onboard">
      <div className="onboard__card">
        <div className="onboard__progress">
          <span className="onboard__step-count">
            {step + 1} / {STEPS.length}
          </span>
          <div className="onboard__bar" aria-hidden>
            <div
              className="onboard__bar-fill"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <h1 className="onboard__title">{meta.title}</h1>
        <p className="onboard__subtitle">{meta.subtitle}</p>

        <div className="onboard__body">
          {step === 0 && <WelcomeStep />}

          {step === 1 && (
            <div className="onboard__field">
              <div className="onboard__username">
                <span className="onboard__at">@</span>
                <input
                  className="onboard__input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  autoFocus
                  maxLength={20}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <UsernameHint
                value={username}
                checking={checking}
                available={available}
                formatValid={formatValid}
                debounced={debouncedName}
              />
            </div>
          )}

          {step === 2 && <AvatarEditor value={avatar} onChange={setAvatar} />}

          {step === 3 && (
            <div className="onboard__field">
              <textarea
                className="onboard__textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="e.g. Dynasty degenerate. Bengals till I die."
                maxLength={160}
                rows={3}
              />
              <span className="onboard__counter">{bio.length}/160</span>
            </div>
          )}

          {step === 4 && (
            <div className="onboard__embed">
              <LeagueCreatorPage embedded onSaved={() => go(step + 1)} />
            </div>
          )}

          {step === 5 && (
            <div className="onboard__embed">
              <ScoringFormatCreatorPage embedded onSaved={() => go(step + 1)} />
            </div>
          )}

          {step === 6 && (
            <label className="onboard__toggle-row">
              <span>
                <span className="onboard__toggle-label">Confirm each vote</span>
                <span className="onboard__toggle-help">
                  When on, voting is a two-step tap so you don't miscast. You can
                  change this anytime in Settings.
                </span>
              </span>
              <Toggle
                checked={confirmVotes}
                onChange={setConfirmVotes}
                aria-label="Confirm each vote"
              />
            </label>
          )}

          {step === 7 && <PollViewCustomizer />}
        </div>

        {error && (
          <p className="onboard__error">
            <ErrorOutlineIcon fontSize="small" /> {error}
          </p>
        )}

        <div className="onboard__actions">
          <button
            type="button"
            className="onboard__back"
            onClick={() => go(step - 1)}
            disabled={step === 0 || busy}
          >
            Back
          </button>

          <div className="onboard__actions-right">
            {meta.skippable && (
              <button
                type="button"
                className="onboard__skip"
                onClick={() => go(step + 1)}
                disabled={busy}
              >
                {step === 4 || step === 5 ? "Skip for now" : "Skip"}
              </button>
            )}

            {/* Steps 4/5 commit via the embedded creator's own button, so the
                wizard only offers Skip there. */}
            {step === LAST ? (
              <button
                type="button"
                className="onboard__next"
                onClick={finish}
                disabled={busy}
              >
                {busy ? "Finishing…" : "Finish"}
              </button>
            ) : step === 4 || step === 5 ? null : (
              <button
                type="button"
                className="onboard__next"
                onClick={handleNext}
                disabled={busy || (step === 1 && !available)}
              >
                {busy ? "Saving…" : step === 0 ? "Get started" : "Next"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeStep() {
  const items = [
    "Pick your username and avatar",
    "Add a bio (optional)",
    "Set up a league & scoring (optional)",
    "Choose your voting & poll-view preferences",
  ];
  return (
    <div className="onboard__welcome">
      <p className="onboard__welcome-lead">
        LeetPix is where you settle fantasy debates — post start/sit, add/drop,
        and keeper polls, and let the crowd (graded against real box scores)
        weigh in. First, a quick setup:
      </p>
      <ul className="onboard__welcome-list">
        {items.map((t) => (
          <li key={t}>
            <CheckCircleIcon fontSize="small" /> {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UsernameHint({
  value,
  checking,
  available,
  formatValid,
  debounced,
}: {
  value: string;
  checking: boolean;
  available: boolean;
  formatValid: boolean;
  debounced: string;
}) {
  if (!value.trim()) {
    return <span className="onboard__hint">3–20 letters, numbers, or underscores.</span>;
  }
  if (!formatValid && debounced) {
    return (
      <span className="onboard__hint onboard__hint--bad">
        <ErrorOutlineIcon fontSize="small" /> 3–20 letters, numbers, or underscores only.
      </span>
    );
  }
  if (checking) {
    return (
      <span className="onboard__hint">
        <Loader size={14} center={false} /> Checking…
      </span>
    );
  }
  if (available) {
    return (
      <span className="onboard__hint onboard__hint--good">
        <CheckCircleIcon fontSize="small" /> @{debounced} is available
      </span>
    );
  }
  return (
    <span className="onboard__hint onboard__hint--bad">
      <ErrorOutlineIcon fontSize="small" /> @{debounced} is taken
    </span>
  );
}
