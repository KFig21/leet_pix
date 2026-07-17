import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env") });

// Usage: tsx scripts/importProjections.ts [season] [startWeek]
// Imports NFL projections for startWeek..18 and re-prices open poll projections
// (incl. keeper season projections). Mirrors the scheduler's daily job.
async function main() {
  const { importNflStats } = await import("../src/jobs/importStats");
  const { refreshOpenPollProjections } = await import(
    "../src/services/projections"
  );
  const { getNflState } = await import("../src/lib/nflState");
  const { prisma } = await import("../src/lib/prisma");

  const nfl = await getNflState();
  console.log("NFL state from Sleeper:", nfl);

  const season = Number(process.argv[2]) || nfl?.season;
  const startWeek = Number(process.argv[3]) || 1;
  if (!season) {
    console.error("No season. Pass one: tsx scripts/importProjections.ts <season> [startWeek]");
    process.exit(1);
  }

  try {
    console.log(`Importing projections for ${season}, weeks ${startWeek}–18…`);
    for (let wk = startWeek; wk <= 18; wk++) {
      const n = await importNflStats(season, wk, "projection");
      console.log(`  wk${wk}: ${n} lines`);
    }
    const updated = await refreshOpenPollProjections();
    console.log(`Re-priced ${updated} open-poll option projections.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
