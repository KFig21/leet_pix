import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env") });

// Scheduled job: resolve all due polls. Run on a cron (e.g. hourly during the
// season):  npm run resolve:due
async function main() {
  const { resolveDuePolls } = await import("../src/services/resolution");
  const { prisma } = await import("../src/lib/prisma");
  try {
    const ids = await resolveDuePolls();
    console.log(`Resolved ${ids.length} due poll(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
