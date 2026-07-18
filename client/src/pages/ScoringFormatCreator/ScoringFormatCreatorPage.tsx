import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sport,
  STAT_CATALOG,
  SPORT_PRESETS,
  SCORING_PRESET_LABELS,
  SCORING_PRESET_RULES,
  type StatCategory,
  type ScoringPreset,
  type ScoringRuleValue,
} from "@leetpix/shared";
import { api } from "@/lib/api";
import "./ScoringFormatCreatorPage.scss";

// Per-category editor state. `points`/`per` are the intuitive framing shown in
// the UI ("<points> pt per <per> yds"); `overrides` holds per-position rates for
// categories that allow them (e.g. a QB-specific rushing-TD value). We convert
// to points-per-unit on save.
type Field = {
  on: boolean;
  points: number;
  per: number;
  overrides: Record<string, number>;
};

const SPORTS: { value: Sport; label: string }[] = [
  { value: Sport.FOOTBALL, label: "Football" },
  { value: Sport.BASEBALL, label: "Baseball" },
];

// Seed editor state from the catalog defaults for a sport.
function defaultsFor(sport: Sport): Record<string, Field> {
  const out: Record<string, Field> = {};
  for (const c of STAT_CATALOG[sport]) {
    const overrides: Record<string, number> = {};
    for (const pos of c.overridePositions ?? []) overrides[pos] = c.defaultPoints;
    out[c.key] = {
      on: c.defaultOn,
      points: c.defaultPoints,
      per: c.defaultPer ?? 1,
      overrides,
    };
  }
  return out;
}

// A group starts expanded if it contains any enabled category.
function openGroupsFor(fields: Record<string, Field>, sport: Sport): Set<string> {
  const open = new Set<string>();
  for (const c of STAT_CATALOG[sport]) if (fields[c.key]?.on) open.add(c.group);
  return open;
}

const rulePoints = (v: ScoringRuleValue): number =>
  typeof v === "number" ? v : v.points;

// Reconstruct editor state from a saved rule set: enable exactly the categories
// present (with their points/per and any overrides), leaving the rest off at
// catalog defaults. Used for both presets and editing an existing format.
function fieldsFromRules(
  sport: Sport,
  rules: Record<string, ScoringRuleValue>,
): Record<string, Field> {
  const out: Record<string, Field> = {};
  for (const c of STAT_CATALOG[sport]) {
    const v = rules[c.key];
    const on = v !== undefined;
    const points = on ? rulePoints(v) : c.defaultPoints;
    const per = on && typeof v === "object" ? v.per : (c.defaultPer ?? 1);
    const overrides: Record<string, number> = {};
    for (const pos of c.overridePositions ?? []) {
      const ov = rules[`${c.key}.${pos}`];
      overrides[pos] = ov !== undefined ? rulePoints(ov) : points;
    }
    out[c.key] = { on, points, per, overrides };
  }
  return out;
}

const fieldsFromPreset = (sport: Sport, preset: ScoringPreset) =>
  fieldsFromRules(sport, SCORING_PRESET_RULES[preset]);

type RateStyle = "whole" | "decimal";
const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Re-frame every rate field between "1 pt per N units" (whole) and "X pts per
// unit" (decimal, per = 1) while preserving the actual points-per-unit value.
function convertRateFraming(
  fields: Record<string, Field>,
  sport: Sport,
  style: RateStyle,
): Record<string, Field> {
  const out = { ...fields };
  for (const c of STAT_CATALOG[sport]) {
    if (c.kind !== "rate") continue;
    const f = out[c.key];
    if (!f) continue;
    const ppu = f.per ? f.points / f.per : 0;
    const per = style === "decimal" ? 1 : (c.defaultPer ?? 1);
    out[c.key] = {
      ...f,
      per,
      points: round3(style === "decimal" ? ppu : ppu * per),
    };
  }
  return out;
}

// The saved-format shape the API returns (and onSaved hands back).
export interface SavedScoringFormat {
  id: string;
  name: string;
  sport: Sport;
  rules: Record<string, number>;
}

