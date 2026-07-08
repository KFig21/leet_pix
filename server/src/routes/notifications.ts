import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

export const notificationsRouter = Router();

// The signed-in user's notifications. VOTE notifications on the same poll are
// grouped into one item ("A, B and N others voted on your poll").
notificationsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const raw = await prisma.notification.findMany({
      where: { recipientId: req.userId },
      orderBy: { createdAt: "desc" },
      take: 150,
      include: { actor: true, poll: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const voteGroups = new Map<string, any>();

    for (const n of raw) {
      if (n.type === "VOTE" && n.pollId) {
        let group = voteGroups.get(n.pollId);
        if (!group) {
          group = {
            kind: "vote",
            id: n.pollId,
            poll: n.poll,
            actors: [],
            count: 0,
            read: true,
            createdAt: n.createdAt, // first seen = most recent (desc order)
          };
          voteGroups.set(n.pollId, group);
          items.push(group);
        }
        group.count += 1;
        if (group.actors.length < 3 && n.actor) group.actors.push(n.actor);
        if (!n.read) group.read = false;
      } else if (n.type === "FOLLOW") {
        items.push({
          kind: "follow",
          id: n.id,
          actor: n.actor,
          read: n.read,
          createdAt: n.createdAt,
        });
      } else if (n.type === "POLL_OUTCOME") {
        items.push({
          kind: "outcome",
          id: n.id,
          poll: n.poll,
          read: n.read,
          createdAt: n.createdAt,
        });
      }
    }

    // For follow notifications, note whether the viewer already follows back.
    const followActorIds = items
      .filter((i) => i.kind === "follow" && i.actor)
      .map((i) => i.actor.id as string);
    const backSet = new Set<string>();
    if (followActorIds.length) {
      const back = await prisma.follow.findMany({
        where: { followerId: req.userId, followingId: { in: followActorIds } },
        select: { followingId: true },
      });
      back.forEach((f) => backSet.add(f.followingId));
    }
    for (const i of items) {
      if (i.kind === "follow") i.youFollow = i.actor ? backSet.has(i.actor.id) : false;
    }

    res.json(items);
  }),
);

// Unread count for the nav badge.
notificationsRouter.get(
  "/unread-count",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const count = await prisma.notification.count({
      where: { recipientId: req.userId, read: false },
    });
    res.json({ count });
  }),
);

// Mark all as read (called when the page is opened).
notificationsRouter.post(
  "/read",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    await prisma.notification.updateMany({
      where: { recipientId: req.userId, read: false },
      data: { read: true },
    });
    res.status(204).end();
  }),
);
