import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex color");

// Named sport icons (mapped to MUI icons on the client).
export const AVATAR_ICONS = [
  "football",
  "baseball",
  "bat",
  "helmet",
  "whistle",
  "trophy",
] as const;
export type AvatarIcon = (typeof AVATAR_ICONS)[number];

// Background disc shapes.
export const AVATAR_SHAPES = ["circle", "rounded", "square"] as const;
export type AvatarShape = (typeof AVATAR_SHAPES)[number];

// Generic avatar (no image uploads, per spec): a colored shape with a
// foreground that is EITHER a named sport icon or an emoji.
export const avatarSchema = z
  .object({
    bgColor: hexColor,
    shape: z.enum(AVATAR_SHAPES).default("circle"),
    // Foreground — exactly one of `icon` / `emoji`.
    icon: z.enum(AVATAR_ICONS).optional(),
    emoji: z.string().min(1).max(8).optional(),
    // Applies to `icon` foregrounds (emoji keep their own colors).
    iconColor: hexColor.default("#ffffff"),
  })
  .refine((a) => !!a.icon !== !!a.emoji, {
    message: "Choose either a sport icon or an emoji",
    path: ["icon"],
  });
export type Avatar = z.infer<typeof avatarSchema>;

export const usernameSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only");

export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  displayName: z.string().min(1).max(40).optional(),
  bio: z.string().max(160).optional(),
  avatar: avatarSchema.optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
