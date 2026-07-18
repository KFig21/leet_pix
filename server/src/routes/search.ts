import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { optionalAuth, type AuthedRequest } from "../middleware/auth";
import { withMyVote } from "../lib/myVote";
import { attachStatLines } from "../lib/statLines";
import { attachPlayerContext } from "../lib/playerContext";

export const searchRouter = Router();

const pollInclude = {
  author: true,
  scoringFormat: true,
  league: { include: { scoringFormat: true } },
  options: {
    include: {
      _count: { select: { votes: true } },
      votes: {
        take: 3,
        orderBy: { createdAt: "desc" as const },
        select: { voter: { select: { avatar: true } } },
      },
    },
  },
} as const;

// Only surface live polls from active authors.
const LIVE_POLL = {
  deletedAt: null,
  hiddenAt: null,
  author: { is: { deactivatedAt: null } },
} as const;

// Unified search + related-poll lookups. Three modes (checked in order):
//   ?playerId= → recent polls referencing that player
//   ?gameId=   → recent polls referencing either team's players in that matchup
//   ?q=        → text search across users, players-in-polls, and scoring formats
searchRouter.get(
  "/",
  optionalAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const playerId = typeof req.query.playerId === "string" ? req.query.playerId : "";
    const gameId = typeof req.query.gameId === "string" ? req.query.gameId : "";

    // ── Related: a specific player ──
    if (playerId) {
      const [player, polls] = await Promise.all([
        prisma.player.findUnique({
          where: { id: playerId },
          select: { fullName: true },
        }),
        prisma.poll.findMany({
          where: { ...LIVE_POLL, options: { some: { playerId } } },
          orderBy: { createdAt: "desc" },
          take: 25,
          include: pollInclude,
        }),
      ]);
      return res.json({
        label: player?.fullName ?? "Player",
        users: [],
        polls: await attachPlayerContext(
          await attachStatLines(await withMyVote(polls, req.userId)),
        ),
        formats: [],
      });
    }

    // ── Related: a specific game (either team's players) ──
    if (gameId) {
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: { sport: true, homeTeam: true, awayTeam: true },
      });
      if (!game) {
        return res.json({ label: "Game", users: [], polls: [], formats: [] });
      }
      const players = await prisma.player.findMany({
        where: { sport: game.sport, team: { in: [game.homeTeam, game.awayTeam] } },
        select: { id: true },
      });
      const ids = players.map((p) => p.id);
      const polls = ids.length
        ? await prisma.poll.findMany({
            where: { ...LIVE_POLL, options: { some: { playerId: { in: ids } } } },
            orderBy: { createdAt: "desc" },
            take: 25,
            include: pollInclude,
          })
        : [];
      return res.json({
        label: `${game.awayTeam} @ ${game.homeTeam}`,
        users: [],
        polls: await attachPlayerContext(
          await attachStatLines(await withMyVote(polls, req.userId)),
        ),
        formats: [],
      });
    }

    // ── Text search ──
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) return res.json({ users: [], polls: [], formats: [] });

    const [users, polls, formats] = await Promise.all([
      prisma.profile.findMany({
        where: {
          deactivatedAt: null,
          deletedAt: null,
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 10,
      }),
      prisma.poll.findMany({
        where: {
          ...LIVE_POLL,
          options: { some: { playerName: { contains: q, mode: "insensitive" } } },
        },
        orderBy: { createdAt: "desc" },
        include: pollInclude,
        take: 20,
      }),
      prisma.scoringFormat.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        take: 10,
      }),
    ]);

    res.json({ users, polls: await attachPlayerContext(
          await attachStatLines(await withMyVote(polls, req.userId)),
        ), formats });
  }),
);
