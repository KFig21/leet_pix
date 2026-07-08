import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { computeProfileStats } from "../services/stats";

export const statsRouter = Router();

// Profile stats: accuracy by window, streaks, and heat-map cells.
statsRouter.get(
  "/:username",
  asyncHandler(async (req, res) => {
    const stats = await computeProfileStats(req.params.username);
    res.json(stats);
  }),
);
