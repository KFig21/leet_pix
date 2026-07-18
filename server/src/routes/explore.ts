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

// The ?sport= query param → a known Sport, defaulting to football.
const parseSport = (v: unknown): Sport => {
  const s = String(v ?? "");
  return (Object.values(Sport) as string[]).includes(s)
    ? (s as Sport)
    : Sport.FOOTBALL;
};

// Discovery lists of players: trending (most-polled recently), hot, and cold.
// Defaults to football; ?sport=BASEBALL / BASKETBALL for the others.
exploreRouter.get(
  "/players",
  optionalAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await getExplorePlayers(parseSport(req.query.sport)));
  }),
);

// The day's slate: games kicking off today (ET). When there are none (off-day /
// off-season) it falls back to the soonest upcoming games so the section is
// never dead. Returns { label, games } — label is "Tonight" or "Upcoming".
const etDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

exploreRouter.get(
  "/slate",
  asyncHandler(async (req, res) => {
    const sport = parseSport(req.query.sport);
    const now = new Date();
    const select = {
      id: true,
      sport: true,
      homeTeam: true,
      awayTeam: true,
      kickoff: true,
      status: true,
    } as const;

    // Bracket a UTC window around "today" and keep games on the current ET date.
    const windowGames = await prisma.game.findMany({
      where: {
        sport,
        kickoff: {
          gte: new Date(now.getTime() - 18 * 3600_000),
          lte: new Date(now.getTime() + 30 * 3600_000),
        },
      },
      orderBy: { kickoff: "asc" },
      select,
    });
    const today = etDate(now);
    const todays = windowGames.filter((g) => etDate(g.kickoff) === today);
    if (todays.length) return res.json({ label: "Tonight", games: todays });

    // Fallback: the next scheduled games.
    const upcoming = await prisma.game.findMany({
      where: { sport, kickoff: { gt: now } },
      orderBy: { kickoff: "asc" },
      take: 8,
      select,
    });
    res.json({ label: "Upcoming", games: upcoming });
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
      ...((Object.values(Sport) as string[]).includes(sport)
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
