import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { Sport } from "@leetpix/shared";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { upcomingGameByTeam } from "../lib/schedule";

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
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const sport = asSport(req.query.sport);
    const teams = asList(req.query.team);
    const positions = asList(req.query.position);
    const hasFilter = teams.length > 0 || positions.length > 0;

    // Need either a query (>=2 chars) or a team/position filter to browse.
    if (q.length < 2 && !hasFilter) return res.json([]);

    const where: Prisma.PlayerWhereInput = { active: true };
    if (sport) where.sport = sport;
    if (q.length >= 2) where.fullName = { contains: q, mode: "insensitive" };
    if (teams.length) where.team = { in: teams };
    if (positions.length) where.position = { in: positions };

    const players = await prisma.player.findMany({
      where,
      orderBy: { fullName: "asc" },
      take: 20,
      select: {
        id: true,
        fullName: true,
        team: true,
        position: true,
        sport: true,
        injuryStatus: true,
      },
    });

    // Attach each player's next game (opponent + kickoff) so the picker shows
    // who they play — for both sports. Best-effort (needs the schedule imported).
    const resultTeams = players
      .map((p) => p.team)
      .filter((t): t is string => !!t);
    const byTeam =
      sport && resultTeams.length
        ? await upcomingGameByTeam(sport, resultTeams)
        : null;

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
          game: opponent
            ? { opponent: opponent.abbr, atHome: opponent.atHome, kickoff: g!.kickoff }
            : null,
        };
      }),
    );
  }),
);
