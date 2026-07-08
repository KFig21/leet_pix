import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env") });

const prisma = new PrismaClient();

// Fantasy-relevant positions (skip practice-squad noise, etc.).
const POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

interface SleeperPlayer {
  player_id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  team?: string | null;
  position?: string | null;
  active?: boolean;
  espn_id?: number | string | null;
  yahoo_id?: number | string | null;
}

const asStr = (v: unknown) => (v == null ? null : String(v));

// Sleeper's players endpoint is one big JSON blob of every NFL player, keyed by
// their id, and includes cross-reference ids (espn_id, yahoo_id). It's free and
// unauthenticated; they ask that you cache it (call at most ~once/day).
async function importNfl() {
  console.log("Fetching Sleeper NFL players…");
  const res = await fetch("https://api.sleeper.app/v1/players/nfl");
  if (!res.ok) throw new Error(`Sleeper responded ${res.status}`);
  const data = (await res.json()) as Record<string, SleeperPlayer>;

  const players = Object.values(data).filter(
    (p) =>
      p.active &&
      p.position &&
      POSITIONS.has(p.position) &&
      (p.full_name || (p.first_name && p.last_name)),
  );
  console.log(`Upserting ${players.length} active NFL players…`);

  let n = 0;
  for (const p of players) {
    const fullName =
      p.full_name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
    const fields = {
      fullName,
      firstName: p.first_name ?? null,
      lastName: p.last_name ?? null,
      team: p.team ?? null,
      position: p.position ?? null,
      active: p.active ?? true,
      espnId: asStr(p.espn_id),
      yahooId: asStr(p.yahoo_id),
    };
    await prisma.player.upsert({
      where: { sleeperId: p.player_id },
      update: fields,
      create: { sport: "FOOTBALL", sleeperId: p.player_id, ...fields },
    });
    if (++n % 250 === 0) console.log(`  …${n}`);
  }
  console.log(`Done. Imported/updated ${n} NFL players.`);
}

interface MlbPlayer {
  id: number;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  active?: boolean;
  currentTeam?: { name?: string; abbreviation?: string };
  primaryPosition?: { abbreviation?: string };
}

// MLB's Stats API is free and unauthenticated. sports/1 = MLB (majors).
async function importMlb() {
  let season = new Date().getFullYear();
  let people: MlbPlayer[] = [];
  // The new season's roster may be empty early; fall back a year if so.
  for (let attempt = 0; attempt < 2 && people.length === 0; attempt++) {
    console.log(`Fetching MLB players (season ${season})…`);
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/sports/1/players?season=${season}`,
    );
    if (!res.ok) throw new Error(`MLB responded ${res.status}`);
    people = ((await res.json()) as { people?: MlbPlayer[] }).people ?? [];
    if (people.length === 0) season -= 1;
  }
  console.log(`Upserting ${people.length} MLB players…`);

  let n = 0;
  for (const p of people) {
    const fields = {
      fullName: p.fullName ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(),
      firstName: p.firstName ?? null,
      lastName: p.lastName ?? null,
      team: p.currentTeam?.abbreviation ?? p.currentTeam?.name ?? null,
      position: p.primaryPosition?.abbreviation ?? null,
      active: p.active ?? true,
    };
    await prisma.player.upsert({
      where: { mlbamId: String(p.id) },
      update: fields,
      create: { sport: "BASEBALL", mlbamId: String(p.id), ...fields },
    });
    if (++n % 250 === 0) console.log(`  …${n}`);
  }
  console.log(`Done. Imported/updated ${n} MLB players.`);
}

const target = process.argv[2] ?? "all"; // nfl | mlb | all
async function run() {
  if (target === "nfl" || target === "all") await importNfl();
  if (target === "mlb" || target === "all") await importMlb();
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
