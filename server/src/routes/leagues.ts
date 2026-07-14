import { Router } from "express";
import { createLeagueSchema } from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { HttpError } from "../middleware/error";

export const leaguesRouter = Router();

// The signed-in user's saved leagues (with their scoring format's name/rules for
// the badge/context modal).
leaguesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const leagues = await prisma.fantasyLeague.findMany({
      where: { ownerId: req.userId },
      orderBy: { createdAt: "desc" },
      include: { scoringFormat: { select: { id: true, name: true, rules: true } } },
    });
    res.json(leagues);
  }),
);

leaguesRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = createLeagueSchema.parse(req.body);
    // A referenced custom format must belong to the caller.
    if (input.scoringFormatId) {
      const fmt = await prisma.scoringFormat.findFirst({
        where: { id: input.scoringFormatId, ownerId: req.userId! },
        select: { id: true },
      });
      if (!fmt) throw new HttpError(400, "Scoring format not found");
    }
    const league = await prisma.fantasyLeague.create({
      data: {
        ownerId: req.userId!,
        name: input.name,
        sport: input.sport,
        numTeams: input.numTeams,
        lineup: input.lineup,
        scoringPreset: input.scoringPreset ?? null,
        scoringFormatId: input.scoringFormatId ?? null,
      },
    });
    res.status(201).json(league);
  }),
);
