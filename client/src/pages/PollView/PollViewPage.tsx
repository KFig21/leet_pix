import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { teamColor } from "@leetpix/shared";
import { api } from "@/lib/api";
import { PollCard } from "@/components/PollCard/PollCard";
import { UserRow } from "@/components/UserRow/UserRow";
import { Loader } from "@/components/Loader/Loader";
import type { PollDetail } from "@/types";
import "./PollViewPage.scss";

// In-depth poll view: votable card + a filterable breakdown of who voted for what.
export function PollViewPage() {
  const { id = "" } = useParams();
  const [filter, setFilter] = useState<string | null>(null); // optionId, or null = all

  const { data: poll } = useQuery({
    queryKey: ["poll", id],
    queryFn: () => api.get<PollDetail>(`/polls/${id}`),
  });

  if (!poll) return <Loader />;

  const totalVotes = poll.options.reduce((n, o) => n + (o._count?.votes ?? 0), 0);
  const shown = filter ? poll.options.filter((o) => o.id === filter) : poll.options;
  const rows = shown.flatMap((o) =>
    o.votes.map((v) => ({
      key: v.id,
      voter: v.voter,
      option: o.playerName,
      dotColor: teamColor(o.player?.team, poll.sport)?.bg ?? null,
    })),
  );

  return (
    <div className="poll-view">
      <header className="poll-view__header">Poll</header>
      <PollCard poll={poll} />

      <section className="poll-view__voters">
        <h2 className="poll-view__title">Who voted</h2>

        <div className="poll-view__filters">
          <button
            className={`poll-view__filter${filter === null ? " poll-view__filter--active" : ""}`}
            onClick={() => setFilter(null)}
          >
            All · {totalVotes}
          </button>
          {poll.options.map((o) => (
            <button
              key={o.id}
              className={`poll-view__filter${filter === o.id ? " poll-view__filter--active" : ""}`}
              onClick={() => setFilter(o.id)}
            >
              {o.playerName} · {o._count?.votes ?? 0}
            </button>
          ))}
        </div>

        <div className="poll-view__list">
          {rows.length === 0 ? (
            <p className="poll-view__msg">No votes yet.</p>
          ) : (
            rows.map((r) => (
              <UserRow
                key={r.key}
                profile={r.voter}
                // In "All" view, show which option each person picked.
                action={
                  filter === null ? (
                    <span className="poll-view__picked">
                      {r.dotColor && (
                        <span
                          className="poll-view__pick-dot"
                          style={{ background: r.dotColor }}
                        />
                      )}
                      {r.option}
                    </span>
                  ) : undefined
                }
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
