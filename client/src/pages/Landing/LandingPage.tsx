import { Link, Navigate } from "react-router-dom";
import HowToVoteIcon from "@mui/icons-material/HowToVote";
import InsightsIcon from "@mui/icons-material/Insights";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupsIcon from "@mui/icons-material/Groups";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import SportsBaseballIcon from "@mui/icons-material/SportsBaseball";
import { useAuth } from "@/context/AuthContext";
import { Loader } from "@/components/Loader/Loader";
import "./LandingPage.scss";

const STEPS = [
  {
    n: 1,
    title: "Ask",
    body: "Post a start, sit, add, drop, trade, or keeper poll in seconds.",
  },
  {
    n: 2,
    title: "Vote",
    body: "Your league — and the wider crowd — weighs in on your call.",
  },
  {
    n: 3,
    title: "Track",
    body: "Every pick grades against real box scores. Build your record.",
  },
];

const FEATURES = [
  {
    Icon: InsightsIcon,
    title: "Crowd + projections",
    body: "See live vote share right next to each player's projected points.",
  },
  {
    Icon: GroupsIcon,
    title: "Your leagues, your rules",
    body: "PPR, superflex, 12-team keeper, custom scoring — set it once, reuse it.",
  },
  {
    Icon: EmojiEventsIcon,
    title: "A real pick record",
    body: "Accuracy, hot/cold streaks, and a heat map of every call you've made.",
  },
  {
    Icon: HowToVoteIcon,
    title: "Signal, not noise",
    body: "Hot streaks, upsets, and keeper costs surfaced where they matter.",
  },
];

// Public marketing splash for logged-out visitors. Authenticated users are
// bounced straight to their feed.
export function LandingPage() {
  const { session, loading } = useAuth();
  if (loading) return <Loader />;
  if (session) return <Navigate to="/home" replace />;

  return (
    <div className="landing">
      {/* Decorative sport-glyph underlay + dot grid (see LandingPage.scss). */}
      <div className="landing__bg" aria-hidden="true">
        <SportsFootballIcon className="landing__glyph landing__glyph--1" />
        <SportsBaseballIcon className="landing__glyph landing__glyph--2" />
        <SportsFootballIcon className="landing__glyph landing__glyph--3" />
        <SportsBaseballIcon className="landing__glyph landing__glyph--4" />
        <SportsFootballIcon className="landing__glyph landing__glyph--5" />
      </div>

      <header className="landing__bar">
        <span className="landing__wordmark">LeetPix</span>
        <Link to="/login" className="landing__signin">
          Sign in
        </Link>
      </header>

      <main className="landing__main">
        <section className="landing__hero">
          <h1 className="landing__headline">Settle every fantasy debate.</h1>
          <p className="landing__subhead">
            Poll your league on who to start, sit, add, or keep — then see what
            the crowd <em>and</em> the projections say. Every pick grades itself
            against real stats.
          </p>
          <div className="landing__cta">
            <Link to="/register" className="landing__btn landing__btn--primary">
              Create account
            </Link>
            <Link to="/login" className="landing__btn landing__btn--ghost">
              Sign in
            </Link>
          </div>
          <div className="landing__sports">
            <span className="landing__sport-chip">
              <SportsFootballIcon />
              Pro Football
            </span>
            <span className="landing__sport-chip">
              <SportsBaseballIcon />
              Baseball
            </span>
          </div>
          <p className="landing__note">Free to join</p>
        </section>

        <section className="landing__steps" aria-label="How it works">
          <h2 className="landing__section-title">How it works</h2>
          <ol className="landing__step-list">
            {STEPS.map((s) => (
              <li key={s.n} className="landing__step">
                <span className="landing__step-num">{s.n}</span>
                <div>
                  <h3 className="landing__step-title">{s.title}</h3>
                  <p className="landing__step-body">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing__features" aria-label="Features">
          {FEATURES.map((f) => (
            <div key={f.title} className="landing__feature">
              <f.Icon className="landing__feature-icon" />
              <h3 className="landing__feature-title">{f.title}</h3>
              <p className="landing__feature-body">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="landing__foot-cta">
          <h2 className="landing__foot-title">Ready to make your picks?</h2>
          <Link to="/register" className="landing__btn landing__btn--primary">
            Create your account
          </Link>
        </section>
      </main>

      <footer className="landing__footer">
        <span className="landing__wordmark landing__wordmark--sm">LeetPix</span>
        <span className="landing__footer-note">
          Fantasy picks, settled by the crowd.
        </span>
      </footer>
    </div>
  );
}
