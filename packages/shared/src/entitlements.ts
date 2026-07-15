// Permissions (role) and paid entitlements (tier) — two independent axes.
// Keep values in sync with the Prisma enums UserRole / UserTier.

import { POLL_COOLDOWN_MS, VOTES_TO_BYPASS_COOLDOWN } from "./constants";

// ── Roles (what you can DO) ──────────────────────────────────────────────────
export const UserRole = {
  USER: "USER",
  MODERATOR: "MODERATOR",
  ADMIN: "ADMIN",
  SUPERADMIN: "SUPERADMIN", // internal "god" role (you + employees)
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// Ascending privilege rank for comparisons.
const ROLE_RANK: Record<UserRole, number> = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

export function roleAtLeast(role: UserRole, min: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

// Staff (ADMIN and above) bypass entitlement limits and most permission gates.
export function isStaff(role: UserRole): boolean {
  return roleAtLeast(role, UserRole.ADMIN);
}

// ── Tiers (what you PAID for) ────────────────────────────────────────────────
export const UserTier = {
  BASE: "BASE",
  PREMIUM: "PREMIUM",
} as const;
export type UserTier = (typeof UserTier)[keyof typeof UserTier];

// Per-tier caps. The single source of truth for limits — enforce by reading
// these, never by scattering `if (tier === …)` around the codebase.
export interface TierLimits {
  // Minimum time between a user's own polls.
  cooldownMs: number;
  // Votes on *others'* polls that bypass the cooldown.
  votesToBypassCooldown: number;
  // Rolling-24h cap on polls created (anti-abuse backstop, separate from IP rate limit).
  maxPollsPerDay: number;
  // Max saved custom scoring formats / leagues a user may own.
  maxScoringFormats: number;
  maxLeagues: number;
}

export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  BASE: {
    cooldownMs: POLL_COOLDOWN_MS, // 4h
    votesToBypassCooldown: VOTES_TO_BYPASS_COOLDOWN, // 5
    maxPollsPerDay: 10,
    maxScoringFormats: 3,
    maxLeagues: 3,
  },
  PREMIUM: {
    cooldownMs: 30 * 60 * 1000, // 30m
    votesToBypassCooldown: 3,
    maxPollsPerDay: 50,
    maxScoringFormats: 25,
    maxLeagues: 25,
  },
};

// No limits at all — staff roles.
export const UNLIMITED_LIMITS: TierLimits = {
  cooldownMs: 0,
  votesToBypassCooldown: 0,
  maxPollsPerDay: Infinity,
  maxScoringFormats: Infinity,
  maxLeagues: Infinity,
};

// Effective limits for a user: staff bypass all caps, otherwise their tier's.
export function limitsFor(role: UserRole, tier: UserTier): TierLimits {
  if (isStaff(role)) return UNLIMITED_LIMITS;
  return TIER_LIMITS[tier];
}
