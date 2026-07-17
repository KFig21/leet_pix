import type { ReactNode } from "react";
import {
  baseCategoryKeys,
  categoryPoints,
  effectiveRate,
  statLabel,
  type ScoringPreset,
  type ScoringRules,
} from "@leetpix/shared";
import { Modal } from "@/components/Modal/Modal";
import { ScoringBadge } from "@/components/ScoringBadge/ScoringBadge";
import type { ScoringFormatSummary } from "@/types";
import "./ScoringBreakdownModal.scss";

export interface BreakdownOption {
  playerName: string;
  // Drives position-specific scoring overrides (e.g. QB rushing TDs).
  position?: string | null;
  statLine: Record<string, number>;
  total: number | null;
  isWinner?: boolean;
}

interface Props {
  options: BreakdownOption[];
  rules: ScoringRules;
  scoringPreset: ScoringPreset | null;
  scoringFormat: ScoringFormatSummary | null;
  // Optional readable stat line shown above the scoring breakdown (projections),
  // with a small heading above it (e.g. "Season projection").
  summary?: ReactNode;
  summaryHeading?: ReactNode;
  onClose: () => void;
}

// Thousands separators + at most 2 decimals (e.g. 3548.26 → "3,548.26").
const commas = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });

const fmt = (p: number) => (p === 0 ? "–" : `${p > 0 ? "+" : "-"}${commas(Math.abs(p))}`);

// "Jahmyr Gibbs" → "J. Gibbs" — keeps the comparison columns narrow (and legible
// on phones), while suffixes like "Jr." stay attached to the surname.
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  const [first, ...rest] = parts;
  return `${first[0]}. ${rest.join(" ")}`;
}

export function ScoringBreakdownModal({
  options,
  rules,
  scoringPreset,
  scoringFormat,
  summary,
  summaryHeading,
  onClose,
}: Props) {
  const many = options.length > 1;

  return (
    <Modal
      title={many ? "Scoring breakdown" : (options[0]?.playerName ?? "")}
      onClose={onClose}
      wide={many}
      titleAccessory={
        <ScoringBadge scoringPreset={scoringPreset} scoringFormat={scoringFormat} />
      }
    >
      {summary && (
        <div className="breakdown-summary">
          {summaryHeading && (
            <div className="breakdown-summary__heading">{summaryHeading}</div>
          )}
          <div className="breakdown-summary__line">{summary}</div>
        </div>
      )}
      {many ? (
        <Columns options={options} rules={rules} />
      ) : (
        <Single option={options[0]} rules={rules} />
      )}
    </Modal>
  );
}

function Columns({
  options,
  rules,
}: {
  options: BreakdownOption[];
  rules: ScoringRules;
}) {
  // Base categories (position-override suffixes collapsed), keeping only those
  // any option actually recorded.
  const cats = baseCategoryKeys(rules).filter((k) =>
    options.some((o) => (o.statLine[k] ?? 0) !== 0),
  );
  const points = (o: BreakdownOption, k: string) =>
    categoryPoints(o.statLine, rules, k, o.position);

  return (
    <div className="breakdown-cols">
      <table className="breakdown-cols__table">
        <thead>
          <tr>
            <th className="breakdown-cols__corner" />
            {options.map((o) => (
              <th
                key={o.playerName}
                className={`breakdown-cols__player${o.isWinner ? " breakdown-cols__player--winner" : ""}`}
              >
                {shortName(o.playerName)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cats.map((k) => (
            <tr key={k}>
              <th className="breakdown-cols__cat">{statLabel(k)}</th>
              {options.map((o) => (
                <td
                  key={o.playerName}
                  className={`breakdown-cols__cell${o.isWinner ? " breakdown-cols__cell--winner" : ""}`}
                >
                  {fmt(points(o, k))}
                </td>
              ))}
            </tr>
          ))}
          <tr className="breakdown-cols__total-row">
            <th className="breakdown-cols__cat">Total</th>
            {options.map((o) => (
              <td
                key={o.playerName}
                className={`breakdown-cols__cell breakdown-cols__cell--total${o.isWinner ? " breakdown-cols__cell--winner" : ""}`}
              >
                {o.total ?? 0}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Single({
  option,
  rules,
}: {
  option?: BreakdownOption;
  rules: ScoringRules;
}) {
  if (!option) return null;
  // Per base category, using the rate that applies to this player's position.
  const lines = baseCategoryKeys(rules)
    .map((key) => {
      const value = option.statLine[key] ?? 0;
      const perUnit = effectiveRate(rules, key, option.position);
      return { key, value, perUnit, points: Math.round(value * perUnit * 100) / 100 };
    })
    .filter((l) => l.value !== 0);

  if (lines.length === 0) {
    return <p className="breakdown-single__empty">No scored stats this period.</p>;
  }
  return (
    <ul className="breakdown-single">
      {lines.map((l) => (
        <li key={l.key} className="breakdown-single__row">
          <span className="breakdown-single__stat">{statLabel(l.key)}</span>
          <span className="breakdown-single__calc">
            {commas(l.value)} × {l.perUnit}
          </span>
          <strong className="breakdown-single__pts">{fmt(l.points)}</strong>
        </li>
      ))}
      <li className="breakdown-single__row breakdown-single__row--total">
        <span className="breakdown-single__stat">Total</span>
        <span />
        <strong className="breakdown-single__pts breakdown-single__pts--total">
          {commas(option.total ?? 0)}
        </strong>
      </li>
    </ul>
  );
}
