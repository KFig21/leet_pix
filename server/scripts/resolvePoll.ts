import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env") });

// Usage: tsx scripts/resolvePoll.ts <pollId> <season> <startWeek>
// Grades one poll against imported ACTUAL stats for the given week(s).
async function main() {
  const [pollId, season, week] = process.argv.slice(2);
  if (!pollId || !season || !week) {
    console.error("Usage: resolve:poll <pollId> <season> <startWeek>");
    process.exit(1);
  }
  // Imported after dotenv so PrismaClient sees DATABASE_URL.
  const { resolvePoll } = await import("../src/services/resolution");
  const { prisma } = await import("../src/lib/prisma");
  try {
    const out = await resolvePoll(pollId, Number(season), Number(week));
    console.log("Resolved:", JSON.stringify(out, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
