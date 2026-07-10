import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";

// Unique per process run, so we only ever release a lease we still hold.
const INSTANCE_ID = randomUUID();

// Atomically acquire a job's lease: insert it, or take it over only if the
// existing lease has expired. Returns true iff this instance now holds it.
// The WHERE on the upsert makes the take-over race-safe across instances.
export async function tryAcquireJobLock(
  name: string,
  leaseMs: number,
): Promise<boolean> {
  const until = new Date(Date.now() + leaseMs);
  const rows = await prisma.$queryRaw<{ name: string }[]>`
    INSERT INTO job_locks ("name", "lockedUntil", "instanceId", "updatedAt")
    VALUES (${name}, ${until}, ${INSTANCE_ID}, now())
    ON CONFLICT ("name") DO UPDATE
      SET "lockedUntil" = EXCLUDED."lockedUntil",
          "instanceId"  = EXCLUDED."instanceId",
          "updatedAt"   = now()
      WHERE job_locks."lockedUntil" < now()
    RETURNING "name";
  `;
  return rows.length > 0;
}

// Release early (job finished before its lease expired) — only if still ours.
export async function releaseJobLock(name: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE job_locks SET "lockedUntil" = now()
    WHERE "name" = ${name} AND "instanceId" = ${INSTANCE_ID};
  `;
}
