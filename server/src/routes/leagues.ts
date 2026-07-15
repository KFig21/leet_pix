import { Router } from "express";
import { createLeagueSchema, type CreateLeagueInput } from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { userEntitlements, assertUnderCap } from "../services/entitlements";

export const leaguesRouter = Router();

const withFormat = {
  include: { scoringFormat: { select: { id: true, name: true, rules: true } } },
} as const;

// Ensure a league exists and belongs to the caller (else 404).
async function assertOwned(id: string, ownerId: string): Promise<void> {
  const league = await prisma.fantasyLeague.findFirst({
    where: { id, ownerId },
    select: { id: true },
  });
  if (!league) throw new HttpError(404, "League not found");
}

// A referenced custom scoring format must belong to the caller.
async function assertFormatOwned(
  input: CreateLeagueInput,
  ownerId: string,
): Promise<void> {
  if (!input.scoringFormatId) return;
  const fmt = await prisma.scoringFormat.findFirst({
    where: { id: input.scoringFormatId, ownerId },
    select: { id: true },
  });
  if (!fmt) throw new HttpError(400, "Scoring format not found");
}

// The signed-in user's saved leagues (with their scoring format's name/rules for
// the badge/context modal).
leaguesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const leagues = await prisma.fantasyLeague.findMany({
      where: { ownerId: req.userId },
      orderBy: { createdAt: "desc" },
      ...withFormat,
    });
    res.json(leagues);
  }),
);

// A single owned league (for the edit screen).
leaguesRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const league = await prisma.fantasyLeague.findFirst({
      where: { id: req.params.id, ownerId: req.userId! },
      ...withFormat,
    });
    if (!league) throw new HttpError(404, "League not found");
    res.json(league);
  }),
);

leaguesRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = createLeagueSchema.parse(req.body);
    await assertFormatOwned(input, req.userId!);
    const { limits } = await userEntitlements(req.userId!);
    const owned = await prisma.fantasyLeague.count({
      where: { ownerId: req.userId! },
    });
    await assertUnderCap(owned, limits.maxLeagues, "leagues");
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

leaguesRouter.put(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    await assertOwned(req.params.id, req.userId!);
    const input = createLeagueSchema.parse(req.body);
    await assertFormatOwned(input, req.userId!);
    const league = await prisma.fantasyLeague.update({
      where: { id: req.params.id },
      data: {
        name: input.name,
        sport: input.sport,
        numTeams: input.numTeams,
        lineup: input.lineup,
        scoringPreset: input.scoringPreset ?? null,
        scoringFormatId: input.scoringFormatId ?? null,
      },
    });
    res.json(league);
  }),
);

leaguesRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    await assertOwned(req.params.id, req.userId!);
    // Polls referencing it fall back to null league (onDelete: SetNull).
    await prisma.fantasyLeague.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
