import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env") });

// Scheduled job: lock all polls past their lock time. Run frequently (e.g. every
// minute):  npm run lock:due
async function main() {
  const { lockDuePolls } = await import("../src/services/locking");
  const { prisma } = await import("../src/lib/prisma");
  try {
    const n = await lockDuePolls();
    console.log(`Locked ${n} due poll(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
