import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { POLL_QUESTION_LABELS } from "@leetpix/shared";
import { api } from "@/lib/api";
import type { PollView, ProfileSummary } from "@/types";
import "./SearchPage.scss";

interface SearchResults {
  users: ProfileSummary[];
  polls: PollView[];
  formats: { id: string; name: string }[];
}

export function SearchPage() {
  const [q, setQ] = useState("");

  const { data } = useQuery({
    queryKey: ["search", q],
    queryFn: () => api.get<SearchResults>(`/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });

  return (
    <div className="search">
      <header className="search__header">
        <input
          className="search__input"
          placeholder="Search players, polls, people, formats…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </header>

      {data && (
        <div className="search__results">
          {data.users.map((u) => (
            <Link key={u.id} to={`/u/${u.username}`} className="search__row">
              @{u.username}
            </Link>
          ))}
          {data.polls.map((p) => (
            <Link key={p.id} to={`/polls/${p.id}`} className="search__row">
              {POLL_QUESTION_LABELS[p.questionType]}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
