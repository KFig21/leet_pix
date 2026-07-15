import { Router } from "express";
import { createScoringFormatSchema } from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { userEntitlements, assertUnderCap } from "../services/entitlements";

export const scoringFormatsRouter = Router();

// Ensure a format exists and belongs to the caller (else 404).
async function assertOwned(id: string, ownerId: string): Promise<void> {
  const fmt = await prisma.scoringFormat.findFirst({
    where: { id, ownerId },
    select: { id: true },
  });
  if (!fmt) throw new HttpError(404, "Scoring format not found");
}

// The signed-in user's saved formats.
scoringFormatsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const formats = await prisma.scoringFormat.findMany({
      where: { ownerId: req.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(formats);
  }),
);

// A single owned format (for the edit screen).
scoringFormatsRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const fmt = await prisma.scoringFormat.findFirst({
      where: { id: req.params.id, ownerId: req.userId! },
    });
    if (!fmt) throw new HttpError(404, "Scoring format not found");
    res.json(fmt);
  }),
);

scoringFormatsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = createScoringFormatSchema.parse(req.body);
    const { limits } = await userEntitlements(req.userId!);
    const owned = await prisma.scoringFormat.count({
      where: { ownerId: req.userId! },
    });
    await assertUnderCap(owned, limits.maxScoringFormats, "scoring formats");
    const format = await prisma.scoringFormat.create({
      data: { ownerId: req.userId!, ...input },
    });
    res.status(201).json(format);
  }),
);

scoringFormatsRouter.put(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    await assertOwned(req.params.id, req.userId!);
    const input = createScoringFormatSchema.parse(req.body);
    const format = await prisma.scoringFormat.update({
      where: { id: req.params.id },
      data: { name: input.name, sport: input.sport, rules: input.rules },
    });
    res.json(format);
  }),
);

scoringFormatsRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    await assertOwned(req.params.id, req.userId!);
    // Polls/leagues referencing it fall back to null scoring (onDelete: SetNull).
    await prisma.scoringFormat.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
