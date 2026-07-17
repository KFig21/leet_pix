import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Sport, PlayerStreak } from "@leetpix/shared";
import { api } from "@/lib/api";
import { formatProjection } from "@/lib/formatProjection";
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
  projectedPoints: number | null;
}

// Scoring context so the picker can show each candidate's projected points.
export interface ProjectionContext {
  questionType: string;
  leagueId?: string | null;
  scoringPreset?: string | null;
  scoringFormatId?: string | null;
  evaluationWeeks?: number | null;
}

export interface PlayerPick {
  playerId: string;
  playerName: string;
  // Keeper polls: the draft round (and optional pick) forfeited to keep this player.
  keeperRound?: number | null;
  keeperPick?: number | null;
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
  // Suppress the next-game line (e.g. keeper polls, where schedule is irrelevant).
  hideGame?: boolean;
  // Scoring context; when set, results show projected points (desktop only).
  projection?: ProjectionContext;
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
  hideGame = false,
  projection,
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

  // Scoring context (stringified) so results re-fetch when it changes.
  const projKey = projection
    ? [
        projection.questionType,
        projection.leagueId,
        projection.scoringPreset,
        projection.scoringFormatId,
        projection.evaluationWeeks,
      ].join("|")
    : "";

  const { data: results, isFetching } = useQuery({
    queryKey: ["players", sport, debounced, teamKey, positionKey, projKey],
    queryFn: () => {
      const params = new URLSearchParams({ sport, q: debounced });
      if (teamKey) params.set("team", teamKey);
      if (positionKey) params.set("position", positionKey);
      if (projection) {
        params.set("questionType", projection.questionType);
        if (projection.leagueId) params.set("leagueId", projection.leagueId);
        if (projection.scoringPreset)
          params.set("scoringPreset", projection.scoringPreset);
        if (projection.scoringFormatId)
          params.set("scoringFormatId", projection.scoringFormatId);
        if (projection.evaluationWeeks != null)
          params.set("evaluationWeeks", String(projection.evaluationWeeks));
      }
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
            <PlayerMeta
              injuryStatus={value.injuryStatus}
              game={hideGame ? null : value.game}
            />
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
                <TeamTag abbr={p.team} sport={sport} />
                {p.position && (
                  <span className="player-select__pos">{p.position}</span>
                )}
                <span className="player-select__name">{p.fullName}</span>
                <PlayerMeta
                  className="player-select__game"
                  injuryStatus={p.injuryStatus}
                  game={hideGame ? null : p.game}
                />
                <StreakBadge streak={p.streak} />
                {p.projectedPoints != null && (
                  <span className="player-select__proj" title="Projected points">
                    <span className="player-select__proj-tag">PROJ</span>
                    <span className="player-select__proj-val">
                      {formatProjection(p.projectedPoints)}
                    </span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
