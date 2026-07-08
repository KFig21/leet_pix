import { Router } from "express";
import { createPollSchema } from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import {
  requireAuth,
  optionalAuth,
  type AuthedRequest,
} from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { withMyVote } from "../lib/myVote";
import { assertCanPost } from "../services/cooldown";

export const pollsRouter = Router();

// Timeline: polls from people the user follows (+ themselves), newest first.
pollsRouter.get(
  "/timeline",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const following = await prisma.follow.findMany({
      where: { followerId: req.userId },
      select: { followingId: true },
    });
    const authorIds = [...following.map((f) => f.followingId), req.userId!];
    const polls = await prisma.poll.findMany({
      where: { authorId: { in: authorIds } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        author: true,
        scoringFormat: true,
        options: { include: { _count: { select: { votes: true } } } },
      },
    });
    res.json(await withMyVote(polls, req.userId));
  }),
);

// Single poll (in-depth view) with voters per option and per-option counts.
pollsRouter.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const poll = await prisma.poll.findUnique({
      where: { id: req.params.id },
      include: {
        author: true,
        scoringFormat: true,
        options: {
          include: {
            votes: { include: { voter: true } },
            _count: { select: { votes: true } },
          },
        },
      },
    });
    if (!poll) throw new HttpError(404, "Not found");
    const [withVote] = await withMyVote([poll], req.userId);
    res.json(withVote);
  }),
);

// Create a poll (enforces the 4h cooldown / 5-vote bypass).
pollsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = createPollSchema.parse(req.body);
    await assertCanPost(req.userId!);

    const poll = await prisma.poll.create({
      data: {
        authorId: req.userId!,
        sport: input.sport,
        questionType: input.questionType,
        lockType: input.lockType,
        lockAt: input.lockAt ? new Date(input.lockAt) : null,
        evaluationWeeks: input.evaluationWeeks ?? null,
        scoringPreset: input.scoringPreset ?? null,
        scoringFormatId: input.scoringFormatId ?? null,
        options: {
          create: input.options.map((o) => ({
            playerId: o.playerId,
            playerName: o.playerName,
          })),
        },
      },
      include: { options: true },
    });
    // TODO: enqueue projection calc + lock scheduling (game-start detection).
    res.status(201).json(poll);
  }),
);
