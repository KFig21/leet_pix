import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { SCORING_PRESET_RULES } from "@leetpix/shared";
import {
  gameStartLockAt,
  baseballStartInfo,
  pollGameIds,
} from "../src/lib/schedule";
import { projectedPointsByPlayer } from "../src/services/projections";
import { resolvePoll } from "../src/services/resolution";

const prisma = new PrismaClient();

// The season/week new football polls are tagged with (matches getNflState in the
// offseason) and the completed week we grade the resolved demo poll against.
const OPEN_SEASON = 2026;
const OPEN_WEEK = 1;
const RESOLVED_SEASON = 2025;
const RESOLVED_WEEK = 1;

// Demo accounts (not real auth users — they exist purely as discoverable content
// so Explore / the timeline aren't empty during development).
const DEMO_USERS = [
  { username: "gridiron_gary", displayName: "Gridiron Gary", bio: "RB truther. Zero RB skeptic.", avatar: { bgColor: "#2fa84f", shape: "circle", icon: "football", iconColor: "#ffffff" } },
  { username: "dinger_dana", displayName: "Dinger Dana", bio: "Baseball nerd, spreadsheet enjoyer.", avatar: { bgColor: "#1d9bf0", shape: "rounded", icon: "baseball", iconColor: "#ffffff" } },
  { username: "waiver_wanda", displayName: "Waiver Wanda", bio: "FAAB assassin.", avatar: { bgColor: "#e0245e", shape: "circle", emoji: "🔥" } },
  { username: "trade_tony", displayName: "Trade Tony", bio: "I'll send you an offer at 2am.", avatar: { bgColor: "#8e44ad", shape: "square", icon: "trophy", iconColor: "#ffffff" } },
  { username: "start_sit_sam", displayName: "Start/Sit Sam", bio: "Lineup optimizer.", avatar: { bgColor: "#16a085", shape: "circle", emoji: "🧢" } },
  { username: "keeper_kim", displayName: "Keeper Kim", bio: "Dynasty for life.", avatar: { bgColor: "#f5a623", shape: "rounded", icon: "helmet", iconColor: "#111111" } },
] as const;

type Sport = "FOOTBALL" | "BASEBALL";
interface PlayerPick {
  id: string;
  fullName: string;
}

// Find real players for a demo poll: honor the preferred names (in order) that
// exist, then top up with any other active players of that position/sport.
async function pickPlayers(
  sport: Sport,
  count: number,
  preferred: string[],
  position?: string,
): Promise<PlayerPick[]> {
  const base = { sport, active: true, ...(position ? { position } : {}) };
  const named = await prisma.player.findMany({
    where: { ...base, fullName: { in: preferred } },
    select: { id: true, fullName: true },
  });
  const picks: PlayerPick[] = [];
  for (const name of preferred) {
    const p = named.find((x) => x.fullName === name);
    if (p && !picks.some((f) => f.id === p.id)) picks.push(p);
  }
  if (picks.length < count) {
    const more = await prisma.player.findMany({
      where: { ...base, team: { not: null }, id: { notIn: picks.map((p) => p.id) } },
      orderBy: { fullName: "asc" },
      take: count * 4,
      select: { id: true, fullName: true },
    });
    for (const p of more) {
      if (picks.length >= count) break;
      picks.push(p);
    }
  }
  return picks.slice(0, count);
}

// Open football poll specs (tagged the upcoming week → real lock times).
const OPEN_FOOTBALL: {
  author: string;
  questionType: "START" | "BENCH";
  position: string;
  preferred: string[];
  count: number;
}[] = [
  { author: "gridiron_gary", questionType: "START", position: "QB", preferred: ["Josh Allen", "Joe Burrow", "Jalen Hurts"], count: 3 },
  { author: "start_sit_sam", questionType: "START", position: "RB", preferred: ["Bijan Robinson", "Saquon Barkley", "Jahmyr Gibbs"], count: 3 },
  { author: "waiver_wanda", questionType: "BENCH", position: "WR", preferred: ["Ja'Marr Chase", "CeeDee Lamb", "Amon-Ra St. Brown"], count: 3 },
  { author: "keeper_kim", questionType: "START", position: "TE", preferred: ["Brock Bowers", "Trey McBride", "George Kittle"], count: 2 },
];

