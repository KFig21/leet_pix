import { useCallback, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import SettingsIcon from "@mui/icons-material/Settings";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LogoutIcon from "@mui/icons-material/Logout";
import CloseIcon from "@mui/icons-material/Close";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import "./MobileDrawer.scss";

interface Props {
  // The current page's injected right-rail content (filters), if any.
  rail: ReactNode;
  onClose: () => void;
}

// Matches the slide/fade-out duration below so the exit animation finishes
// before we actually unmount.
const CLOSE_MS = 200;

// Bottom-sheet "More" menu for phones: the destinations that don't fit the tab
// bar (Settings, theme, sign out) plus the page's filters when it provides them.
export function MobileDrawer({ rail, onClose }: Props) {
  const { theme, toggle } = useTheme();
  const { signOut } = useAuth();
  const isDark = theme === "dark";

  // Play the exit animation, then unmount.
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  return (
    <div
      className={`mobile-drawer${closing ? " mobile-drawer--closing" : ""}`}
      onClick={requestClose}
    >
      {/* Floating close, sitting just above the "More" tab it opened from. */}
      <button
        className="mobile-drawer__close"
        onClick={requestClose}
        aria-label="Close menu"
      >
        <CloseIcon />
      </button>
      <div className="mobile-drawer__sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-drawer__handle" />

        {/* PollFilters renders its own "Filters" heading — no need to repeat it here. */}
        {rail && <div className="mobile-drawer__section">{rail}</div>}

        <div
          className={`mobile-drawer__menu${rail ? " mobile-drawer__menu--divided" : ""}`}
        >
          <Link
            to="/settings"
            className="mobile-drawer__item"
            onClick={requestClose}
          >
            <SettingsIcon /> Settings
          </Link>
          <button className="mobile-drawer__item" onClick={toggle}>
            {isDark ? <LightModeIcon /> : <DarkModeIcon />}
            {isDark ? "Light mode" : "Dark mode"}
          </button>
          <button
            className="mobile-drawer__item mobile-drawer__item--danger"
            onClick={signOut}
          >
            <LogoutIcon /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
