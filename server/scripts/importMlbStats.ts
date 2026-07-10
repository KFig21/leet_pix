import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env") });

// Usage: import:mlbstats <YYYY-MM-DD>
async function main() {
  const { importMlbStats } = await import("../src/jobs/importMlbStats");
  const { prisma } = await import("../src/lib/prisma");
  const date = process.argv[2];
  if (!date) {
    console.error("Usage: import:mlbstats <YYYY-MM-DD>");
    process.exit(1);
  }
  try {
    console.log(`Fetching MLB boxscores for ${date}…`);
    const n = await importMlbStats(date);
    console.log(`Done. Imported ${n} batting lines.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
