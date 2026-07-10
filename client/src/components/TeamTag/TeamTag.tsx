import { teamColor, type Sport } from "@leetpix/shared";
import "./TeamTag.scss";

interface Props {
  abbr?: string | null;
  // Disambiguates abbreviations shared across leagues (ATL, CHC…).
  sport?: Sport;
  className?: string;
}

// Team abbreviation as a filled pill tinted to the team's brand colors (with a
// luminance-derived readable text color). Falls back to a neutral pill when the
// team is unknown. Renders nothing without an abbreviation.
export function TeamTag({ abbr, sport, className }: Props) {
  if (!abbr) return null;
  const c = teamColor(abbr, sport);
  return (
    <span
      className={`team-tag${className ? ` ${className}` : ""}`}
      style={c ? { background: c.bg, color: c.fg } : undefined}
    >
      {abbr}
    </span>
  );
}