interface Props {
  // Embedded (modal) mode: hides the page header, and on save calls onSaved with
  // the created format instead of navigating away.
  embedded?: boolean;
  onSaved?: (format: SavedScoringFormat) => void;
  // Start on (and, when embedded, lock to) a specific sport.
  initialSport?: Sport;
  // Show the sport tabs even when embedded (e.g. onboarding, where the user
  // hasn't committed to a sport yet). The league modal keeps them hidden since
  // leagues are football-only.
  allowSportSelect?: boolean;
}

export function ScoringFormatCreatorPage({
  embedded = false,
  onSaved,
  initialSport = Sport.FOOTBALL,
  allowSportSelect = false,
}: Props = {}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Edit mode when routed as /scoring/:id/edit (never in embedded/modal use).
  const params = useParams<{ id?: string }>();
  const editId = embedded ? undefined : params.id;
  const [name, setName] = useState("");
  const [sport, setSport] = useState<Sport>(initialSport);
  const [fields, setFields] = useState<Record<string, Field>>(() =>
    defaultsFor(initialSport),
  );
  const [openGroups, setOpenGroups] = useState<Set<string>>(() =>
    openGroupsFor(defaultsFor(initialSport), initialSport),
  );
  // "Start from" preset dropdown ("" = catalog defaults, no preset applied).
  const [startPreset, setStartPreset] = useState<string>("");
  // How rate stats are entered: whole ("1 pt per 25 yds") or decimal ("0.04/yd").
  const [rateStyle, setRateStyle] = useState<RateStyle>("whole");
  const [showAdvanced, setShowAdvanced] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editing: load the existing format and hydrate the sheet from its rules.
  const { data: existing } = useQuery({
    queryKey: ["scoring-format", editId],
    queryFn: () =>
      api.get<{ name: string; sport: Sport; rules: Record<string, ScoringRuleValue> }>(
        `/scoring-formats/${editId}`,
      ),
    enabled: !!editId,
  });
  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setSport(existing.sport);
    const f = fieldsFromRules(existing.sport, existing.rules);
    setFields(f);
    setOpenGroups(openGroupsFor(f, existing.sport));
  }, [existing]);

  const categories = STAT_CATALOG[sport];

  // Group the sport's categories under their section headers, preserving order.
  const groups = useMemo(() => {
    const map = new Map<string, StatCategory[]>();
    for (const c of categories) {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    }
    return [...map.entries()];
  }, [categories]);

  // Switching sports swaps in that sport's categories (and resets edits).
  const changeSport = (next: Sport) => {
    setSport(next);
    setFields(defaultsFor(next));
    setOpenGroups(openGroupsFor(defaultsFor(next), next));
    setShowAdvanced(new Set());
    setStartPreset("");
    setRateStyle("whole");
  };

  // Re-frame rate stats between whole and decimal (value-preserving).
  const changeRateStyle = (next: RateStyle) => {
    if (next === rateStyle) return;
    setRateStyle(next);
    setFields((prev) => convertRateFraming(prev, sport, next));
  };

  // Populate the whole sheet from a built-in preset (or reset to catalog
  // defaults when cleared), so a common format is one click, not many toggles.
  const changeStartPreset = (value: string) => {
    setStartPreset(value);
    const next = value
      ? fieldsFromPreset(sport, value as ScoringPreset)
      : defaultsFor(sport);
    setFields(rateStyle === "decimal" ? convertRateFraming(next, sport, "decimal") : next);
    setOpenGroups(openGroupsFor(next, sport));
    setShowAdvanced(new Set());
  };

  const setField = (key: string, patch: Partial<Field>) =>
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const setOverride = (key: string, pos: string, value: number) =>
    setFields((prev) => ({
      ...prev,
      [key]: { ...prev[key], overrides: { ...prev[key].overrides, [pos]: value } },
    }));

  const toggleGroup = (group: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });

  const toggleAdvanced = (group: string) =>
    setShowAdvanced((prev) => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });

  const enabledCount = Object.values(fields).filter((f) => f.on).length;
  const enabledInGroup = (cats: StatCategory[]) =>
    cats.filter((c) => fields[c.key]?.on).length;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Store each enabled category's award in its intended framing: rate stats
    // keep { points, per } ("1 pt per 25 yds"); count stats a plain number.
    const rules: Record<string, ScoringRuleValue> = {};
    const valueFor = (c: StatCategory, points: number): ScoringRuleValue =>
      c.kind === "rate" ? { points, per: fields[c.key].per } : points;
    for (const c of categories) {
      const f = fields[c.key];
      if (!f?.on) continue;
      rules[c.key] = valueFor(c, f.points);
      for (const pos of c.overridePositions ?? []) {
        // Only store an override that actually differs from the base points.
        if (f.overrides[pos] !== f.points) {
          rules[`${c.key}.${pos}`] = valueFor(c, f.overrides[pos]);
        }
      }
    }
    if (Object.keys(rules).length === 0) {
      setError("Enable at least one category.");
      return;
    }

    setSaving(true);
    try {
      const body = { name, sport, rules };
      const saved = editId
        ? await api.put<SavedScoringFormat>(`/scoring-formats/${editId}`, body)
        : await api.post<SavedScoringFormat>("/scoring-formats", body);
      qc.invalidateQueries({ queryKey: ["scoring-formats"] });
      if (onSaved) onSaved(saved);
      else navigate("/settings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save format.");
      setSaving(false);
    }
  };

  // One category row, laid out like a league scoring sheet:
  //   [✓]  Every [25] passing yards            [ 1 ]
  //   [✓]  TD Pass                             [ 4 ]
  // Rate stats carry the "Every N <unit>" clause; count stats just a label. The
  // points box is always right-aligned. Per-position overrides (e.g. QB rushing
  // TDs) render as indented sub-rows and only appear with the advanced set.
  const renderCat = (c: StatCategory, advOpen: boolean) => {
    const f = fields[c.key] ?? { on: false, points: 0, per: 1, overrides: {} };
    const id = `cat-${c.key}`;
    return (
      <div key={c.key} className={`scoring__cat${f.on ? "" : " scoring__cat--off"}`}>
        <div className="scoring__cat-main">
          <input
            id={id}
            type="checkbox"
            className="scoring__check"
            checked={f.on}
            aria-label={c.label}
            onChange={(e) => setField(c.key, { on: e.target.checked })}
          />
          {c.kind === "rate" && rateStyle === "whole" ? (
            <span className="scoring__desc">
              Every{" "}
              <input
                className="scoring__per-input"
                type="number"
                min="1"
                step="1"
                value={f.per}
                disabled={!f.on}
                aria-label={`${c.label} per`}
                onChange={(e) => setField(c.key, { per: Number(e.target.value) })}
              />{" "}
              {c.label.toLowerCase()}
            </span>
          ) : (
            <label htmlFor={id} className="scoring__desc">
              {c.label}
            </label>
          )}
          {c.kind === "rate" && rateStyle === "decimal" ? (
            <span className="scoring__pts-unit">
              <input
                className="scoring__pts"
                type="number"
                step="0.001"
                value={f.points}
                disabled={!f.on}
                aria-label={`${c.label} points per ${c.unit}`}
                onChange={(e) => setField(c.key, { points: Number(e.target.value) })}
              />
              <span className="scoring__unit">/ {c.unit}</span>
            </span>
          ) : (
            <input
              className="scoring__pts"
              type="number"
              step="0.01"
              value={f.points}
              disabled={!f.on}
              aria-label={`${c.label} points`}
              onChange={(e) => setField(c.key, { points: Number(e.target.value) })}
            />
          )}
        </div>

        {advOpen &&
          f.on &&
          (c.overridePositions ?? []).map((pos) => (
            <div key={pos} className="scoring__cat-main scoring__cat-main--override">
              <span className="scoring__desc">
                {c.label} ({pos})
              </span>
              <input
                className="scoring__pts"
                type="number"
                step="0.01"
                value={f.overrides[pos] ?? f.points}
                aria-label={`${c.label} for ${pos}`}
                onChange={(e) => setOverride(c.key, pos, Number(e.target.value))}
              />
            </div>
          ))}
      </div>
    );
  };

  return (
    <div className="scoring">
      {!embedded && (
        <header className="scoring__header">
          {editId ? "Edit scoring format" : "New scoring format"}
        </header>
      )}
      <form className="scoring__form" onSubmit={save}>
        <input
          className="scoring__name"
          placeholder='Name (e.g. "League One Scoring")'
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          required
        />

        {/* Sport is locked when editing an existing format, and in embedded mode
            unless the caller opts in (onboarding does). */}
        {(!embedded || allowSportSelect) && !editId && (
          <div className="scoring__sport" role="tablist" aria-label="Sport">
            {SPORTS.map((s) => (
              <button
                key={s.value}
                type="button"
                role="tab"
                aria-selected={sport === s.value}
                className={`scoring__sport-tab${
                  sport === s.value ? " scoring__sport-tab--on" : ""
                }`}
                onClick={() => changeSport(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Preset head-start: populate the whole sheet, then tweak. */}
        <label className="scoring__preset-label" htmlFor="scoring-start-preset">
          Start from a preset
        </label>
        <select
          id="scoring-start-preset"
          className="scoring__preset"
          value={startPreset}
          onChange={(e) => changeStartPreset(e.target.value)}
        >
          <option value="">Blank (catalog defaults)</option>
          {SPORT_PRESETS[sport].map((p) => (
            <option key={p} value={p}>
              {SCORING_PRESET_LABELS[p]}
            </option>
          ))}
        </select>

        {/* How rate stats (yards, innings) are entered — value-preserving. */}
        <div className="scoring__rate-style" role="group" aria-label="Rate scoring style">
          <span className="scoring__rate-style-label">Rate scoring</span>
          <button
            type="button"
            className={`scoring__rate-tab${rateStyle === "whole" ? " scoring__rate-tab--on" : ""}`}
            onClick={() => changeRateStyle("whole")}
          >
            Whole (1 per 25)
          </button>
          <button
            type="button"
            className={`scoring__rate-tab${rateStyle === "decimal" ? " scoring__rate-tab--on" : ""}`}
            onClick={() => changeRateStyle("decimal")}
          >
            Decimal (per unit)
          </button>
        </div>

        {groups.map(([group, cats]) => {
          const open = openGroups.has(group);
          const nOn = enabledInGroup(cats);
          const common = cats.filter((c) => !c.advanced);
          const advanced = cats.filter((c) => c.advanced);
          // Force advanced open when an advanced category is already enabled, so
          // a chosen category is never hidden (and can't be hidden away).
          const forced = advanced.some((c) => fields[c.key]?.on);
          const advOpen = showAdvanced.has(group) || forced;
          return (
            <section key={group} className="scoring__group">
              <button
                type="button"
                className="scoring__group-toggle"
                aria-expanded={open}
                onClick={() => toggleGroup(group)}
              >
                <span className={`scoring__chevron${open ? " scoring__chevron--open" : ""}`}>
                  ▸
                </span>
                <span className="scoring__group-title">{group}</span>
                {nOn > 0 && <span className="scoring__group-count">{nOn}</span>}
              </button>

              {open && (
                <div className="scoring__group-body">
                  {common.map((c) => renderCat(c, advOpen))}
                  {advanced.length > 0 && !advOpen && (
                    <button
                      type="button"
                      className="scoring__advanced-toggle"
                      onClick={() => toggleAdvanced(group)}
                    >
                      Show {advanced.length} advanced
                    </button>
                  )}
                  {advOpen && advanced.map((c) => renderCat(c, advOpen))}
                  {/* Only offer Hide when nothing enabled is forcing advanced open. */}
                  {advOpen && !forced && (
                    <button
                      type="button"
                      className="scoring__advanced-toggle"
                      onClick={() => toggleAdvanced(group)}
                    >
                      Hide advanced
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {error && <p className="scoring__error">{error}</p>}

        <div className="scoring__footer">
          <span className="scoring__count">{enabledCount} categories</span>
          <button className="scoring__save" disabled={saving}>
            {saving ? "Saving…" : editId ? "Save changes" : "Save format"}
          </button>
        </div>
      </form>
    </div>
  );
}
