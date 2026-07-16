import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { api } from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useTutorial } from "@/context/TutorialContext";
import { usePreferences } from "@/context/PreferencesContext";
import { Toggle } from "@/components/Toggle/Toggle";
import "./SettingsPage.scss";

interface FormatRow {
  id: string;
  name: string;
}
interface LeagueRow {
  id: string;
  name: string;
  numTeams: number;
}

export function SettingsPage() {
  const { theme, toggle } = useTheme();
  const { signOut } = useAuth();
  const { openTutorial } = useTutorial();
  const { confirmVotes, setConfirmVotes } = usePreferences();
  const qc = useQueryClient();
  const isDark = theme === "dark";

  const { data: leagues } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => api.get<LeagueRow[]>("/leagues"),
  });
  const { data: formats } = useQuery({
    queryKey: ["scoring-formats"],
    queryFn: () => api.get<FormatRow[]>("/scoring-formats"),
  });

  const remove = async (
    kind: "leagues" | "scoring-formats",
    id: string,
    name: string,
  ) => {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    await api.del(`/${kind}/${id}`);
    qc.invalidateQueries({ queryKey: [kind] });
  };

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
        <h2>Leagues</h2>
        {leagues?.map((l) => (
          <div key={l.id} className="settings__item">
            <span className="settings__item-name">
              {l.name}
              <span className="settings__item-meta">{l.numTeams}-team</span>
            </span>
            <span className="settings__item-actions">
              <Link
                to={`/leagues/${l.id}/edit`}
                className="settings__icon-btn"
                aria-label={`Edit ${l.name}`}
              >
                <EditIcon fontSize="small" />
              </Link>
              <button
                type="button"
                className="settings__icon-btn settings__icon-btn--danger"
                aria-label={`Delete ${l.name}`}
                onClick={() => remove("leagues", l.id, l.name)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </button>
            </span>
          </div>
        ))}
        {leagues?.length === 0 && (
          <p className="settings__hint">No leagues yet.</p>
        )}
        <Link to="/leagues/new" className="settings__row">
          Set up a league →
        </Link>
      </section>

      <section className="settings__section">
        <h2>Scoring formats</h2>
        {formats?.map((f) => (
          <div key={f.id} className="settings__item">
            <span className="settings__item-name">{f.name}</span>
            <span className="settings__item-actions">
              <Link
                to={`/scoring/${f.id}/edit`}
                className="settings__icon-btn"
                aria-label={`Edit ${f.name}`}
              >
                <EditIcon fontSize="small" />
              </Link>
              <button
                type="button"
                className="settings__icon-btn settings__icon-btn--danger"
                aria-label={`Delete ${f.name}`}
                onClick={() => remove("scoring-formats", f.id, f.name)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </button>
            </span>
          </div>
        ))}
        {formats?.length === 0 && (
          <p className="settings__hint">No custom formats yet.</p>
        )}
        <Link to="/scoring/new" className="settings__row">
          Create a custom scoring format →
        </Link>
      </section>

      <section className="settings__section">
        <h2>Help</h2>
        <button
          type="button"
          className="settings__row"
          onClick={openTutorial}
        >
          Replay the tutorial →
        </button>
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
