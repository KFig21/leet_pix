import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env") });

// Seed the canonical Team registry and link existing players/games to it.
async function main() {
  const { seedTeams } = await import("../src/jobs/importTeams");
  const { prisma } = await import("../src/lib/prisma");
  try {
    const n = await seedTeams();
    console.log(`Seeded ${n} teams and linked players/games.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
