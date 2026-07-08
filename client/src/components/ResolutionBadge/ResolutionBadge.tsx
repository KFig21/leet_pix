import { useState } from "react";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import ForumIcon from "@mui/icons-material/Forum";
import {
  QUESTION_RESOLUTION,
  isScoreablePoll,
  isWindowedPoll,
  type PollQuestionType,
} from "@leetpix/shared";
import { Modal } from "@/components/Modal/Modal";
import "./ResolutionBadge.scss";

interface Props {
  questionType: PollQuestionType;
  evaluationWeeks?: number | null;
}

// Clickable badge — "Scored" or "Opinion" — that opens a modal explaining how
// (or whether) the poll affects the voter's record.
export function ResolutionBadge({ questionType, evaluationWeeks }: Props) {
  const [open, setOpen] = useState(false);
  const scoreable = isScoreablePoll(questionType);

  const windowText = isWindowedPoll(questionType)
    ? evaluationWeeks
      ? `${evaluationWeeks} wk${evaluationWeeks === 1 ? "" : "s"}`
      : "multi-week"
    : "next game";
  const window = isWindowedPoll(questionType)
    ? evaluationWeeks
      ? `over the next ${evaluationWeeks} week${evaluationWeeks === 1 ? "" : "s"}`
      : "over its evaluation window"
    : "in their next game";
  const target =
    QUESTION_RESOLUTION[questionType] === "LOW"
      ? "the fewest points"
      : "the most points";

  return (
    <>
      <button
        type="button"
        className={`resolution-badge resolution-badge--${scoreable ? "scored" : "opinion"}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {scoreable ? (
          <TrackChangesIcon className="resolution-badge__icon" />
        ) : (
          <ForumIcon className="resolution-badge__icon" />
        )}
        {scoreable ? `Scored · ${windowText}` : "Opinion"}
      </button>

      {open && (
        <Modal
          title={scoreable ? "Scored poll" : "Opinion poll"}
          onClose={() => setOpen(false)}
        >
          {scoreable ? (
            <div className="resolution-badge__body">
              <p>
                This poll has a right answer. When it resolves, the correct pick
                is the player who scores <strong>{target}</strong> {window}.
              </p>
              <p>
                Your vote here <strong>counts toward your record</strong> —
                accuracy, streaks, score, and your participation heat map. Picking
                a less popular option and being right is worth more.
              </p>
            </div>
          ) : (
            <div className="resolution-badge__body">
              <p>
                This is a subjective, opinion-based question, so there's no
                objective right answer to grade against.
              </p>
              <p>
                It locks and shows the <strong>community's consensus</strong>, but
                it <strong>doesn't affect your record</strong> — no accuracy or
                streak impact.
              </p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
