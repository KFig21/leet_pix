import { Router } from "express";
import { castVoteSchema } from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { notifyVote } from "../services/notifications";

export const votesRouter = Router();

// Cast a vote. Records the option's consensus snapshot for risk weighting.
votesRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { pollId, optionId } = castVoteSchema.parse(req.body);

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: { include: { _count: { select: { votes: true } } } } },
    });
    if (!poll) throw new HttpError(404, "Poll not found");
    if (poll.status !== "OPEN") throw new HttpError(409, "Poll is locked");
    if (poll.authorId === req.userId) throw new HttpError(400, "Cannot vote on your own poll");

    // One vote per user per poll (also enforced by a DB unique constraint).
    const existing = await prisma.vote.findUnique({
      where: { pollId_voterId: { pollId, voterId: req.userId! } },
    });
    if (existing) throw new HttpError(409, "You already voted on this poll");

    const totalVotes = poll.options.reduce((n, o) => n + o._count.votes, 0);
    const option = poll.options.find((o) => o.id === optionId);
    if (!option) throw new HttpError(400, "Option not in this poll");
    const consensusAtVote = totalVotes > 0 ? option._count.votes / totalVotes : 0;

    const vote = await prisma.vote.create({
      data: { pollId, optionId, voterId: req.userId!, consensusAtVote },
    });
    // Notify the poll's author that someone voted.
    await notifyVote(poll.authorId, req.userId!, poll.id);
    res.status(201).json(vote);
  }),
);
