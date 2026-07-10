import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env") });

const prisma = new PrismaClient();

// Creates one START poll (by a demo account) with real NFL players that have
// 2025 week-1 ACTUAL stats — so you can vote on it and grade it with:
//   npm run resolve:poll <printed id> 2025 1
async function main() {
  const author = await prisma.profile.findUnique({
    where: { username: "gridiron_gary" },
  });
  if (!author) throw new Error("Run `npm run db:seed` first (no demo accounts).");

  // Prefer recognizable skill players that scored in week 1.
  const players = await prisma.player.findMany({
    where: {
      sport: "FOOTBALL",
      position: { in: ["QB", "RB", "WR"] },
      stats: { some: { season: 2025, week: 1, kind: "ACTUAL" } },
    },
    take: 3,
    orderBy: { fullName: "asc" },
  });
  if (players.length < 2) throw new Error("Import stats first: npm run import:stats 2025 1");

  const poll = await prisma.poll.create({
    data: {
      authorId: author.id,
      sport: "FOOTBALL",
      questionType: "START",
      lockType: "GAME_START",
      scoringPreset: "FOOTBALL_PPR",
      season: 2025,
      week: 1,
      options: {
        create: players.map((p) => ({ playerId: p.id, playerName: p.fullName })),
      },
    },
  });

  console.log("\nResolvable demo poll created:");
  console.log(`  Poll id: ${poll.id}`);
  console.log(`  Players: ${players.map((p) => p.fullName).join(", ")}`);
  console.log(`  URL:     /polls/${poll.id}`);
  console.log(`\nVote on it, then run:  npm run resolve:poll ${poll.id} 2025 1\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
