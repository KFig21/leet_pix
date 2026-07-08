import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Demo accounts (not real auth users — they exist purely as discoverable
// content so Explore / the timeline aren't empty during development).
const DEMO_USERS = [
  { username: "gridiron_gary", displayName: "Gridiron Gary", bio: "RB truther. Zero RB skeptic.", avatar: { bgColor: "#2fa84f", shape: "circle", icon: "football", iconColor: "#ffffff" } },
  { username: "dinger_dana", displayName: "Dinger Dana", bio: "Baseball nerd, spreadsheet enjoyer.", avatar: { bgColor: "#1d9bf0", shape: "rounded", icon: "baseball", iconColor: "#ffffff" } },
  { username: "waiver_wanda", displayName: "Waiver Wanda", bio: "FAAB assassin.", avatar: { bgColor: "#e0245e", shape: "circle", emoji: "🔥" } },
  { username: "trade_tony", displayName: "Trade Tony", bio: "I'll send you an offer at 2am.", avatar: { bgColor: "#8e44ad", shape: "square", icon: "trophy", iconColor: "#ffffff" } },
  { username: "start_sit_sam", displayName: "Start/Sit Sam", bio: "Lineup optimizer.", avatar: { bgColor: "#16a085", shape: "circle", emoji: "🧢" } },
  { username: "keeper_kim", displayName: "Keeper Kim", bio: "Dynasty for life.", avatar: { bgColor: "#f5a623", shape: "rounded", icon: "helmet", iconColor: "#111111" } },
] as const;

// author username -> polls
const DEMO_POLLS: {
  author: string;
  sport: "FOOTBALL" | "BASEBALL";
  questionType: "START" | "ADD" | "DROP" | "TRADE_FOR" | "TRADE_AWAY" | "BUY_LOW";
  players: string[];
}[] = [
  { author: "gridiron_gary", sport: "FOOTBALL", questionType: "START", players: ["Christian McCaffrey", "Bijan Robinson"] },
  { author: "gridiron_gary", sport: "FOOTBALL", questionType: "TRADE_FOR", players: ["Ja'Marr Chase", "Justin Jefferson", "CeeDee Lamb"] },
  { author: "dinger_dana", sport: "BASEBALL", questionType: "START", players: ["Aaron Judge", "Shohei Ohtani"] },
  { author: "dinger_dana", sport: "BASEBALL", questionType: "ADD", players: ["Bobby Witt Jr.", "Gunnar Henderson"] },
  { author: "waiver_wanda", sport: "FOOTBALL", questionType: "ADD", players: ["Jaylen Warren", "Tyjae Spears", "Rico Dowdle"] },
  { author: "trade_tony", sport: "FOOTBALL", questionType: "TRADE_AWAY", players: ["Davante Adams", "Mike Evans"] },
  { author: "start_sit_sam", sport: "FOOTBALL", questionType: "START", players: ["Jalen Hurts", "Lamar Jackson"] },
  { author: "keeper_kim", sport: "FOOTBALL", questionType: "BUY_LOW", players: ["Breece Hall", "Jonathan Taylor"] },
];

async function main() {
  console.log("Seeding demo data…");

  // Upsert demo profiles (idempotent by username).
  const idByUsername = new Map<string, string>();
  for (const u of DEMO_USERS) {
    const profile = await prisma.profile.upsert({
      where: { username: u.username },
      update: { displayName: u.displayName, bio: u.bio, avatar: u.avatar },
      create: { id: randomUUID(), username: u.username, displayName: u.displayName, bio: u.bio, avatar: u.avatar },
    });
    idByUsername.set(u.username, profile.id);
  }
  const demoIds = [...idByUsername.values()];

  // Only build demo polls the FIRST time. On reruns we reuse the existing ones
  // so we never cascade-delete real users' votes (picks) on demo polls.
  let createdPolls = await prisma.poll.findMany({
    where: { authorId: { in: demoIds } },
    include: { options: true },
  });

  if (createdPolls.length === 0) {
    for (const p of DEMO_POLLS) {
      const poll = await prisma.poll.create({
        data: {
          authorId: idByUsername.get(p.author)!,
          sport: p.sport,
          questionType: p.questionType,
          lockType: "GAME_START",
          scoringPreset: p.sport === "BASEBALL" ? "BASEBALL_STANDARD" : "FOOTBALL_PPR",
          options: { create: p.players.map((playerName, i) => ({ playerId: `demo-${i}`, playerName })) },
        },
        include: { options: true },
      });
      createdPolls.push(poll);
    }

    // Spread votes: each demo user votes on a few polls they didn't author.
    for (const voterId of demoIds) {
      const votable = createdPolls.filter((poll) => poll.authorId !== voterId);
      for (const poll of votable.slice(0, 4)) {
        const option = poll.options[Math.floor(Math.random() * poll.options.length)];
        await prisma.vote.create({
          data: { pollId: poll.id, optionId: option.id, voterId, consensusAtVote: 0 },
        });
      }
    }

    // Follows: make the first two accounts "popular" so who-to-follow has signal.
    const popular = demoIds.slice(0, 2);
    for (const followerId of demoIds) {
      for (const followingId of popular) {
        if (followerId === followingId) continue;
        await prisma.follow.create({ data: { followerId, followingId } });
      }
    }
  } else {
    console.log(`Reusing ${createdPolls.length} existing demo polls (votes preserved).`);
  }

  // Give real (non-demo) users inbound activity so notifications/followers
  // populate: demo accounts follow them and vote on their polls.
  const realProfiles = await prisma.profile.findMany({
    where: { username: { notIn: DEMO_USERS.map((u) => u.username) } },
  });
  for (const real of realProfiles) {
    // Reset demo-generated inbound data for idempotency.
    await prisma.notification.deleteMany({
      where: { recipientId: real.id, actorId: { in: demoIds } },
    });
    await prisma.follow.deleteMany({
      where: { followerId: { in: demoIds }, followingId: real.id },
    });
    await prisma.vote.deleteMany({
      where: { voterId: { in: demoIds }, poll: { authorId: real.id } },
    });

    // 4 demo accounts follow the real user (→ follow notifications).
    for (const actorId of demoIds.slice(0, 4)) {
      await prisma.follow.create({
        data: { followerId: actorId, followingId: real.id },
      });
      await prisma.notification.create({
        data: { recipientId: real.id, actorId, type: "FOLLOW" },
      });
    }

    // Demo accounts vote on the real user's polls (→ grouped vote notifications).
    const realPolls = await prisma.poll.findMany({
      where: { authorId: real.id },
      include: { options: true },
    });
    for (const poll of realPolls) {
      for (const actorId of demoIds) {
        const opt = poll.options[Math.floor(Math.random() * poll.options.length)];
        if (!opt) continue;
        await prisma.vote.create({
          data: { pollId: poll.id, optionId: opt.id, voterId: actorId, consensusAtVote: 0 },
        });
        await prisma.notification.create({
          data: { recipientId: real.id, actorId, type: "VOTE", pollId: poll.id },
        });
      }
    }
  }

  console.log(
    `Seeded ${DEMO_USERS.length} demo users, ${createdPolls.length} polls, ` +
      `inbound activity for ${realProfiles.length} real user(s).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
