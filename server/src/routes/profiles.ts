import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { updateProfileSchema, usernameSchema } from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import {
  requireAuth,
  optionalAuth,
  type AuthedRequest,
} from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { withMyVote } from "../lib/myVote";
import { attachStatLines } from "../lib/statLines";
import { attachPlayerContext } from "../lib/playerContext";
import { containsProfanity } from "../lib/profanity";
import { notifyFollow } from "../services/notifications";

export const profilesRouter = Router();

// Number of setup-wizard pages (welcome … poll view). The last index is
// STEP_COUNT - 1; `step` is clamped into range.
const ONBOARDING_STEP_COUNT = 8;

// Defaults used when a profile row must be created before the user has filled it
// in (e.g. saving onboarding progress before the username step).
const DEFAULT_PROFILE_CREATE = (userId: string) => ({
  id: userId,
  username: `user_${userId.slice(0, 8)}`,
  displayName: "New User",
  avatar: { icon: "football", iconColor: "#fff", bgColor: "#1d9bf0" },
});

// Screen the user-authored profile fields for profanity. Only checks fields
// actually present in this update (partial PUT), so a user editing just their
// bio doesn't get re-validated against a username they aren't changing.
function assertClean(fields: {
  username?: string;
  displayName?: string;
  bio?: string;
}) {
  if (fields.username !== undefined && containsProfanity(fields.username)) {
    throw new HttpError(400, "Choose a different username");
  }
  if (fields.displayName !== undefined && containsProfanity(fields.displayName)) {
    throw new HttpError(400, "Choose a different display name");
  }
  if (fields.bio !== undefined && containsProfanity(fields.bio)) {
    throw new HttpError(400, "Please remove inappropriate language from your bio");
  }
}

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

// Mark the first-run walkthrough as seen (idempotent — only stamps once).
profilesRouter.post(
  "/me/onboarded",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const onboardedAt = new Date();
    // updateMany so a not-yet-created profile is a no-op rather than a 500.
    await prisma.profile.updateMany({
      where: { id: req.userId, onboardedAt: null },
      data: { onboardedAt },
    });
    res.json({ onboardedAt });
  }),
);

// Setup-wizard progress. Never 404s — a user without a profile row yet reads as
// "not started" so the gate can send them into onboarding.
profilesRouter.get(
  "/me/onboarding",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const profile = await prisma.profile.findUnique({
      where: { id: req.userId },
      select: { onboardingStep: true, onboardingCompletedAt: true },
    });
    res.json({
      step: profile?.onboardingStep ?? 0,
      completed: !!profile?.onboardingCompletedAt,
    });
  }),
);

const onboardingPatchSchema = z.object({
  step: z.number().int().min(0).max(ONBOARDING_STEP_COUNT - 1).optional(),
  complete: z.boolean().optional(),
});

// Save wizard progress (the page left off on) and/or mark it finished. Upserts
// so progress persists even before the username step creates the profile.
profilesRouter.patch(
  "/me/onboarding",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { step, complete } = onboardingPatchSchema.parse(req.body);
    const data: Prisma.ProfileUpdateInput = {};
    if (step !== undefined) data.onboardingStep = step;
    if (complete) data.onboardingCompletedAt = new Date();

    const profile = await prisma.profile.upsert({
      where: { id: req.userId },
      update: data,
      create: {
        ...DEFAULT_PROFILE_CREATE(req.userId!),
        onboardingStep: step ?? 0,
        onboardingCompletedAt: complete ? new Date() : null,
      },
      select: { onboardingStep: true, onboardingCompletedAt: true },
    });
    res.json({
      step: profile.onboardingStep,
      completed: !!profile.onboardingCompletedAt,
    });
  }),
);

// Username availability for the onboarding/profile forms — case-insensitive,
// excluding the caller's own current username.
profilesRouter.get(
  "/username-available",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = usernameSchema.safeParse(String(req.query.u ?? ""));
    if (!parsed.success) return res.json({ available: false, valid: false });
    const existing = await prisma.profile.findFirst({
      where: {
        username: { equals: parsed.data, mode: "insensitive" },
        NOT: { id: req.userId },
      },
      select: { id: true },
    });
    res.json({ available: !existing, valid: true });
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
  league: { include: { scoringFormat: true } },
  options: {
    include: {
      _count: { select: { votes: true } },
      // A few recent voters, for the option's avatar stack on cards.
      votes: {
        take: 3,
        orderBy: { createdAt: "desc" as const },
        select: { voter: { select: { avatar: true } } },
      },
    },
  },
} as const;

async function profileByUsername(username: string) {
  const profile = await prisma.profile.findUnique({ where: { username } });
  if (!profile) throw new HttpError(404, "Not found");
  return profile;
}

// Cursor-paginated page size for the profile feeds (1..50).
const feedLimit = (v: unknown) => Math.min(Math.max(Number(v) || 20, 1), 50);

// A user's polls (their "posts"), cursor-paginated for infinite scroll.
profilesRouter.get(
  "/:username/polls",
  optionalAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const profile = await profileByUsername(req.params.username);
    const limit = feedLimit(req.query.limit);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;

    const rows = await prisma.poll.findMany({
      where: { authorId: profile.id, deletedAt: null, hiddenAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: pollInclude,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    const items = await attachPlayerContext(
      await attachStatLines(await withMyVote(page, req.userId)),
    );
    res.json({ items, nextCursor });
  }),
);

// A user's votes ("picks") with the poll and the option they chose,
// cursor-paginated (cursor is the vote id).
profilesRouter.get(
  "/:username/votes",
  optionalAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const profile = await profileByUsername(req.params.username);
    const limit = feedLimit(req.query.limit);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;

    const rows = await prisma.vote.findMany({
      where: {
        voterId: profile.id,
        poll: { is: { deletedAt: null, hiddenAt: null } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { poll: { include: pollInclude }, option: true },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    // Tag each pick's poll with the viewer's own vote.
    const polls = await attachPlayerContext(
      await attachStatLines(
        await withMyVote(
          page.map((v) => v.poll),
          req.userId,
        ),
      ),
    );
    const byId = new Map(polls.map((p) => [p.id, p]));
    const items = page.map((v) => ({ ...v, poll: byId.get(v.poll.id) }));
    res.json({ items, nextCursor });
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
    assertClean(data);
    try {
      const profile = await prisma.profile.upsert({
        where: { id: req.userId },
        update: data,
        create: {
          ...DEFAULT_PROFILE_CREATE(req.userId!),
          username: data.username ?? `user_${req.userId!.slice(0, 8)}`,
          displayName: data.displayName ?? "New User",
          bio: data.bio,
          avatar: data.avatar ?? { icon: "football", iconColor: "#fff", bgColor: "#1d9bf0" },
        },
      });
      res.json(profile);
    } catch (e) {
      // Unique-constraint violation = the chosen username is taken.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpError(409, "That username is taken");
      }
      throw e;
    }
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
