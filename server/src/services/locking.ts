import { prisma } from "../lib/prisma";

/**
 * Flip every OPEN poll whose lock time has passed to LOCKED. Applies to both
 * scoreable polls (locked at game start) and opinion polls (closed at their
 * deadline). Scoreable polls are later moved to RESOLVED by the resolver once
 * their stats are in; opinion polls stay LOCKED (consensus only). Returns the
 * number of polls locked. Idempotent — safe to run on a frequent schedule.
 */
export async function lockDuePolls(): Promise<number> {
  const { count } = await prisma.poll.updateMany({
    where: { status: "OPEN", lockAt: { not: null, lt: new Date() } },
    data: { status: "LOCKED" },
  });
  return count;
}
