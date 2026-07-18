import type { ComponentType } from "react";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import SportsBaseballIcon from "@mui/icons-material/SportsBaseball";
import SportsBasketballIcon from "@mui/icons-material/SportsBasketball";
import { Sport } from "@leetpix/shared";

const ICONS: Record<Sport, ComponentType<SvgIconProps>> = {
  [Sport.FOOTBALL]: SportsFootballIcon,
  [Sport.BASEBALL]: SportsBaseballIcon,
  [Sport.BASKETBALL]: SportsBasketballIcon,
};

// Renders the MUI icon for a sport. Accepts all SvgIcon props (className, etc.).
export function SportIcon({ sport, ...props }: { sport: Sport } & SvgIconProps) {
  const Icon = ICONS[sport];
  return <Icon {...props} />;
}
