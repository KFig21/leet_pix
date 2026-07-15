import {
  limitsFor,
  type TierLimits,
  type UserRole,
  type UserTier,
} from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/error";

export interface UserEntitlements {
  role: UserRole;
  tier: UserTier;
  limits: TierLimits;
}

/** Load a user's role/tier and resolve their effective limits (staff bypass). */
export async function userEntitlements(
  userId: string,
): Promise<UserEntitlements> {
  const p = await prisma.profile.findUnique({
    where: { id: userId },
    select: { role: true, tier: true },
  });
  if (!p) throw new HttpError(404, "Profile not found");
  const role = p.role as UserRole;
  const tier = p.tier as UserTier;
  return { role, tier, limits: limitsFor(role, tier) };
}

/**
 * Enforce an "own at most N of X" cap. Throws HttpError(403) when the current
 * count is already at the limit. Skipped for unlimited (staff) entitlements.
 */
export async function assertUnderCap(
  current: number,
  limit: number,
  label: string,
): Promise<void> {
  if (!Number.isFinite(limit)) return; // unlimited
  if (current >= limit) {
    throw new HttpError(
      403,
      `You've reached your limit of ${limit} ${label}. Upgrade or delete one to add more.`,
    );
  }
}
