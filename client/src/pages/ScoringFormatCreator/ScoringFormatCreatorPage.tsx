import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sport,
  STAT_CATALOG,
  toPointsPerUnit,
  type StatCategory,
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

// A group starts expanded if it contains any on-by-default category (i.e. the
// core offensive groups); advanced groups like Kicking/IDP start collapsed.
function openGroupsFor(sport: Sport): Set<string> {
  const open = new Set<string>();
  for (const c of STAT_CATALOG[sport]) if (c.defaultOn) open.add(c.group);
  return open;
}

export function ScoringFormatCreatorPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [sport, setSport] = useState<Sport>(Sport.FOOTBALL);
  const [fields, setFields] = useState<Record<string, Field>>(() =>
    defaultsFor(Sport.FOOTBALL),
  );
  const [openGroups, setOpenGroups] = useState<Set<string>>(() =>
    openGroupsFor(Sport.FOOTBALL),
  );
  const [showAdvanced, setShowAdvanced] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setOpenGroups(openGroupsFor(next));
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

    // Convert each enabled category (and any position overrides) to stored
    // points-per-unit values.
    const rules: Record<string, number> = {};
    for (const c of categories) {
      const f = fields[c.key];
      if (!f?.on) continue;
      const base = Math.round(toPointsPerUnit(c, f.points, f.per) * 1000) / 1000;
      rules[c.key] = base;
      for (const pos of c.overridePositions ?? []) {
        const ov = Math.round(toPointsPerUnit(c, f.overrides[pos], f.per) * 1000) / 1000;
        // Only store an override that actually differs from the base rate.
        if (ov !== base) rules[`${c.key}.${pos}`] = ov;
      }
    }
    if (Object.keys(rules).length === 0) {
      setError("Enable at least one category.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/scoring-formats", { name, sport, rules });
      navigate("/settings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save format.");
      setSaving(false);
    }
  };

  // One category row: enable toggle, base value (count or rate), and any
  // per-position override inputs.
  const renderCat = (c: StatCategory) => {
    const f = fields[c.key] ?? { on: false, points: 0, per: 1, overrides: {} };
    return (
      <div key={c.key} className={`scoring__cat${f.on ? "" : " scoring__cat--off"}`}>
        <div className="scoring__cat-main">
          <label className="scoring__cat-toggle">
            <input
              type="checkbox"
              checked={f.on}
              onChange={(e) => setField(c.key, { on: e.target.checked })}
            />
            <span className="scoring__cat-label">{c.label}</span>
          </label>

          <div className="scoring__cat-value">
            <input
              className="scoring__pts"
              type="number"
              step="0.01"
              value={f.points}
              disabled={!f.on}
              aria-label={`${c.label} points`}
              onChange={(e) => setField(c.key, { points: Number(e.target.value) })}
            />
            {c.kind === "rate" ? (
              <span className="scoring__per">
                pt per
                <input
                  className="scoring__per-input"
                  type="number"
                  min="1"
                  step="1"
                  value={f.per}
                  disabled={!f.on}
                  aria-label={`${c.label} per units`}
                  onChange={(e) => setField(c.key, { per: Number(e.target.value) })}
                />
                {c.unit}s
              </span>
            ) : (
              <span className="scoring__per">pts</span>
            )}
          </div>
        </div>

        {/* Per-position overrides (e.g. QB rushing TDs). */}
        {f.on && (c.overridePositions?.length ?? 0) > 0 && (
          <div className="scoring__overrides">
            {c.overridePositions!.map((pos) => (
              <label key={pos} className="scoring__override">
                <span className="scoring__override-pos">{pos}</span>
                <input
                  className="scoring__pts"
                  type="number"
                  step="0.01"
                  value={f.overrides[pos] ?? f.points}
                  aria-label={`${c.label} for ${pos}`}
                  onChange={(e) => setOverride(c.key, pos, Number(e.target.value))}
                />
                <span className="scoring__per">pts</span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="scoring">
      <header className="scoring__header">New scoring format</header>
      <form className="scoring__form" onSubmit={save}>
        <input
          className="scoring__name"
          placeholder='Name (e.g. "League One Scoring")'
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          required
        />

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

        {groups.map(([group, cats]) => {
          const open = openGroups.has(group);
          const nOn = enabledInGroup(cats);
          const common = cats.filter((c) => !c.advanced);
          const advanced = cats.filter((c) => c.advanced);
          // Reveal advanced when asked, or when an advanced category is already
          // enabled (so a chosen category is never hidden).
          const advOpen =
            showAdvanced.has(group) || advanced.some((c) => fields[c.key]?.on);
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
                  {common.map(renderCat)}
                  {advanced.length > 0 &&
                    (advOpen ? (
                      advanced.map(renderCat)
                    ) : (
                      <button
                        type="button"
                        className="scoring__advanced-toggle"
                        onClick={() => toggleAdvanced(group)}
                      >
                        Show {advanced.length} advanced
                      </button>
                    ))}
                </div>
              )}
            </section>
          );
        })}

        {error && <p className="scoring__error">{error}</p>}

        <div className="scoring__footer">
          <span className="scoring__count">{enabledCount} categories</span>
          <button className="scoring__save" disabled={saving}>
            {saving ? "Saving…" : "Save format"}
          </button>
        </div>
      </form>
    </div>
  );
}