// Open baseball "who should I start" polls (votable now; baseball grading/lock
// isn't wired yet, so these stay open with no lock time).
const OPEN_BASEBALL: { author: string; preferred: string[]; count: number }[] = [
  { author: "dinger_dana", preferred: ["Aaron Judge", "Shohei Ohtani", "Juan Soto"], count: 3 },
  { author: "waiver_wanda", preferred: ["Bobby Witt Jr.", "Gunnar Henderson", "Elly De La Cruz"], count: 3 },
  { author: "keeper_kim", preferred: ["Mookie Betts", "Freddie Freeman"], count: 2 },
];

async function main() {
  console.log("Seeding demo data (real players)…");

  // Fresh slate: clear polls (cascades options/votes/results) + notifications +
  // demo follows. Keep accounts, scoring formats, players, games, and stats.
  await prisma.notification.deleteMany({});
  await prisma.poll.deleteMany({});

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
  const author = (username: string) => idByUsername.get(username)!;

  const rules = SCORING_PRESET_RULES.FOOTBALL_PPR;
  const createdPolls: { id: string; authorId: string; options: { id: string }[] }[] = [];

  // ── Open football polls: real players, real lock times from the schedule ──
  for (const spec of OPEN_FOOTBALL) {
    const players = await pickPlayers("FOOTBALL", spec.count, spec.preferred, spec.position);
    if (players.length < 2) {
      console.warn(`Skipping ${spec.author} ${spec.position} poll — not enough players.`);
      continue;
    }
    const ids = players.map((p) => p.id);
    const lockAt = await gameStartLockAt("FOOTBALL", OPEN_SEASON, OPEN_WEEK, ids);
    const projected = await projectedPointsByPlayer(ids, OPEN_SEASON, [OPEN_WEEK], rules);
    const gameIds = await pollGameIds("FOOTBALL", OPEN_SEASON, OPEN_WEEK, ids);

    const poll = await prisma.poll.create({
      data: {
        authorId: author(spec.author),
        sport: "FOOTBALL",
        questionType: spec.questionType,
        lockType: "GAME_START",
        lockAt,
        season: OPEN_SEASON,
        week: OPEN_WEEK,
        scoringPreset: "FOOTBALL_PPR",
        options: {
          create: players.map((p) => ({
            playerId: p.id,
            playerName: p.fullName,
            projectedPoints: projected.get(p.id) ?? null,
          })),
        },
        games: { create: gameIds.map((gameId) => ({ gameId })) },
      },
      include: { options: true },
    });
    createdPolls.push(poll);
  }

  // ── Open baseball "who should I start" polls (real hitters) ──
  for (const spec of OPEN_BASEBALL) {
    const players = await pickPlayers("BASEBALL", spec.count, spec.preferred);
    if (players.length < 2) {
      console.warn(`Skipping ${spec.author} baseball poll — not enough players.`);
      continue;
    }
    const info = await baseballStartInfo(players.map((p) => p.id));
    const gameIds = info
      ? await pollGameIds("BASEBALL", info.season, info.week, players.map((p) => p.id))
      : [];
    const poll = await prisma.poll.create({
      data: {
        authorId: author(spec.author),
        sport: "BASEBALL",
        questionType: "START",
        lockType: "GAME_START",
        lockAt: info?.lockAt ?? null,
        season: info?.season ?? null,
        week: info?.week ?? null,
        scoringPreset: "BASEBALL_STANDARD",
        options: { create: players.map((p) => ({ playerId: p.id, playerName: p.fullName })) },
        games: { create: gameIds.map((gameId) => ({ gameId })) },
      },
      include: { options: true },
    });
    createdPolls.push(poll);
  }

  // ── Baseball opinion poll (no schedule/stats pipeline yet) ──
  const ballplayers = await pickPlayers("BASEBALL", 3, ["Aaron Judge", "Shohei Ohtani", "Bobby Witt Jr."]);
  if (ballplayers.length >= 2) {
    const poll = await prisma.poll.create({
      data: {
        authorId: author("dinger_dana"),
        sport: "BASEBALL",
        questionType: "TRADE_FOR",
        lockType: "FIXED_TIME",
        lockAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // closes in 2 days
        scoringPreset: "BASEBALL_STANDARD",
        options: { create: ballplayers.map((p) => ({ playerId: p.id, playerName: p.fullName })) },
      },
      include: { options: true },
    });
    createdPolls.push(poll);
  }

  // Spread votes: every demo user votes on each poll they didn't author, so all
  // polls (football + baseball) show vote signal for you to vote against.
  for (const voterId of demoIds) {
    const votable = createdPolls.filter((p) => p.authorId !== voterId);
    for (const poll of votable) {
      const option = poll.options[Math.floor(Math.random() * poll.options.length)];
      await prisma.vote.create({
        data: { pollId: poll.id, optionId: option.id, voterId, consensusAtVote: 0 },
      });
    }
  }

  // ── Resolved football poll: real 2025 wk1 players, graded against actuals ──
  const resolvedPlayers = await pickPlayers("FOOTBALL", 3, ["Saquon Barkley", "Derrick Henry", "Jahmyr Gibbs"], "RB");
  if (resolvedPlayers.length >= 2) {
    const rIds = resolvedPlayers.map((p) => p.id);
    const past = await gameStartLockAt("FOOTBALL", RESOLVED_SEASON, RESOLVED_WEEK, rIds);
    const gameIds = await pollGameIds("FOOTBALL", RESOLVED_SEASON, RESOLVED_WEEK, rIds);
    const poll = await prisma.poll.create({
      data: {
        authorId: author("trade_tony"),
        sport: "FOOTBALL",
        questionType: "START",
        lockType: "GAME_START",
        lockAt: past,
        season: RESOLVED_SEASON,
        week: RESOLVED_WEEK,
        scoringPreset: "FOOTBALL_PPR",
        options: { create: resolvedPlayers.map((p) => ({ playerId: p.id, playerName: p.fullName })) },
        games: { create: gameIds.map((gameId) => ({ gameId })) },
      },
      include: { options: true },
    });
    // Demo users vote, then grade against the imported 2025 wk1 actuals.
    for (const voterId of demoIds.filter((id) => id !== poll.authorId).slice(0, 4)) {
      const option = poll.options[Math.floor(Math.random() * poll.options.length)];
      await prisma.vote.create({
        data: { pollId: poll.id, optionId: option.id, voterId, consensusAtVote: 0 },
      });
    }
    try {
      await resolvePoll(poll.id, RESOLVED_SEASON, RESOLVED_WEEK);
      createdPolls.push(poll);
    } catch (e) {
      console.warn("Could not resolve demo poll (missing 2025 wk1 stats?):", e);
    }
  }

  // Follows: make the first two accounts "popular" so who-to-follow has signal.
  const popular = demoIds.slice(0, 2);
  const follows = demoIds.flatMap((followerId) =>
    popular
      .filter((followingId) => followingId !== followerId)
      .map((followingId) => ({ followerId, followingId })),
  );
  await prisma.follow.createMany({ data: follows, skipDuplicates: true });

  // Give real (non-demo) users inbound activity so notifications/followers
  // populate: demo accounts follow them (and vote on any polls they have).
  const realProfiles = await prisma.profile.findMany({
    where: { username: { notIn: DEMO_USERS.map((u) => u.username) } },
  });
  for (const real of realProfiles) {
    await prisma.follow.deleteMany({
      where: { followerId: { in: demoIds }, followingId: real.id },
    });
    for (const actorId of demoIds.slice(0, 4)) {
      await prisma.follow.create({ data: { followerId: actorId, followingId: real.id } });
      await prisma.notification.create({
        data: { recipientId: real.id, actorId, type: "FOLLOW" },
      });
    }
  }

  console.log(
    `Seeded ${DEMO_USERS.length} demo users, ${createdPolls.length} polls ` +
      `(real players), inbound activity for ${realProfiles.length} real user(s).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
