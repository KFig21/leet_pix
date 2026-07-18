import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ComponentType } from "react";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import HowToVoteIcon from "@mui/icons-material/HowToVote";
import InsightsIcon from "@mui/icons-material/Insights";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import "./OnboardingModal.scss";

interface Slide {
  Icon: ComponentType<SvgIconProps>;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    Icon: HowToVoteIcon,
    title: "Make your pick",
    body: "On any open poll, tap a player to cast your vote. You'll instantly see how the crowd voted as a percentage next to each option.",
  },
  {
    Icon: InsightsIcon,
    title: "Read the card",
    body: "“PROJ” is a player's projected fantasy points for the poll's scoring. Tap the scoring or league badge to see exactly how those points are counted.",
  },
  {
    Icon: ViewAgendaIcon,
    title: "Make it yours",
    body: "Cards feel busy? Head to Settings → Poll view to hide the fields you don't need — or tap Simple for a clean, no-frills layout. You can switch back anytime.",
  },
  {
    Icon: AddCircleIcon,
    title: "Ask the crowd",
    body: "Hit Create to post your own start, sit, add, drop, trade, or keeper poll. Attach your league's scoring so voters judge it by your rules.",
  },
  {
    Icon: LeaderboardIcon,
    title: "Build your record",
    body: "Every pick grades against real box scores. Your Profile tracks accuracy, streaks, and a heat map — tap any day to review the calls you made.",
  },
];

interface Props {
  onClose: () => void;
}

// First-run walkthrough. A self-contained overlay (not the shared Modal) so it
// owns its stepper footer + progress dots. Esc / backdrop / Skip all dismiss.
export function OnboardingModal({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const last = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const next = () => (last ? onClose() : setStep((s) => s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return createPortal(
    <div className="onboarding" onClick={onClose}>
      <div
        className="onboarding__card"
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to LeetPix"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="onboarding__skip"
          onClick={onClose}
          aria-label="Skip tutorial"
        >
          Skip
        </button>

        <div className="onboarding__icon">
          <slide.Icon />
        </div>
        <p className="onboarding__eyebrow">
          {step === 0 ? "Welcome to LeetPix 👋" : `Step ${step + 1} of ${SLIDES.length}`}
        </p>
        <h2 className="onboarding__title">{slide.title}</h2>
        <p className="onboarding__body">{slide.body}</p>

        <div className="onboarding__dots" aria-hidden="true">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`onboarding__dot${i === step ? " onboarding__dot--on" : ""}`}
            />
          ))}
        </div>

        <div className="onboarding__actions">
          <button
            type="button"
            className="onboarding__back"
            onClick={back}
            disabled={step === 0}
          >
            Back
          </button>
          <button type="button" className="onboarding__next" onClick={next}>
            {last ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
