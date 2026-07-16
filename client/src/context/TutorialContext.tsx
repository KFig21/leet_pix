import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { OnboardingModal } from "@/components/Onboarding/OnboardingModal";

interface TutorialValue {
  // Manually (re)open the walkthrough, e.g. from Settings.
  openTutorial: () => void;
}

const TutorialContext = createContext<TutorialValue | undefined>(undefined);

// One flag per user per device — first sign-in shows the walkthrough once.
const storageKey = (id: string) => `leetpix.onboarded.${id}`;

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [open, setOpen] = useState(false);

  // Auto-open on a user's first authenticated session (until dismissed once).
  useEffect(() => {
    if (!userId) return;
    try {
      if (!localStorage.getItem(storageKey(userId))) setOpen(true);
    } catch {
      /* storage unavailable (private mode) — just skip the walkthrough */
    }
  }, [userId]);

  const dismiss = () => {
    setOpen(false);
    if (userId) {
      try {
        localStorage.setItem(storageKey(userId), "1");
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
