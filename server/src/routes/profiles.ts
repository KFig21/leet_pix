import { Router } from "express";
import { updateProfileSchema } from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import {
  requireAuth,
  optionalAuth,
  type AuthedRequest,
} from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { withMyVote } from "../lib/myVote";
import { notifyFollow } from "../services/notifications";

export const profilesRouter = Router();

// Current user's profile.
profilesRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const profile = await prisma.profile.findUnique({
      where: { id: req.userId },
    });
    if (!profile) throw new HttpError(404, "Profile not set up");
    res.json(profile);
  }),
);

// Public profile by username. Includes whether the viewer follows this user.
profilesRouter.get(
  "/:username",
  optionalAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const profile = await prisma.profile.findUnique({
      where: { username: req.params.username },
      include: {
        _count: {
          select: { followers: true, following: true, polls: true, votes: true },
        },
      },
    });
    if (!profile) throw new HttpError(404, "Not found");

    let isFollowing = false;
    if (req.userId && req.userId !== profile.id) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: req.userId,
            followingId: profile.id,
          },
        },
      });
      isFollowing = !!follow;
    }
    res.json({ ...profile, isFollowing });
  }),
);

// Shared include: return polls in the same shape as the timeline/feed.
const pollInclude = {
  author: true,
  scoringFormat: true,
  options: { include: { _count: { select: { votes: true } } } },
} as const;

async function profileByUsername(username: string) {
  const profile = await prisma.profile.findUnique({ where: { username } });
  if (!profile) throw new HttpError(404, "Not found");
  return profile;
}

// A user's polls (their "posts").
profilesRouter.get(
  "/:username/polls",
  optionalAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const profile = await profileByUsername(req.params.username);
    const polls = await prisma.poll.findMany({
      where: { authorId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: pollInclude,
    });
    res.json(await withMyVote(polls, req.userId));
  }),
);

// A user's votes ("picks") with the poll and the option they chose.
profilesRouter.get(
  "/:username/votes",
  optionalAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const profile = await profileByUsername(req.params.username);
    const votes = await prisma.vote.findMany({
      where: { voterId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { poll: { include: pollInclude }, option: true },
    });
    // Tag each pick's poll with the viewer's own vote.
    const polls = await withMyVote(
      votes.map((v) => v.poll),
      req.userId,
    );
    const byId = new Map(polls.map((p) => [p.id, p]));
    res.json(votes.map((v) => ({ ...v, poll: byId.get(v.poll.id) })));
  }),
);

// Followers / following as profile summaries.
profilesRouter.get(
  "/:username/followers",
  asyncHandler(async (req, res) => {
    const profile = await profileByUsername(req.params.username);
    const rows = await prisma.follow.findMany({
      where: { followingId: profile.id },
      include: { follower: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map((r) => r.follower));
  }),
);

profilesRouter.get(
  "/:username/following",
  asyncHandler(async (req, res) => {
    const profile = await profileByUsername(req.params.username);
    const rows = await prisma.follow.findMany({
      where: { followerId: profile.id },
      include: { following: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map((r) => r.following));
  }),
);

// Create/update the signed-in user's profile.
profilesRouter.put(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = updateProfileSchema.parse(req.body);
    const profile = await prisma.profile.upsert({
      where: { id: req.userId },
      update: data,
      create: {
        id: req.userId!,
        username: data.username ?? `user_${req.userId!.slice(0, 8)}`,
        displayName: data.displayName ?? "New User",
        bio: data.bio,
        avatar: data.avatar ?? { icon: "football", iconColor: "#fff", bgColor: "#1d9bf0" },
      },
    });
    res.json(profile);
  }),
);

// Follow / unfollow.
profilesRouter.post(
  "/:id/follow",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.params.id === req.userId) throw new HttpError(400, "Cannot follow yourself");
    // Only notify on a genuinely new follow (avoid re-follow spam).
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.userId!, followingId: req.params.id } },
    });
    if (!existing) {
      await prisma.follow.create({
        data: { followerId: req.userId!, followingId: req.params.id },
      });
      await notifyFollow(req.params.id, req.userId!);
    }
    res.status(204).end();
  }),
);

profilesRouter.delete(
  "/:id/follow",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    await prisma.follow.deleteMany({
      where: { followerId: req.userId!, followingId: req.params.id },
    });
    res.status(204).end();
  }),
);
