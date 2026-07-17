import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ScoringPreset, ScoringRules, Sport } from "@leetpix/shared";
import { api } from "@/lib/api";
import { projectionStatLine } from "@/lib/projectionStatLine";
import { Modal } from "@/components/Modal/Modal";
import { Loader } from "@/components/Loader/Loader";
import {
  ScoringBreakdownModal,
  type BreakdownOption,
} from "@/components/ScoringBreakdownModal/ScoringBreakdownModal";
import type { ScoringFormatSummary } from "@/types";
import "./ProjectionBreakdown.scss";

// Scoring context for the projection. Prefer a poll (its frozen rules + grading
// window); the create screen passes raw scoring params instead (current week).
export interface ProjectionParams {
  playerId: string;
  pollId?: string;
  questionType?: string;
  leagueId?: string | null;
  scoringPreset?: string | null;
  scoringFormatId?: string | null;
  evaluationWeeks?: number | null;
}

interface ProjectionResponse {
  playerName: string;
  position: string | null;
  sport: Sport;
  seasonLong: boolean;
  statLine: Record<string, number>;
  total: number;
  rules: ScoringRules;
  scoringPreset: ScoringPreset | null;
  scoringFormat: ScoringFormatSummary | null;
}

function toQuery(p: ProjectionParams): string {
  const q = new URLSearchParams();
  if (p.pollId) q.set("pollId", p.pollId);
  else {
    if (p.questionType) q.set("questionType", p.questionType);
    if (p.leagueId) q.set("leagueId", p.leagueId);
    if (p.scoringPreset) q.set("scoringPreset", p.scoringPreset);
    if (p.scoringFormatId) q.set("scoringFormatId", p.scoringFormatId);
    if (p.evaluationWeeks != null) q.set("evaluationWeeks", String(p.evaluationWeeks));
  }
  return q.toString();
}

interface Props {
  params: ProjectionParams;
  className?: string;
  title?: string;
  children: ReactNode;
}

// Wraps a projection display (the PROJ pill) in a button that opens a modal
// breaking the projected points down by stat, fetched on demand.
export function ProjectionBreakdown({ params, className, title, children }: Props) {
  const [open, setOpen] = useState(false);
  const query = toQuery(params);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["projection-breakdown", params.playerId, query],
    queryFn: () =>
      api.get<ProjectionResponse>(
        `/players/${params.playerId}/projection?${query}`,
      ),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const openModal = () => setOpen(true);

  return (
    <>
      {/* A span (not a button) so it can live inside the player-select option
          button without nesting interactive elements. */}
      <span
        role="button"
        tabIndex={0}
        className={`projection-breakdown${className ? ` ${className}` : ""}`}
        title={title ?? "See projection breakdown"}
        onClick={(e) => {
          e.stopPropagation();
          openModal();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            openModal();
          }
        }}
      >
        {children}
      </span>

      {open &&
        (data ? (
          <ScoringBreakdownModal
            rules={data.rules}
            scoringPreset={data.scoringPreset}
            scoringFormat={data.scoringFormat}
            summary={projectionStatLine(
              data.statLine,
              data.position,
              data.sport,
              data.seasonLong,
            )}
            options={[
              {
                playerName: data.playerName,
                position: data.position,
                statLine: data.statLine,
                total: data.total,
              } satisfies BreakdownOption,
            ]}
            onClose={() => setOpen(false)}
          />
        ) : (
          <Modal title="Projection" onClose={() => setOpen(false)}>
            {isError ? (
              <p className="projection-breakdown__msg">
                Couldn’t load this projection.
              </p>
            ) : (
              <div className="projection-breakdown__loading">
                <Loader size={20} center={false} />
                {isLoading ? "Loading projection…" : ""}
              </div>
            )}
          </Modal>
        ))}
    </>
  );
}
