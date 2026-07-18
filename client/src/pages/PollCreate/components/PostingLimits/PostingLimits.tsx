import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { api } from "@/lib/api";
import { Modal } from "@/components/Modal/Modal";
import { Loader } from "@/components/Loader/Loader";
import "./PostingLimits.scss";

interface PostingStatus {
  maxPollsPerDay: number | null;
  cooldownMs: number;
  votesToBypassCooldown: number;
  postedToday: number;
  pollsLeftToday: number | null;
  onCooldown: boolean;
  cooldownRemainingMs: number;
  votesSinceLastPoll: number;
  votesNeededToBypass: number;
  canPostNow: boolean;
}

// "4 hours" / "30 minutes" for the rule text.
function humanDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min % 60 === 0) {
    const h = min / 60;
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  return `${min} minute${min === 1 ? "" : "s"}`;
}

// "2h 5m" / "8m" for the live countdown (rounds up so it never reads 0m early).
function humanRemaining(ms: number): string {
  const totalMin = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Info affordance for the create screen: explains the daily cap + cooldown and
// shows the user's live standing (how many polls left, cooldown remaining, votes
// needed to skip the wait).
export function PostingLimits() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="posting-limits__trigger"
        onClick={() => setOpen(true)}
        aria-label="Posting limits"
        title="Posting limits"
      >
        <InfoOutlinedIcon fontSize="small" />
      </button>
      {open && <LimitsModal onClose={() => setOpen(false)} />}
    </>
  );
}

function LimitsModal({ onClose }: { onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["posting-status"],
    queryFn: () => api.get<PostingStatus>("/polls/posting-status"),
    staleTime: 30_000,
  });

  return (
    <Modal title="Posting limits" onClose={onClose}>
      <div className="posting-limits">
        {isLoading ? (
          <Loader />
        ) : isError || !data ? (
          <p className="posting-limits__body">Couldn't load your limits.</p>
        ) : data.maxPollsPerDay == null && data.cooldownMs === 0 ? (
          <p className="posting-limits__body">
            You have no posting limits. Post as much as you like. 🎉
          </p>
        ) : (
          <>
            {/* Daily cap */}
            <section className="posting-limits__section">
              <h3 className="posting-limits__heading">Daily limit</h3>
              <p className="posting-limits__body">
                You can post up to{" "}
                <strong>{plural(data.maxPollsPerDay ?? 0, "poll")}</strong> a day.
              </p>
              {data.pollsLeftToday != null && (
                <p
                  className={`posting-limits__status${
                    data.pollsLeftToday === 0 ? " posting-limits__status--bad" : ""
                  }`}
                >
                  {data.pollsLeftToday === 0
                    ? "You've hit today's limit — try again tomorrow."
                    : `${plural(data.pollsLeftToday, "poll")} left today.`}
                </p>
              )}
            </section>

            {/* Cooldown + vote-to-bypass */}
            {data.cooldownMs > 0 && (
              <section className="posting-limits__section">
                <h3 className="posting-limits__heading">Cooldown</h3>
                <p className="posting-limits__body">
                  After you post, there's a{" "}
                  <strong>{humanDuration(data.cooldownMs)}</strong> wait before
                  your next poll
                  {data.votesToBypassCooldown > 0 ? (
                    <>
                      {" "}
                      — or vote on{" "}
                      <strong>
                        {plural(data.votesToBypassCooldown, "poll")}
                      </strong>{" "}
                      from other people to skip it. Voting keeps the crowd honest
                      and gets you posting again sooner.
                    </>
                  ) : (
                    "."
                  )}
                </p>
                <p
                  className={`posting-limits__status${
                    data.onCooldown ? " posting-limits__status--bad" : " posting-limits__status--good"
                  }`}
                >
                  {data.onCooldown
                    ? `On cooldown for ${humanRemaining(
                        data.cooldownRemainingMs,
                      )}${
                        data.votesNeededToBypass > 0
                          ? ` — or vote on ${plural(
                              data.votesNeededToBypass,
                              "more poll",
                            )} to post now.`
                          : "."
                      }`
                    : data.canPostNow
                      ? "You can post right now."
                      : ""}
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
