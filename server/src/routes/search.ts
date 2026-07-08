import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";

export const searchRouter = Router();

// Unified search across users, polls (by question/player), and scoring formats.
// TODO: replace ILIKE scans with Postgres full-text / trigram indexes.
searchRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) return res.json({ users: [], polls: [], formats: [] });

    const [users, polls, formats] = await Promise.all([
      prisma.profile.findMany({
        where: {
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 10,
      }),
      prisma.poll.findMany({
        // Question is now an enum, so polls are searched by referenced player.
        where: {
          options: { some: { playerName: { contains: q, mode: "insensitive" } } },
        },
        include: { author: true, options: true },
        take: 20,
      }),
      prisma.scoringFormat.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        take: 10,
      }),
    ]);

    res.json({ users, polls, formats });
  }),
);
