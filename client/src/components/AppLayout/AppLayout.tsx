import { Link, NavLink, Outlet } from "react-router-dom";
import { useState, type ComponentType, type ReactNode } from "react";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import { useQuery } from "@tanstack/react-query";
import HomeIcon from "@mui/icons-material/Home";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SearchIcon from "@mui/icons-material/Search";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import SettingsIcon from "@mui/icons-material/Settings";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import type { Avatar as AvatarData } from "@leetpix/shared";
import { api } from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { RightRailContext } from "@/context/RightRailContext";
import { Avatar } from "@/components/Avatar/Avatar";
import { MobileDrawer } from "./MobileDrawer";
import "./AppLayout.scss";

type NavItem = { to: string; label: string; Icon: ComponentType<SvgIconProps> };

const NAV: NavItem[] = [
  { to: "/home", label: "Home", Icon: HomeIcon },
  { to: "/search", label: "Search", Icon: SearchIcon },
  { to: "/notifications", label: "Notifications", Icon: NotificationsIcon },
  { to: "/create", label: "Create", Icon: AddCircleIcon },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
];

// The core destinations for the mobile bottom bar (Create is a FAB; Settings is
// reached from the drawer). Profile is appended dynamically once we know /me.
const MOBILE_NAV: NavItem[] = [
  { to: "/home", label: "Home", Icon: HomeIcon },
  { to: "/search", label: "Search", Icon: SearchIcon },
  { to: "/notifications", label: "Notifications", Icon: NotificationsIcon },
];

// Three-column shell (left nav / feed / right rail), Twitter-style.
export function AppLayout() {
  const { theme, toggle } = useTheme();
  const { signOut } = useAuth();
  // Current user's username, for the profile link. Shares the ProfileEditor cache.
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () =>
      api.get<{ username: string; avatar: AvatarData }>("/profiles/me"),
  });
  // Unread notifications for the nav badge (polled, since there's no live push).
  const { data: unread } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => api.get<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 60_000,
  });

  // Content a page has injected into the right rail (e.g. filters).
  const [rail, setRail] = useState<ReactNode>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `app-layout__link${isActive ? " app-layout__link--active" : ""}`;
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `app-layout__tab${isActive ? " app-layout__tab--active" : ""}`;

  return (
    <RightRailContext.Provider value={setRail}>
      <div className="app-layout">
      <nav className="app-layout__nav">
        <div className="app-layout__brand">LeetPix</div>
        {NAV.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={linkClass}>
            <span className="app-layout__icon-wrap">
              <Icon className="app-layout__icon" />
              {to === "/notifications" && (unread?.count ?? 0) > 0 && (
                <span className="app-layout__badge">{unread!.count}</span>
              )}
            </span>
            {label}
          </NavLink>
        ))}
        {me && (
          <NavLink to={`/u/${me.username}`} className={linkClass}>
            <span className="app-layout__avatar">
              <Avatar avatar={me.avatar} size={24} />
            </span>
            Profile
          </NavLink>
        )}
        <button className="app-layout__theme" onClick={toggle}>
          {theme === "dark" ? (
            <LightModeIcon className="app-layout__icon" />
          ) : (
            <DarkModeIcon className="app-layout__icon" />
          )}
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <button className="app-layout__signout" onClick={signOut}>
          <LogoutIcon className="app-layout__icon" />
          Sign out
        </button>
      </nav>

      <main className="app-layout__main">
        <Outlet />
      </main>

        <aside className="app-layout__rail">
          {rail ?? (
            <div className="app-layout__panel">Trends &amp; suggestions</div>
          )}
        </aside>

        {/* Mobile-only: floating compose button + fixed bottom tab bar. */}
        <Link to="/create" className="app-layout__fab" aria-label="Create poll">
          <AddCircleIcon />
        </Link>
        <nav className="app-layout__mobile-nav">
          {MOBILE_NAV.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={tabClass} aria-label={label}>
              <span className="app-layout__icon-wrap">
                <Icon className="app-layout__tab-icon" />
                {to === "/notifications" && (unread?.count ?? 0) > 0 && (
                  <span className="app-layout__badge">{unread!.count}</span>
                )}
              </span>
            </NavLink>
          ))}
          {me && (
            <NavLink
              to={`/u/${me.username}`}
              className={tabClass}
              aria-label="Profile"
            >
              <Avatar avatar={me.avatar} size={26} />
            </NavLink>
          )}
          <button
            type="button"
            className="app-layout__tab"
            aria-label="More"
            onClick={() => setDrawerOpen(true)}
          >
            <MenuIcon className="app-layout__tab-icon" />
          </button>
        </nav>

        {drawerOpen && (
          <MobileDrawer rail={rail} onClose={() => setDrawerOpen(false)} />
        )}
      </div>
    </RightRailContext.Provider>
  );
}
