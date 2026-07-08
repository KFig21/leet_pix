import { prisma } from "./prisma";

// Tags each poll with the viewer's own vote (optionId or null) so the client
// can show a "you voted" state. One extra query for the whole list.
export async function withMyVote<T extends { id: string }>(
  polls: T[],
  userId?: string,
): Promise<(T & { myVoteOptionId: string | null })[]> {
  if (!userId || polls.length === 0) {
    return polls.map((p) => ({ ...p, myVoteOptionId: null }));
  }
  const votes = await prisma.vote.findMany({
    where: { voterId: userId, pollId: { in: polls.map((p) => p.id) } },
    select: { pollId: true, optionId: true },
  });
  const byPoll = new Map(votes.map((v) => [v.pollId, v.optionId]));
  return polls.map((p) => ({ ...p, myVoteOptionId: byPoll.get(p.id) ?? null }));
}
