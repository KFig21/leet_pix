import { useState } from "react";
import { Sport } from "@leetpix/shared";
import { ExplorePlayers } from "@/pages/Search/components/ExplorePlayers/ExplorePlayers";
import { TonightsSlate } from "./components/TonightsSlate/TonightsSlate";
import "./ExplorePage.scss";

const SPORTS: { value: Sport; label: string }[] = [
  { value: Sport.FOOTBALL, label: "Football" },
  { value: Sport.BASEBALL, label: "Baseball" },
];

// Discovery hub: the day's slate of games and trending / hot / cold players, all
// filtered by a single sport toggle. Tapping any game or player jumps to its
// recent polls on the search screen.
export function ExplorePage() {
  const [sport, setSport] = useState<Sport>(Sport.FOOTBALL);

  return (
    <div className="explore">
      <header className="explore__header">
        <span className="explore__title">Explore</span>
        <div className="explore__sports" role="tablist" aria-label="Sport">
          {SPORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="tab"
              aria-selected={sport === s.value}
              className={`explore__sport${
                sport === s.value ? " explore__sport--on" : ""
              }`}
              onClick={() => setSport(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      <div className="explore__body">
        <TonightsSlate sport={sport} />
        <ExplorePlayers sport={sport} />
      </div>
    </div>
  );
}
