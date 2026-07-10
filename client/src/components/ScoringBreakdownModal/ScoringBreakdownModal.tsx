import {
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
  statLine: Record<string, number>;
  total: number | null;
  isWinner?: boolean;
}

interface Props {
  options: BreakdownOption[];
  rules: ScoringRules;
  scoringPreset: ScoringPreset | null;
  scoringFormat: ScoringFormatSummary | null;
  onClose: () => void;
}

const fmt = (p: number) => (p === 0 ? "–" : p > 0 ? `+${p}` : `${p}`);

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
  const cats = Object.keys(rules).filter((k) =>
    options.some((o) => (o.statLine[k] ?? 0) !== 0),
  );
  const points = (o: BreakdownOption, k: string) =>
    Math.round((o.statLine[k] ?? 0) * (rules[k] ?? 0) * 100) / 100;

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
  const lines = Object.entries(rules)
    .map(([key, perUnit]) => {
      const value = option.statLine[key] ?? 0;
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
            {l.value} × {l.perUnit}
          </span>
          <strong className="breakdown-single__pts">
            {l.points > 0 ? `+${l.points}` : l.points}
          </strong>
        </li>
      ))}
      <li className="breakdown-single__row breakdown-single__row--total">
        <span className="breakdown-single__stat">Total</span>
        <span />
        <strong className="breakdown-single__pts">{option.total ?? 0}</strong>
      </li>
    </ul>
  );
}
