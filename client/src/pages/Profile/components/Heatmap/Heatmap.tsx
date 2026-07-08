import { useMemo } from "react";
import type { HeatmapCell } from "@leetpix/shared";
import "./Heatmap.scss";

interface Props {
  cells: HeatmapCell[];
}

const WEEKS = 53;
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
// Row labels (grid rows: 1 = months, then Sun..Sat = rows 2..8).
const DAY_LABELS: { row: number; text: string }[] = [
  { row: 3, text: "Mon" },
  { row: 5, text: "Wed" },
  { row: 7, text: "Fri" },
];

interface Day {
  key: string;
  week: number; // column index
  dow: number; // 0=Sun..6=Sat
  cell?: HeatmapCell;
}

// GitHub-style participation grid: empty days are faint; active days tint green
// (hot / mostly-correct) or red (cold / mostly-wrong) by intensity.
function cellStyle(cell?: HeatmapCell): React.CSSProperties {
  if (!cell || cell.votes === 0) return { background: "var(--bg-hover)" };
  const mag = 0.35 + 0.65 * Math.min(1, Math.abs(cell.intensity));
  if (cell.intensity > 0.15) return { background: `rgba(47, 168, 79, ${mag})` };
  if (cell.intensity < -0.15) return { background: `rgba(244, 33, 46, ${mag})` };
  return { background: "var(--text-secondary)", opacity: 0.5 };
}

export function Heatmap({ cells }: Props) {
  const { days, monthLabels } = useMemo(() => {
    const byDate = new Map(cells.map((c) => [c.date, c]));
    const today = new Date();
    // Sunday of the first (leftmost) week.
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() - (WEEKS - 1) * 7);

    const days: Day[] = [];
    const monthLabels: { week: number; text: string }[] = [];
    let lastMonth = -1;

    for (let w = 0; w < WEEKS; w++) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);
        if (date > today) continue; // no future days
        const key = date.toISOString().slice(0, 10);
        days.push({ key, week: w, dow: d, cell: byDate.get(key) });
        // Label a column the first time a new month begins in it.
        if (d === 0 && date.getMonth() !== lastMonth) {
          lastMonth = date.getMonth();
          monthLabels.push({ week: w, text: MONTHS[lastMonth] });
        }
      }
    }
    return { days, monthLabels };
  }, [cells]);

  return (
    <div
      className="heatmap"
      style={{ gridTemplateColumns: `28px repeat(${WEEKS}, minmax(0, 1fr))` }}
    >
      {monthLabels.map((m) => (
        <span
          key={`${m.week}-${m.text}`}
          className="heatmap__month"
          style={{ gridColumn: m.week + 2, gridRow: 1 }}
        >
          {m.text}
        </span>
      ))}

      {DAY_LABELS.map((d) => (
        <span
          key={d.text}
          className="heatmap__day"
          style={{ gridColumn: 1, gridRow: d.row }}
        >
          {d.text}
        </span>
      ))}

      {days.map((d) => (
        <span
          key={d.key}
          className="heatmap__cell"
          style={{ ...cellStyle(d.cell), gridColumn: d.week + 2, gridRow: d.dow + 2 }}
          title={
            d.cell
              ? `${d.key}: ${d.cell.correct}/${d.cell.votes} correct`
              : `${d.key}: no activity`
          }
        />
      ))}
    </div>
  );
}
