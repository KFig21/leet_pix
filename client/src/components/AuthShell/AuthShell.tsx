import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import SportsBaseballIcon from "@mui/icons-material/SportsBaseball";
import "./AuthShell.scss";

// Branded frame shared by every auth screen (login, register, forgot, reset):
// the landing page's glyph underlay + accent glow, a wordmark that links home,
// and a centered slot for the page's card. Keeps the whole signed-out flow
// visually consistent.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-page__bg" aria-hidden="true">
        <SportsFootballIcon className="auth-page__glyph auth-page__glyph--1" />
        <SportsBaseballIcon className="auth-page__glyph auth-page__glyph--2" />
        <SportsFootballIcon className="auth-page__glyph auth-page__glyph--3" />
      </div>

      <div className="auth-page__inner">
        <Link to="/" className="auth-page__wordmark">
          LeetPix
        </Link>
        {children}
      </div>
    </div>
  );
}

// Polished OAuth button with the multi-color Google mark. Self-contained SVG so
// it works under the artifact CSP / offline.
export function GoogleButton({
  onClick,
  label = "Continue with Google",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button type="button" className="auth-page__oauth" onClick={onClick}>
      <svg
        className="auth-page__oauth-icon"
        viewBox="0 0 48 48"
        width="18"
        height="18"
        aria-hidden="true"
      >
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
      {label}
    </button>
  );
}
