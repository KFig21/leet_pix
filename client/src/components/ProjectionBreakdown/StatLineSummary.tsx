import type { ProjectionStatGroup } from "@/lib/projectionStatLine";

// Renders a stat line split into bordered per-category boxes (Passing, Rushing,
// …). Shared by the projection modal and the resolved-poll breakdown. Styles
// live in ProjectionBreakdown.scss (.proj-summary).
export function StatLineSummary({ groups }: { groups: ProjectionStatGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <span className="proj-summary">
      {groups.map((g) => (
        <span key={g.group} className="proj-summary__cat">
          <span className="proj-summary__cat-head">{g.group}</span>
          <span className="proj-summary__cat-stats">{g.stats}</span>
        </span>
      ))}
    </span>
  );
}
