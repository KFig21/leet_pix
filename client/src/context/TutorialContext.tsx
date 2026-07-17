import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { api } from "@/lib/api";
import { OnboardingModal } from "@/components/Onboarding/OnboardingModal";

interface TutorialValue {
  // Manually (re)open the walkthrough, e.g. from Settings.
  openTutorial: () => void;
}

const TutorialContext = createContext<TutorialValue | undefined>(undefined);

// Legacy per-device flag. Kept only to migrate long-time users to the server
// flag silently (so the tutorial doesn't re-show once after this ships).
const legacyKey = (id: string) => `leetpix.onboarded.${id}`;

// Minimal slice of /profiles/me the tutorial cares about.
interface MeOnboarding {
  onboardedAt: string | null;
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Onboarding state now lives on the profile, so it persists across devices.
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<MeOnboarding>("/profiles/me"),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const markOnboarded = () => {
    // Optimistically flip the cached flag so nothing re-opens mid-session.
    qc.setQueryData<MeOnboarding>(["me"], (prev) =>
      prev ? { ...prev, onboardedAt: new Date().toISOString() } : prev,
    );
    api.post("/profiles/me/onboarded").catch(() => {
      /* best-effort — a failed stamp just means it may re-open next load */
    });
  };

  // Auto-open on a user's first authenticated session. If they've already
  // dismissed it on this device under the old localStorage scheme, backfill the
  // server flag silently instead of showing it again.
  useEffect(() => {
    if (!userId || !me || me.onboardedAt != null) return;
    let seenLocally = false;
    try {
      seenLocally = !!localStorage.getItem(legacyKey(userId));
    } catch {
      /* storage unavailable — treat as not seen */
    }
    if (seenLocally) markOnboarded();
    else setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, me]);

  const dismiss = () => {
    setOpen(false);
    markOnboarded();
    if (userId) {
      try {
        localStorage.setItem(legacyKey(userId), "1");
      } catch {
        /* ignore */
      }
    }
  };

  const openTutorial = () => setOpen(true);

  return (
    <TutorialContext.Provider value={{ openTutorial }}>
      {children}
      {open && <OnboardingModal onClose={dismiss} />}
    </TutorialContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
}
