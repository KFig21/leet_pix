import { Router } from "express";
import {
  createPollSchema,
  isScoreablePoll,
  isSeasonProjectionPoll,
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
import {
  projectedPointsByPlayer,
  projectionWeeks,
  resolveScoringRules,
} from "../services/projections";
import { assertCanPost } from "../services/cooldown";

export const pollsRouter = Router();

// Projected points for a set of players under the chosen scoring — used by the
// create-screen live preview. Prices them exactly as poll creation would
// (rest-of-season for keeper questions, else the poll's window) without saving
// anything. Returns {} whenever there's nothing meaningful to project.
pollsRouter.post(
  "/preview-projections",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const {
      sport,
      questionType,
      playerIds,
      leagueId,
      scoringPreset,
      scoringFormatId,
      evaluationWeeks,
    } = req.body ?? {};

    const empty = () => res.json({ projections: {} });
    if (
      sport !== "FOOTBALL" ||
      !Array.isArray(playerIds) ||
      playerIds.length === 0 ||
      (!isScoreablePoll(questionType) && !isSeasonProjectionPoll(questionType))
    ) {
      return empty();
    }

    const rules = await resolveScoringRules({
      leagueId,
      scoringPreset,
      scoringFormatId,
      ownerId: req.userId!,
    });

    const nfl = await getNflState();
    if (!rules || !nfl) return empty();

    const weeks = projectionWeeks(questionType, nfl.week, evaluationWeeks ?? null);
    const map = await projectedPointsByPlayer(
      playerIds,
      nfl.season,
      weeks,
      rules,
    );
    res.json({ projections: Object.fromEntries(map) });
  }),
);

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
      where: { authorId: { in: authorIds }, deletedAt: null, hiddenAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
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
        league: { include: { scoringFormat: true } },
        options: {
          include: {
            votes: { include: { voter: true } },
            _count: { select: { votes: true } },
          },
        },
      },
    });
    if (!poll || poll.deletedAt || poll.hiddenAt) throw new HttpError(404, "Not found");
    const [withVote] = await withMyVote([poll], req.userId);
    const [withStats] = await attachStatLines([withVote]);
    const [withCtx] = await attachPlayerContext([withStats]);
    res.json(withCtx);
  }),
);

// Delete a poll (author only). Lifecycle policy: a poll with no votes can be
// hard-deleted; once anyone has voted it's only soft-hidden (deletedAt), so
// voters' graded records survive. Moderator/void flows are separate.
pollsRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const poll = await prisma.poll.findUnique({
      where: { id: req.params.id },
      select: { authorId: true, deletedAt: true, _count: { select: { votes: true } } },
    });
    if (!poll || poll.deletedAt) throw new HttpError(404, "Not found");
    if (poll.authorId !== req.userId) throw new HttpError(403, "Not your poll");

    if (poll._count.votes === 0) {
      await prisma.poll.delete({ where: { id: req.params.id } });
      return res.status(204).end();
    }
    // Has votes → soft delete; keep the row and its results intact.
    await prisma.poll.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.status(200).json({ softDeleted: true });
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

    // Resolve scoring rules (for projection seeding) from the attached league —
    // which owns its scoring and supplies the keeper leagueSize — else the poll's
    // own preset/custom format. Kept fresh by the scheduler.
    let rules: ScoringRules | null = null;
    let leagueSize: number | null = input.leagueSize ?? null;
    if (input.leagueId) {
      const league = await prisma.fantasyLeague.findFirst({
        where: { id: input.leagueId, ownerId: req.userId! },
        include: { scoringFormat: { select: { rules: true } } },
      });
      if (!league) throw new HttpError(400, "League not found");
      rules = league.scoringFormat
        ? (league.scoringFormat.rules as ScoringRules)
        : league.scoringPreset
          ? SCORING_PRESET_RULES[league.scoringPreset as ScoringPreset]
          : null;
      leagueSize = league.numTeams;
    } else if (input.scoringPreset) {
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

    // Scoreable polls get a graded projection; keeper (season-long) polls get
    // an informational rest-of-season projection. Both freeze the same rules.
    let projected = new Map<string, number>();
    if (
      rules &&
      input.sport === "FOOTBALL" &&
      season != null &&
      week != null &&
      (isScoreablePoll(input.questionType) ||
        isSeasonProjectionPoll(input.questionType))
    ) {
      const weeks = projectionWeeks(
        input.questionType,
        week,
        input.evaluationWeeks ?? null,
      );
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
        leagueSize,
        season,
        week,
        // A league owns scoring, so blank the poll's own scoring fields then.
        leagueId: input.leagueId ?? null,
        scoringPreset: input.leagueId ? null : input.scoringPreset ?? null,
        scoringFormatId: input.leagueId ? null : input.scoringFormatId ?? null,
        // Freeze the effective rules so later edits to the league/format can't
        // silently re-score this poll (resolution/projections prefer this).
        resolvedScoring: rules ?? undefined,
        options: {
          create: input.options.map((o) => ({
            playerId: o.playerId,
            playerName: o.playerName,
            keeperRound: o.keeperRound ?? null,
            keeperPick: o.keeperPick ?? null,
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
