import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { Sport } from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import {
  requireAuth,
  optionalAuth,
  type AuthedRequest,
} from "../middleware/auth";
import { withMyVote } from "../lib/myVote";
import { attachStatLines } from "../lib/statLines";
import { attachPlayerContext } from "../lib/playerContext";

export const exploreRouter = Router();

const pollInclude = {
  author: true,
  scoringFormat: true,
  options: { include: { _count: { select: { votes: true } } } },
} as const;

// Trending polls across everyone, most-voted first. Optional ?sport= filter.
exploreRouter.get(
  "/polls",
  optionalAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const sport = String(req.query.sport ?? "");
    const where: Prisma.PollWhereInput =
      sport === Sport.FOOTBALL || sport === Sport.BASEBALL
        ? { sport: sport as Sport }
        : {};

    const polls = await prisma.poll.findMany({
      where,
      orderBy: [{ votes: { _count: "desc" } }, { createdAt: "desc" }],
      take: 25,
      include: pollInclude,
    });
    res.json(
      await attachPlayerContext(
        await attachStatLines(await withMyVote(polls, req.userId)),
      ),
    );
  }),
);

// Suggested accounts: most-followed, excluding self and people you follow.
exploreRouter.get(
  "/users",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const following = await prisma.follow.findMany({
      where: { followerId: req.userId },
      select: { followingId: true },
    });
    const exclude = [req.userId!, ...following.map((f) => f.followingId)];

    const users = await prisma.profile.findMany({
      where: { id: { notIn: exclude } },
      orderBy: { followers: { _count: "desc" } },
      take: 10,
    });
    res.json(users);
  }),
);
