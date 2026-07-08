import { POLL_COOLDOWN_MS, VOTES_TO_BYPASS_COOLDOWN } from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/error";

/**
 * Enforces the anti-spam rule: at most one poll per 4h, unless the user has
 * voted on >= 5 other people's polls since their last poll.
 * Throws HttpError(429) if not allowed.
 */
export async function assertCanPost(userId: string): Promise<void> {
  const lastPoll = await prisma.poll.findFirst({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (!lastPoll) return; // first poll ever — always allowed

  const elapsed = Date.now() - lastPoll.createdAt.getTime();
  if (elapsed >= POLL_COOLDOWN_MS) return; // cooldown passed

  // Bypass path: enough votes on others' polls since last poll.
  const votesSinceLastPoll = await prisma.vote.count({
    where: {
      voterId: userId,
      createdAt: { gt: lastPoll.createdAt },
      poll: { authorId: { not: userId } },
    },
  });

  if (votesSinceLastPoll >= VOTES_TO_BYPASS_COOLDOWN) return;

  const remainingMin = Math.ceil((POLL_COOLDOWN_MS - elapsed) / 60000);
  throw new HttpError(
    429,
    `On cooldown. Wait ${remainingMin}m or vote on ${
      VOTES_TO_BYPASS_COOLDOWN - votesSinceLastPoll
    } more polls.`,
  );
}
