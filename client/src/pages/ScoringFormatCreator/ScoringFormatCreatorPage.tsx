import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sport } from "@leetpix/shared";
import { api } from "@/lib/api";
import "./ScoringFormatCreatorPage.scss";

// Build and save a custom scoring format (e.g. "League One Scoring").
// TODO: render the full stat-category matrix per sport instead of free rows.
const STARTER_RULES = [
  { key: "passingYards", points: 0.04 },
  { key: "passingTd", points: 4 },
  { key: "reception", points: 1 },
];

export function ScoringFormatCreatorPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [rows, setRows] = useState(STARTER_RULES);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const rules = Object.fromEntries(rows.map((r) => [r.key, r.points]));
    await api.post("/scoring-formats", { name, sport: Sport.FOOTBALL, rules });
    navigate("/settings");
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
          required
        />
        {rows.map((row, i) => (
          <div key={i} className="scoring__row">
            <input
              value={row.key}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, key: e.target.value };
                setRows(next);
              }}
            />
            <input
              type="number"
              step="0.01"
              value={row.points}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, points: Number(e.target.value) };
                setRows(next);
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="scoring__add"
          onClick={() => setRows([...rows, { key: "", points: 0 }])}
        >
          + Add stat category
        </button>
        <button className="scoring__save">Save format</button>
      </form>
    </div>
  );
}
