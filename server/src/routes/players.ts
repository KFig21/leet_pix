import { Router } from "express";
import type { Prisma } from "@prisma/client";
import {
  Sport,
  isScoreablePoll,
  isSeasonProjectionPoll,
  scoreStatLine,
  type PollQuestionType,
  type ScoringRules,
} from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { upcomingGameByTeam } from "../lib/schedule";
import { streaksByPlayer } from "../services/streaks";
import { getNflState } from "../lib/nflState";
import {
  pollRules,
  projectedPointsForSport,
  projectedStatLine,
  projectionWeeks,
  resolveScoringRules,
} from "../services/projections";

export const playersRouter = Router();

const asSport = (v: unknown): Sport | undefined =>
  v === Sport.FOOTBALL || v === Sport.BASEBALL ? (v as Sport) : undefined;

// Parse a repeatable/CSV query param (?team=A,B or ?team=A&team=B) into a list.
const asList = (v: unknown): string[] =>
  (Array.isArray(v) ? v.map(String) : String(v ?? "").split(","))
    .map((s) => s.trim())
    .filter(Boolean);

// Distinct teams/positions available for a sport, so the create screen can offer
// filter dropdowns that always match what's actually in the table.
playersRouter.get(
  "/facets",
  requireAuth,
  asyncHandler(async (req, res) => {
    const sport = asSport(req.query.sport);
    const where: Prisma.PlayerWhereInput = { active: true };
    if (sport) where.sport = sport;

    const rows = await prisma.player.findMany({
      where,
      distinct: ["team", "position"],
      select: { team: true, position: true },
    });
    const teams = [...new Set(rows.map((r) => r.team).filter(Boolean))].sort();
    const positions = [
      ...new Set(rows.map((r) => r.position).filter(Boolean)),
    ].sort();

    // Each team's next game (opponent + kickoff), so the create screen's team
    // filter can show who plays that day/week.
    const games: Record<
      string,
      { opponent: string; atHome: boolean; kickoff: string }
    > = {};
    if (sport) {
      const byTeam = await upcomingGameByTeam(
        sport,
        teams.filter((t): t is string => !!t),
      );
      for (const [team, g] of byTeam) {
        const atHome = g.homeTeam === team;
        games[team] = {
          opponent: atHome ? g.awayTeam : g.homeTeam,
          atHome,
          kickoff: g.kickoff.toISOString(),
        };
      }
    }

    res.json({ teams, positions, games });
  }),
);

// Projected stat-line breakdown for one player, for the projection modal.
// Scoring context comes either from a poll (?pollId, using its frozen rules and
// grading window) or from create-screen params (?questionType &leagueId /
// &scoringPreset / &scoringFormatId &evaluationWeeks, using the current week).
playersRouter.get(
  "/:playerId/projection",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const player = await prisma.player.findUnique({
      where: { id: req.params.playerId },
      select: { fullName: true, position: true, sport: true },
    });
    if (!player) throw new HttpError(404, "Player not found");

    let rules: ScoringRules | null = null;
    let season: number;
    let weeks: number[];
    let scoringPreset: string | null = null;
    let scoringFormat: { id: string; name: string; rules: unknown } | null = null;

    const pollId = (req.query.pollId as string) || null;
    if (pollId) {
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          scoringFormat: true,
          league: { include: { scoringFormat: true } },
        },
      });
      if (!poll || poll.season == null || poll.week == null) {
        throw new HttpError(404, "Poll not projectable");
      }
      rules = pollRules(poll);
      season = poll.season;
      weeks = projectionWeeks(
        poll.questionType as PollQuestionType,
        poll.week,
        poll.evaluationWeeks,
      );
      scoringPreset = poll.league?.scoringPreset ?? poll.scoringPreset ?? null;
      const fmt = poll.league?.scoringFormat ?? poll.scoringFormat;
      scoringFormat = fmt ? { id: fmt.id, name: fmt.name, rules: fmt.rules } : null;
    } else {
      const questionType = String(req.query.questionType ?? "");
      const evaluationWeeks = req.query.evaluationWeeks
        ? Number(req.query.evaluationWeeks)
        : null;
      const resolved = await resolveScoringRules({
        leagueId: (req.query.leagueId as string) || null,
        scoringPreset: (req.query.scoringPreset as string) || null,
        scoringFormatId: (req.query.scoringFormatId as string) || null,
        ownerId: req.userId!,
      });
      const nfl = await getNflState();
      if (!resolved || !nfl) throw new HttpError(400, "No scoring context");
      rules = resolved;
      season = nfl.season;
      weeks = projectionWeeks(questionType as PollQuestionType, nfl.week, evaluationWeeks);
      scoringPreset = (req.query.scoringPreset as string) || null;
      const formatId = (req.query.scoringFormatId as string) || null;
      if (formatId) {
        const fmt = await prisma.scoringFormat.findUnique({ where: { id: formatId } });
        scoringFormat = fmt ? { id: fmt.id, name: fmt.name, rules: fmt.rules } : null;
      }
    }

    if (!rules) throw new HttpError(400, "No scoring rules for this context");

    const statLine = await projectedStatLine(req.params.playerId, season, weeks);
    const total = scoreStatLine(statLine, rules, player.position);

    const seasonLong = weeks.length > 1;
    const periodLabel = seasonLong
      ? "Season projection"
      : player.sport === "FOOTBALL"
        ? `Week ${weeks[0]} projection`
        : "Projection";

    res.json({
      playerName: player.fullName,
      position: player.position,
      sport: player.sport,
      // Multiple weeks → a season-long projection (keeper): the client rounds
      // those to whole numbers; a single week keeps one decimal.
      seasonLong,
      periodLabel,
      statLine,
      total,
      rules,
      scoringPreset,
      scoringFormat,
    });
  }),
);

