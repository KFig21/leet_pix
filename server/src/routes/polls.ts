import { Router } from "express";
import {
  createPollSchema,
  isScoreablePoll,
  SCORING_PRESET_RULES,
  type ScoringPreset,
  type ScoringRules,
} from "@leetpix/shared";
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
import { getNflState } from "../lib/nflState";
import {
  gameStartLockAt,
  baseballStartInfo,
  pollGameIds,
} from "../lib/schedule";
import { projectedPointsByPlayer } from "../services/projections";
import { assertCanPost } from "../services/cooldown";

export const pollsRouter = Router();

// Timeline: polls from people the user follows (+ themselves). Two-tier sort —
// still-votable polls first (soonest lock at top), then everyone else by
// recency — so you act before things lock.
pollsRouter.get(
  "/timeline",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const following = await prisma.follow.findMany({
      where: { followerId: req.userId },
      select: { followingId: true },
    });
    const authorIds = [...following.map((f) => f.followingId), req.userId!];
    const candidates = await prisma.poll.findMany({
      where: { authorId: { in: authorIds } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        author: true,
        scoringFormat: true,
        options: { include: { _count: { select: { votes: true } } } },
      },
    });

    const now = Date.now();
    // Votable = OPEN and not yet past its lock time (null lock = not scheduled).
    const votable = (p: (typeof candidates)[number]) =>
      p.status === "OPEN" && (!p.lockAt || p.lockAt.getTime() > now);
    const polls = candidates
      .sort((a, b) => {
        const va = votable(a) ? 0 : 1;
        const vb = votable(b) ? 0 : 1;
        if (va !== vb) return va - vb;
        if (va === 0) {
          // Both votable: soonest lock first (unscheduled/null last).
          const la = a.lockAt?.getTime() ?? Infinity;
          const lb = b.lockAt?.getTime() ?? Infinity;
          if (la !== lb) return la - lb;
        }
        // Otherwise (and as tiebreak): newest first.
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, 50);

    res.json(
      await attachPlayerContext(
        await attachStatLines(await withMyVote(polls, req.userId)),
      ),
    );
  }),
);

// Single poll (in-depth view) with voters per option and per-option counts.
pollsRouter.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const poll = await prisma.poll.findUnique({
      where: { id: req.params.id },
      include: {
        author: true,
        scoringFormat: true,
        options: {
          include: {
            votes: { include: { voter: true } },
            _count: { select: { votes: true } },
          },
        },
      },
    });
    if (!poll) throw new HttpError(404, "Not found");
    const [withVote] = await withMyVote([poll], req.userId);
    const [withStats] = await attachStatLines([withVote]);
    const [withCtx] = await attachPlayerContext([withStats]);
    res.json(withCtx);
  }),
);

// Create a poll (enforces the 4h cooldown / 5-vote bypass).
pollsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = createPollSchema.parse(req.body);
    await assertCanPost(req.userId!);

    const playerIds = input.options.map((o) => o.playerId);

    // Tag the poll with the season/grading-period the resolver grades against,
    // and derive the GAME_START lock time from the imported schedule. Football
    // uses the current NFL week; baseball uses each player's next game date.
    // Best-effort — left null if the schedule isn't imported yet.
    let season: number | null = null;
    let week: number | null = null;
    let lockAt = input.lockAt ? new Date(input.lockAt) : null;

    if (input.sport === "FOOTBALL") {
      const nfl = await getNflState();
      season = nfl?.season ?? null;
      week = nfl?.week ?? null;
      if (input.lockType === "GAME_START" && nfl) {
        lockAt = await gameStartLockAt("FOOTBALL", nfl.season, nfl.week, playerIds);
      }
    } else if (input.sport === "BASEBALL" && input.lockType === "GAME_START") {
      const info = await baseballStartInfo(playerIds);
      if (info) {
        season = info.season;
        week = info.week;
        lockAt = info.lockAt;
      }
    }

    // Seed each option's projected points from imported projections (football
    // only — no baseball projection source). Kept fresh by the scheduler.
    let rules: ScoringRules | null = null;
    if (input.scoringPreset) {
      rules = SCORING_PRESET_RULES[input.scoringPreset as ScoringPreset];
    } else if (input.scoringFormatId) {
      const fmt = await prisma.scoringFormat.findUnique({
        where: { id: input.scoringFormatId },
        select: { rules: true },
      });
      rules = (fmt?.rules as ScoringRules) ?? null;
    }
    // Freeze the games this poll depends on (drives resolution). Only for
    // scoreable, game-locked polls with a known period/schedule.
    let gameIds: string[] = [];
    if (
      input.lockType === "GAME_START" &&
      season != null &&
      week != null &&
      isScoreablePoll(input.questionType)
    ) {
      gameIds = await pollGameIds(input.sport, season, week, playerIds);
    }

    let projected = new Map<string, number>();
    if (
      rules &&
      input.sport === "FOOTBALL" &&
      season != null &&
      week != null &&
      isScoreablePoll(input.questionType)
    ) {
      const weeks = input.evaluationWeeks
        ? Array.from({ length: input.evaluationWeeks }, (_, i) => week! + i)
        : [week];
      projected = await projectedPointsByPlayer(
        playerIds,
        season,
        weeks,
        rules,
      );
    }

    const poll = await prisma.poll.create({
      data: {
        authorId: req.userId!,
        sport: input.sport,
        questionType: input.questionType,
        horizon: input.horizon,
        lockType: input.lockType,
        lockAt,
        evaluationWeeks: input.evaluationWeeks ?? null,
        season,
        week,
        scoringPreset: input.scoringPreset ?? null,
        scoringFormatId: input.scoringFormatId ?? null,
        options: {
          create: input.options.map((o) => ({
            playerId: o.playerId,
            playerName: o.playerName,
            projectedPoints: projected.get(o.playerId) ?? null,
          })),
        },
        games: {
          create: gameIds.map((gameId) => ({ gameId })),
        },
      },
      include: { options: true },
    });
    // TODO: enqueue projection calc + lock scheduling (game-start detection).
    res.status(201).json(poll);
  }),
);
