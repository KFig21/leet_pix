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

export interface PostingStatus {
  // Effective limits (null = unlimited, i.e. staff). cooldownMs 0 = no cooldown.
  maxPollsPerDay: number | null;
  cooldownMs: number;
  votesToBypassCooldown: number;
  // Live usage.
  postedToday: number;
  pollsLeftToday: number | null; // null = unlimited
  onCooldown: boolean;
  cooldownRemainingMs: number;
  votesSinceLastPoll: number;
  votesNeededToBypass: number; // remaining votes to skip the wait
  canPostNow: boolean;
}

/**
 * Read-only sibling of assertCanPost: reports where the user stands on both the
 * daily cap and the cooldown (so the create screen can explain the rules and
 * show live progress) without throwing.
 */
export async function getPostingStatus(userId: string): Promise<PostingStatus> {
  const { limits } = await userEntitlements(userId);
  const now = Date.now();
  const capped = Number.isFinite(limits.maxPollsPerDay);

  const postedToday = capped
    ? await prisma.poll.count({
        where: { authorId: userId, createdAt: { gt: new Date(now - DAY_MS) } },
      })
    : 0;
  const pollsLeftToday = capped
    ? Math.max(0, limits.maxPollsPerDay - postedToday)
    : null;
  const dayCapReached = capped && postedToday >= limits.maxPollsPerDay;

  let onCooldown = false;
  let cooldownRemainingMs = 0;
  let votesSinceLastPoll = 0;
  let votesNeededToBypass = 0;

  if (limits.cooldownMs > 0) {
    const lastPoll = await prisma.poll.findFirst({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (lastPoll) {
      const elapsed = now - lastPoll.createdAt.getTime();
      if (elapsed < limits.cooldownMs) {
        cooldownRemainingMs = limits.cooldownMs - elapsed;
        if (limits.votesToBypassCooldown > 0) {
          votesSinceLastPoll = await prisma.vote.count({
            where: {
              voterId: userId,
              createdAt: { gt: lastPoll.createdAt },
              poll: { authorId: { not: userId } },
            },
          });
          votesNeededToBypass = Math.max(
            0,
            limits.votesToBypassCooldown - votesSinceLastPoll,
          );
          onCooldown = votesNeededToBypass > 0;
        } else {
          onCooldown = true;
        }
      }
    }
  }

  return {
    maxPollsPerDay: capped ? limits.maxPollsPerDay : null,
    cooldownMs: limits.cooldownMs,
    votesToBypassCooldown: limits.votesToBypassCooldown,
    postedToday,
    pollsLeftToday,
    onCooldown,
    cooldownRemainingMs,
    votesSinceLastPoll,
    votesNeededToBypass,
    canPostNow: !onCooldown && !dayCapReached,
  };
}
