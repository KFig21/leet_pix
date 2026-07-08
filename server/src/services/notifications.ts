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

// Fired once a poll resolves (used by the future resolution engine).
export function notifyPollOutcome(recipientId: string, pollId: string) {
  return prisma.notification.create({
    data: { recipientId, type: "POLL_OUTCOME", pollId },
  });
}
