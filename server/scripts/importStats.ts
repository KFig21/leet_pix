import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env") });

// Usage: import:stats <season> <week> [actual|projection]
async function main() {
  const { importNflStats } = await import("../src/jobs/importStats");
  const { prisma } = await import("../src/lib/prisma");
  const season = Number(process.argv[2]);
  const week = Number(process.argv[3]);
  const kind = (process.argv[4] ?? "actual").toLowerCase() === "projection"
    ? "projection"
    : "actual";
  if (!season || !week) {
    console.error("Usage: import:stats <season> <week> [actual|projection]");
    process.exit(1);
  }
  try {
    console.log(`Fetching Sleeper ${kind} for ${season} week ${week}…`);
    const n = await importNflStats(season, week, kind);
    console.log(`Done. Imported ${n} ${kind} stat lines.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
