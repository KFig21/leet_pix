import type { ComponentType } from "react";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import SportsFootball from "@mui/icons-material/SportsFootball";
import SportsBaseball from "@mui/icons-material/SportsBaseball";
import SportsCricket from "@mui/icons-material/SportsCricket";
import SportsMotorsports from "@mui/icons-material/SportsMotorsports";
import Sports from "@mui/icons-material/Sports";
import EmojiEvents from "@mui/icons-material/EmojiEvents";

// Maps avatar icon keys (see avatarSchema in @leetpix/shared) to MUI icons.
// "letter"/"number" aren't here — they render the avatar's glyph as text.
// This registry is shared by the Avatar and the icon picker.
export const AVATAR_ICONS: Record<string, ComponentType<SvgIconProps>> = {
  helmet: SportsMotorsports,
  football: SportsFootball,
  baseball: SportsBaseball,
  bat: SportsCricket,
  whistle: Sports,
  trophy: EmojiEvents,
};
