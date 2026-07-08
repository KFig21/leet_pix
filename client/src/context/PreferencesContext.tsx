import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface PreferencesValue {
  // When true, voting is a two-step confirm instead of one tap.
  confirmVotes: boolean;
  setConfirmVotes: (v: boolean) => void;
}

const PreferencesContext = createContext<PreferencesValue | undefined>(undefined);
const STORAGE_KEY = "leetpix-confirm-votes";

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [confirmVotes, setConfirmVotes] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) === "true",
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(confirmVotes));
  }, [confirmVotes]);

  return (
    <PreferencesContext.Provider value={{ confirmVotes, setConfirmVotes }}>
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
