import type { Avatar as AvatarData, AvatarShape } from "@leetpix/shared";
import { AVATAR_ICONS } from "./icons";
import "./Avatar.scss";

interface Props {
  avatar: AvatarData;
  size?: number;
}

// border-radius per shape (as a % of the box).
const SHAPE_RADIUS: Record<AvatarShape, string> = {
  circle: "50%",
  rounded: "30%",
  square: "8%",
};

// Generic identicon: a colored shape with either a sport icon or an emoji.
// No image uploads (per spec). Icon color follows `currentColor`.
export function Avatar({ avatar, size = 40 }: Props) {
  const Icon = avatar.icon ? AVATAR_ICONS[avatar.icon] : undefined;
  const radius = SHAPE_RADIUS[avatar.shape ?? "circle"];

  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: avatar.bgColor,
        color: avatar.iconColor,
        borderRadius: radius,
        fontSize: size * 0.5,
      }}
      aria-hidden
    >
      {avatar.emoji ? (
        avatar.emoji
      ) : Icon ? (
        <Icon style={{ fontSize: size * 0.62 }} />
      ) : (
        "?"
      )}
    </span>
  );
}
