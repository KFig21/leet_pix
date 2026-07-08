import { Router } from "express";
import { createScoringFormatSchema } from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

export const scoringFormatsRouter = Router();

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

scoringFormatsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = createScoringFormatSchema.parse(req.body);
    const format = await prisma.scoringFormat.create({
      data: { ownerId: req.userId!, ...input },
    });
    res.status(201).json(format);
  }),
);
