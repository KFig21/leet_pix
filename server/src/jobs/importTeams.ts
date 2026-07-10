import { TEAMS } from "@leetpix/shared";
import { prisma } from "../lib/prisma";

// Upsert the canonical team registry from @leetpix/shared and (re)link existing
// players/games to their team by abbreviation. Idempotent. Returns team count.
export async function seedTeams(): Promise<number> {
  for (const t of TEAMS) {
    const team = await prisma.team.upsert({
      where: {
        sport_abbreviation: { sport: t.sport, abbreviation: t.abbreviation },
      },
      update: {
        league: t.league,
        location: t.location,
        name: t.name,
        primaryColor: t.primaryColor,
        espnAbbr: t.espnAbbr ?? null,
      },
      create: {
        sport: t.sport,
        league: t.league,
        abbreviation: t.abbreviation,
        location: t.location,
        name: t.name,
        primaryColor: t.primaryColor,
        espnAbbr: t.espnAbbr ?? null,
      },
    });
    // Backfill the denormalized-abbreviation rows to point at this team.
    await prisma.player.updateMany({
      where: { sport: t.sport, team: t.abbreviation },
      data: { teamId: team.id },
    });
    await prisma.game.updateMany({
      where: { sport: t.sport, homeTeam: t.abbreviation },
      data: { homeTeamId: team.id },
    });
    await prisma.game.updateMany({
      where: { sport: t.sport, awayTeam: t.abbreviation },
      data: { awayTeamId: team.id },
    });
  }
  return TEAMS.length;
}

// team abbreviation -> id, for importers to set the FK as they upsert rows.
export async function teamIdByAbbr(
  sport: "FOOTBALL" | "BASEBALL",
): Promise<Map<string, string>> {
  const teams = await prisma.team.findMany({
    where: { sport },
    select: { id: true, abbreviation: true },
  });
  return new Map(teams.map((t) => [t.abbreviation, t.id]));
}
