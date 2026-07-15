import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/error";
import { userEntitlements } from "./entitlements";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Enforces per-tier posting limits (see @leetpix/shared TIER_LIMITS):
 *  - a rolling-24h cap on polls created (anti-abuse backstop), and
 *  - a cooldown between polls, bypassable by voting on enough others' polls.
 * Staff roles have unlimited entitlements and skip both. Throws HttpError(429).
 */
export async function assertCanPost(userId: string): Promise<void> {
  const { limits } = await userEntitlements(userId);

  // Rolling-24h cap. Counts every poll created (incl. since-deleted) so a user
  // can't delete-and-repost to evade it.
  if (Number.isFinite(limits.maxPollsPerDay)) {
    const since = new Date(Date.now() - DAY_MS);
    const todayCount = await prisma.poll.count({
      where: { authorId: userId, createdAt: { gt: since } },
    });
    if (todayCount >= limits.maxPollsPerDay) {
      throw new HttpError(
        429,
        `Daily limit reached (${limits.maxPollsPerDay} polls/day). Try again tomorrow.`,
      );
    }
  }

  if (limits.cooldownMs <= 0) return; // unlimited (staff)

  const lastPoll = await prisma.poll.findFirst({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!lastPoll) return; // first poll ever — always allowed

  const elapsed = Date.now() - lastPoll.createdAt.getTime();
  if (elapsed >= limits.cooldownMs) return; // cooldown passed

  // Bypass path: enough votes on others' polls since last poll.
  if (limits.votesToBypassCooldown > 0) {
    const votesSinceLastPoll = await prisma.vote.count({
      where: {
        voterId: userId,
        createdAt: { gt: lastPoll.createdAt },
        poll: { authorId: { not: userId } },
      },
    });
    if (votesSinceLastPoll >= limits.votesToBypassCooldown) return;

    const remainingMin = Math.ceil((limits.cooldownMs - elapsed) / 60000);
    throw new HttpError(
      429,
      `On cooldown. Wait ${remainingMin}m or vote on ${
        limits.votesToBypassCooldown - votesSinceLastPoll
      } more polls.`,
    );
  }

  const remainingMin = Math.ceil((limits.cooldownMs - elapsed) / 60000);
  throw new HttpError(429, `On cooldown. Wait ${remainingMin}m.`);
}
