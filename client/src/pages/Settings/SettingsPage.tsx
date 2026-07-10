import { Link } from "react-router-dom";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { usePreferences } from "@/context/PreferencesContext";
import { Toggle } from "@/components/Toggle/Toggle";
import "./SettingsPage.scss";

export function SettingsPage() {
  const { theme, toggle } = useTheme();
  const { signOut } = useAuth();
  const { confirmVotes, setConfirmVotes } = usePreferences();
  const isDark = theme === "dark";

  return (
    <div className="settings">
      <header className="settings__header">Settings</header>

      <section className="settings__section">
        <h2>Appearance</h2>
        <div className="settings__toggle-row">
          <span className="settings__label">Theme</span>
          <span className="settings__theme">
            <LightModeIcon
              className={`settings__theme-icon${!isDark ? " settings__theme-icon--active" : ""}`}
            />
            <Toggle checked={isDark} onChange={() => toggle()} aria-label="Dark mode" />
            <DarkModeIcon
              className={`settings__theme-icon${isDark ? " settings__theme-icon--active" : ""}`}
            />
          </span>
        </div>
      </section>

      <section className="settings__section">
        <h2>Voting</h2>
        <div className="settings__toggle-row">
          <span className="settings__label">Confirm votes before submitting</span>
          <Toggle
            checked={confirmVotes}
            onChange={setConfirmVotes}
            aria-label="Confirm votes"
          />
        </div>
        <p className="settings__hint">
          When on, tapping a poll option shows a “Confirm vote” button instead of
          voting immediately.
        </p>
      </section>

      <section className="settings__section">
        <h2>Scoring formats</h2>
        <Link to="/scoring/new" className="settings__row">
          Create a custom scoring format →
        </Link>
      </section>

      <section className="settings__section">
        <h2>Account</h2>
        <button className="settings__signout" onClick={signOut}>
          Sign out
        </button>
      </section>
    </div>
  );
}
