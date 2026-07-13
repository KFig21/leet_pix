import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Sport, PlayerStreak } from "@leetpix/shared";
import { api } from "@/lib/api";
import { Loader } from "@/components/Loader/Loader";
import { PlayerMeta } from "@/components/PlayerMeta/PlayerMeta";
import { TeamTag } from "@/components/TeamTag/TeamTag";
import { StreakBadge } from "@/components/StreakBadge/StreakBadge";
import type { PlayerGame } from "@/types";
import "./PlayerSelect.scss";

interface PlayerResult {
  id: string;
  fullName: string;
  team: string | null;
  position: string | null;
  sport: Sport;
  injuryStatus: string | null;
  streak: PlayerStreak | null;
  game: PlayerGame | null;
}

export interface PlayerPick {
  playerId: string;
  playerName: string;
  // Keeper polls: the draft round forfeited to keep this player.
  keeperRound?: number | null;
  // Extra context carried for the live preview (stripped server-side on create).
  team?: string | null;
  position?: string | null;
  injuryStatus?: string | null;
  game?: PlayerGame | null;
}

interface Props {
  sport: Sport;
  value: PlayerPick | null;
  onChange: (pick: PlayerPick | null) => void;
  placeholder?: string;
  // Optional shared filters from the create screen; when either is non-empty the
  // menu can browse (list players) without a typed query.
  teams?: string[];
  positions?: string[];
  // Player ids already chosen in other option slots — hidden from this menu so a
  // player can't be picked twice.
  excludeIds?: string[];
}

// Searchable player dropdown backed by our own /players endpoint. Type to filter
// (debounced), pick one, and it emits { playerId, playerName } for the poll.
export function PlayerSelect({
  sport,
  value,
  onChange,
  placeholder,
  teams = [],
  positions = [],
  excludeIds = [],
}: Props) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const hasFilter = teams.length > 0 || positions.length > 0;
  // Enough to query: a typed query (>=2 chars) or an active team/position filter.
  const ready = debounced.length >= 2 || hasFilter;
  const teamKey = teams.join(",");
  const positionKey = positions.join(",");

  const { data: results, isFetching } = useQuery({
    queryKey: ["players", sport, debounced, teamKey, positionKey],
    queryFn: () => {
      const params = new URLSearchParams({ sport, q: debounced });
      if (teamKey) params.set("team", teamKey);
      if (positionKey) params.set("position", positionKey);
      return api.get<PlayerResult[]>(`/players?${params.toString()}`);
    },
    enabled: open && ready,
  });

  // Hide players already picked in other slots so none can be chosen twice.
  const visible = (results ?? []).filter((p) => !excludeIds.includes(p.id));

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
          <span className="player-select__selected-main">
            <TeamTag abbr={value.team} sport={sport} />
            <span className="player-select__selected-name">{value.playerName}</span>
            <PlayerMeta injuryStatus={value.injuryStatus} game={value.game} />
          </span>
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
        placeholder={
          placeholder ?? (hasFilter ? "Search or browse…" : "Search players…")
        }
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && ready && (
        <ul className="player-select__menu">
          {isFetching && (
            <li className="player-select__msg">
              <Loader size={16} center={false} /> Searching…
            </li>
          )}
          {!isFetching && visible.length === 0 && (
            <li className="player-select__msg">No players found</li>
          )}
          {visible.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="player-select__option"
                onClick={() => {
                  onChange({
                    playerId: p.id,
                    playerName: p.fullName,
                    team: p.team,
                    position: p.position,
                    injuryStatus: p.injuryStatus,
                    game: p.game,
                  });
                  setOpen(false);
                  setSearch("");
                }}
              >
                <span className="player-select__lead">
                  <span className="player-select__name">{p.fullName}</span>
                  <PlayerMeta
                    className="player-select__game"
                    injuryStatus={p.injuryStatus}
                    game={p.game}
                  />
                </span>
                <span className="player-select__pos-team">
                  <StreakBadge streak={p.streak} />
                  {p.position && <span>{p.position}</span>}
                  <TeamTag abbr={p.team} sport={sport} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
