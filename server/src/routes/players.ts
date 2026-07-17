import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { Sport, isScoreablePoll, isSeasonProjectionPoll } from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { upcomingGameByTeam } from "../lib/schedule";
import { streaksByPlayer } from "../services/streaks";
import { getNflState } from "../lib/nflState";
import {
  projectedPointsByPlayer,
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
    // Optional scoring context: when the create screen supplies it, each result
    // carries its projected points under those rules (shown in the picker).
    const questionType = String(req.query.questionType ?? "");
    const evaluationWeeks = req.query.evaluationWeeks
      ? Number(req.query.evaluationWeeks)
      : null;

    // Need either a query (>=2 chars) or a team/position filter to browse.
    if (q.length < 2 && !hasFilter) return res.json([]);

    const where: Prisma.PlayerWhereInput = { active: true };
    if (sport) where.sport = sport;
    if (q.length >= 2) where.fullName = { contains: q, mode: "insensitive" };
    if (teams.length) where.team = { in: teams };
    if (positions.length) where.position = { in: positions };

    // Projectable question + scoring context → rank results by projection
    // (most relevant first). We then pull a wider candidate set and trim to 20
    // after ranking; otherwise just take 20 alphabetically.
    const wantProj =
      sport === Sport.FOOTBALL &&
      questionType !== "" &&
      (isScoreablePoll(questionType as never) ||
        isSeasonProjectionPoll(questionType as never));

    const candidates = await prisma.player.findMany({
      where,
      orderBy: { fullName: "asc" },
      take: wantProj ? 100 : 20,
      select: {
        id: true,
        fullName: true,
        team: true,
        position: true,
        sport: true,
        injuryStatus: true,
      },
    });

    // Projected points for the candidate set (when applicable).
    let projById = new Map<string, number>();
    if (wantProj && candidates.length > 0) {
      const rules = await resolveScoringRules({
        leagueId: (req.query.leagueId as string) || null,
        scoringPreset: (req.query.scoringPreset as string) || null,
        scoringFormatId: (req.query.scoringFormatId as string) || null,
        ownerId: req.userId!,
      });
      const nfl = await getNflState();
      if (rules && nfl) {
        const weeks = projectionWeeks(
          questionType as never,
          nfl.week,
          evaluationWeeks,
        );
        projById = await projectedPointsByPlayer(
          candidates.map((p) => p.id),
          nfl.season,
          weeks,
          rules,
        );
      }
    }

    // Rank by projection desc (unprojected players sort last), then keep 20.
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
    const players = ranked.slice(0, 20);

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
