import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env") });

// Usage: import:players [nfl|mlb|all]
async function main() {
  const { importNflPlayers, importMlbPlayers } = await import(
    "../src/jobs/importPlayers"
  );
  const { prisma } = await import("../src/lib/prisma");
  const target = process.argv[2] ?? "all"; // nfl | mlb | all
  try {
    if (target === "nfl" || target === "all") {
      console.log("Fetching Sleeper NFL players…");
      console.log(`Done. Imported/updated ${await importNflPlayers()} NFL players.`);
    }
    if (target === "mlb" || target === "all") {
      console.log("Fetching MLB players…");
      console.log(`Done. Imported/updated ${await importMlbPlayers()} MLB players.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
