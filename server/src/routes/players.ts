import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { Sport } from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";

export const playersRouter = Router();

// Typeahead player search over our own table. Optional ?sport= filter.
playersRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const sport = String(req.query.sport ?? "");
    if (q.length < 2) return res.json([]);

    const where: Prisma.PlayerWhereInput = {
      active: true,
      fullName: { contains: q, mode: "insensitive" },
    };
    if (sport === Sport.FOOTBALL || sport === Sport.BASEBALL) {
      where.sport = sport as Sport;
    }

    const players = await prisma.player.findMany({
      where,
      orderBy: { fullName: "asc" },
      take: 20,
      select: { id: true, fullName: true, team: true, position: true, sport: true },
    });
    res.json(players);
  }),
);
