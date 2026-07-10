import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env") });

// Usage:
//   import:games nfl <season> <week>
//   import:games mlb <season> <YYYY-MM-DD>
async function main() {
  const { importNflGames, importMlbGames } = await import("../src/jobs/importGames");
  const { prisma } = await import("../src/lib/prisma");
  const sport = (process.argv[2] ?? "").toLowerCase();
  try {
    if (sport === "nfl") {
      const season = Number(process.argv[3]);
      const week = Number(process.argv[4]);
      if (!season || !week) {
        console.error("Usage: import:games nfl <season> <week>");
        process.exit(1);
      }
      console.log(`Fetching ESPN NFL scoreboard ${season} week ${week}…`);
      console.log(`Done. Imported ${await importNflGames(season, week)} NFL games.`);
    } else if (sport === "mlb") {
      const season = Number(process.argv[3]);
      const date = process.argv[4];
      if (!season || !date) {
        console.error("Usage: import:games mlb <season> <YYYY-MM-DD>");
        process.exit(1);
      }
      console.log(`Fetching MLB schedule for ${date}…`);
      console.log(`Done. Imported ${await importMlbGames(season, date)} MLB games.`);
    } else {
      console.error("Usage: import:games <nfl|mlb> …");
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
