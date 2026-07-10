import { prisma } from "../lib/prisma";

// Small helpers to emit notifications from event handlers.

export function notifyFollow(recipientId: string, actorId: string) {
  return prisma.notification.create({
    data: { recipientId, actorId, type: "FOLLOW" },
  });
}

export function notifyVote(recipientId: string, actorId: string, pollId: string) {
  return prisma.notification.create({
    data: { recipientId, actorId, type: "VOTE", pollId },
  });
}

// Fired once a poll resolves: notify the author and everyone who voted so they
// know to come see how it graded. One POLL_OUTCOME per recipient (deduped).
export function notifyPollResolved(
  pollId: string,
  authorId: string,
  voterIds: string[],
) {
  const recipientIds = [...new Set([authorId, ...voterIds])];
  return prisma.notification.createMany({
    data: recipientIds.map((recipientId) => ({
      recipientId,
      type: "POLL_OUTCOME" as const,
      pollId,
    })),
  });
}