// Typeahead player search over our own table. Filters: ?sport= &team= &position=.
// A team/position filter enables browse mode (results without a search query).
playersRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const q = String(req.query.q ?? "").trim();
    const sport = asSport(req.query.sport);
    const teams = asList(req.query.team);
    const positions = asList(req.query.position);
    const hasFilter = teams.length > 0 || positions.length > 0;
    const hasQuery = q.length >= 2;
    // Optional scoring context: when the create screen supplies it, each result
    // carries its projected points under those rules (shown in the picker).
    const questionType = String(req.query.questionType ?? "");
    const evaluationWeeks = req.query.evaluationWeeks
      ? Number(req.query.evaluationWeeks)
      : null;

    // Projectable question + scoring context → rank results by projection (most
    // relevant first) and, with no query/filter, default to the best players.
    const wantProj =
      sport === Sport.FOOTBALL &&
      questionType !== "" &&
      (isScoreablePoll(questionType as never) ||
        isSeasonProjectionPoll(questionType as never));

    // Without a query, a filter, or a projection ranking, there's nothing to
    // browse — a bare open shouldn't dump the whole table alphabetically.
    if (!hasQuery && !hasFilter && !wantProj) return res.json([]);

    const where: Prisma.PlayerWhereInput = { active: true };
    if (sport) where.sport = sport;
    if (hasQuery) where.fullName = { contains: q, mode: "insensitive" };
    if (teams.length) where.team = { in: teams };
    if (positions.length) where.position = { in: positions };

    const RESULT_LIMIT = 20;
    const selectFields = {
      id: true,
      fullName: true,
      team: true,
      position: true,
      sport: true,
      injuryStatus: true,
    } as const;

    // Projection map (cached full-pool) so ranking sees every player, not just an
    // alphabetical slice — and the "best players" default has something to sort.
    let projById = new Map<string, number>();
    if (wantProj) {
      const rules = await resolveScoringRules({
        leagueId: (req.query.leagueId as string) || null,
        scoringPreset: (req.query.scoringPreset as string) || null,
        scoringFormatId: (req.query.scoringFormatId as string) || null,
        ownerId: req.userId!,
      });
      const nfl = await getNflState();
      if (rules && nfl) {
        const weeks = projectionWeeks(questionType as never, nfl.week, evaluationWeeks);
        projById = await projectedPointsForSport(sport!, nfl.season, weeks, rules);
      }
    }

    let players: Array<{
      id: string;
      fullName: string;
      team: string | null;
      position: string | null;
      sport: Sport;
      injuryStatus: string | null;
    }>;

    if (wantProj && !hasQuery && !hasFilter) {
      // Default "best players": take the top-projected ids straight from the map,
      // then hydrate just those rows (no need to scan the whole table).
      const topIds = [...projById.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, RESULT_LIMIT)
        .map(([id]) => id);
      const rows = await prisma.player.findMany({
        where: { id: { in: topIds }, active: true },
        select: selectFields,
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      players = topIds.map((id) => byId.get(id)).filter((p): p is (typeof rows)[number] => !!p);
    } else {
      // Query/filter: rank the matching candidates by projection, then trim.
      const candidates = await prisma.player.findMany({
        where,
        orderBy: { fullName: "asc" },
        take: wantProj ? 200 : RESULT_LIMIT,
        select: selectFields,
      });
      const ranked = wantProj
        ? [...candidates].sort((a, b) => {
            const pa = projById.get(a.id) ?? null;
            const pb = projById.get(b.id) ?? null;
            if (pa == null && pb == null) return a.fullName.localeCompare(b.fullName);
            if (pa == null) return 1;
            if (pb == null) return -1;
            return pb - pa;
          })
        : candidates;
      players = ranked.slice(0, RESULT_LIMIT);
    }

    // Attach each result's next game (opponent + kickoff) so the picker shows
    // who they play — best-effort (needs the schedule imported). Final 20 only.
    const resultTeams = players
      .map((p) => p.team)
      .filter((t): t is string => !!t);
    const byTeam =
      sport && resultTeams.length
        ? await upcomingGameByTeam(sport, resultTeams)
        : null;
    // Recent-form (hot/cold) badge per result, batched.
    const streaks = await streaksByPlayer(players.map((p) => p.id));

    res.json(
      players.map((p) => {
        const g = p.team ? byTeam?.get(p.team) : undefined;
        const opponent = g
          ? g.homeTeam === p.team
            ? { abbr: g.awayTeam, atHome: true }
            : { abbr: g.homeTeam, atHome: false }
          : null;
        return {
          ...p,
          streak: streaks.get(p.id) ?? null,
          projectedPoints: projById.get(p.id) ?? null,
          game: opponent
            ? { opponent: opponent.abbr, atHome: opponent.atHome, kickoff: g!.kickoff }
            : null,
        };
      }),
    );
  }),
);
