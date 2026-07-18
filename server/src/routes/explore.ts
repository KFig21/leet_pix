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
import { getExplorePlayers } from "../services/trendingPlayers";

export const exploreRouter = Router();

// Discovery lists of players: trending (most-polled recently), hot, and cold.
// Defaults to football; ?sport=BASEBALL for the other.
exploreRouter.get(
  "/players",
  optionalAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const sport =
      String(req.query.sport ?? "") === Sport.BASEBALL
        ? Sport.BASEBALL
        : Sport.FOOTBALL;
    res.json(await getExplorePlayers(sport));
  }),
);

const pollInclude = {
  author: true,
  scoringFormat: true,
  league: { include: { scoringFormat: true } },
  options: {
    include: {
      _count: { select: { votes: true } },
      // A few recent voters, for the option's avatar stack on cards.
      votes: {
        take: 3,
        orderBy: { createdAt: "desc" as const },
        select: { voter: { select: { avatar: true } } },
      },
    },
  },
} as const;

// Trending polls across everyone, most-voted first. Optional ?sport= filter.
exploreRouter.get(
  "/polls",
  optionalAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const sport = String(req.query.sport ?? "");
    const where: Prisma.PollWhereInput = {
      deletedAt: null,
      hiddenAt: null,
      ...(sport === Sport.FOOTBALL || sport === Sport.BASEBALL
        ? { sport: sport as Sport }
        : {}),
    };

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
