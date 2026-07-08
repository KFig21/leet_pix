import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Sport } from "@leetpix/shared";
import { api } from "@/lib/api";
import { Loader } from "@/components/Loader/Loader";
import "./PlayerSelect.scss";

interface PlayerResult {
  id: string;
  fullName: string;
  team: string | null;
  position: string | null;
  sport: Sport;
}

export interface PlayerPick {
  playerId: string;
  playerName: string;
}

interface Props {
  sport: Sport;
  value: PlayerPick | null;
  onChange: (pick: PlayerPick | null) => void;
  placeholder?: string;
}

// Searchable player dropdown backed by our own /players endpoint. Type to filter
// (debounced), pick one, and it emits { playerId, playerName } for the poll.
export function PlayerSelect({ sport, value, onChange, placeholder }: Props) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["players", sport, debounced],
    queryFn: () =>
      api.get<PlayerResult[]>(
        `/players?sport=${sport}&q=${encodeURIComponent(debounced)}`,
      ),
    enabled: open && debounced.length >= 2,
  });

  // Close the menu on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (value) {
    return (
      <div className="player-select">
        <div className="player-select__selected">
          <span className="player-select__selected-name">{value.playerName}</span>
          <button
            type="button"
            className="player-select__clear"
            onClick={() => {
              onChange(null);
              setSearch("");
            }}
            aria-label="Clear"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="player-select" ref={ref}>
      <input
        className="player-select__input"
        placeholder={placeholder ?? "Search players…"}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && debounced.length >= 2 && (
        <ul className="player-select__menu">
          {isFetching && (
            <li className="player-select__msg">
              <Loader size={16} center={false} /> Searching…
            </li>
          )}
          {!isFetching && results?.length === 0 && (
            <li className="player-select__msg">No players found</li>
          )}
          {results?.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="player-select__option"
                onClick={() => {
                  onChange({ playerId: p.id, playerName: p.fullName });
                  setOpen(false);
                  setSearch("");
                }}
              >
                <span className="player-select__name">{p.fullName}</span>
                <span className="player-select__meta">
                  {[p.position, p.team].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
