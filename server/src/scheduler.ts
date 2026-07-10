import cron from "node-cron";
import { prisma } from "./lib/prisma";
import { tryAcquireJobLock, releaseJobLock } from "./lib/jobLock";
import { getNflState } from "./lib/nflState";
import { lockDuePolls } from "./services/locking";
import { resolveDuePolls } from "./services/resolution";
import { seedTeams } from "./jobs/importTeams";
import { importNflPlayers, importMlbPlayers } from "./jobs/importPlayers";
import { importNflGames, importMlbGames } from "./jobs/importGames";
import { importNflStats } from "./jobs/importStats";
import { importMlbStats } from "./jobs/importMlbStats";
import { refreshOpenPollProjections } from "./services/projections";

const ymd = (d: Date): string => d.toISOString().slice(0, 10);

// Run a job, logging its result/duration and swallowing errors so one failure
// never takes down the process or blocks later jobs.
async function runJob(name: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    const result = await fn();
    const detail = Array.isArray(result)
      ? `${result.length}`
      : typeof result === "number"
        ? `${result}`
        : "ok";
    console.log(`[scheduler] ${name}: ${detail}`);
  } catch (e) {
    console.error(
      `[scheduler] ${name} failed:`,
      e instanceof Error ? e.message : e,
    );
  }
}

// Run a scheduled job behind a cross-instance lease, so that when multiple
// server instances are deployed only one runs a given tick. The lease is a
// crash-safety upper bound; the normal path releases it as soon as the job ends.
async function guardedJob(
  name: string,
  leaseMs: number,
  fn: () => Promise<unknown>,
): Promise<void> {
  let acquired = false;
  try {
    acquired = await tryAcquireJobLock(name, leaseMs);
  } catch (e) {
    console.error(
      `[scheduler] ${name} lock error:`,
      e instanceof Error ? e.message : e,
    );
    return;
  }
  if (!acquired) {
    console.log(`[scheduler] ${name} skipped (held by another instance)`);
    return;
  }
  try {
    await runJob(name, fn);
  } finally {
    await releaseJobLock(name).catch(() => {});
  }
}

// Daily NFL refresh: rosters (trades + injuries), the current & next week's
// schedule (lock times), and this week's actuals + projections.
async function dailyNflImports(): Promise<void> {
  const nfl = await getNflState();
  if (!nfl) {
    console.log("[scheduler] no NFL state; skipping football imports");
    return;
  }
  await runJob("seed teams", seedTeams);
  await runJob("roster sync", importNflPlayers);
  await runJob(`games wk${nfl.week}`, () => importNflGames(nfl.season, nfl.week));
  await runJob(`games wk${nfl.week + 1}`, () =>
    importNflGames(nfl.season, nfl.week + 1),
  );
  await runJob(`stats wk${nfl.week}`, () =>
    importNflStats(nfl.season, nfl.week, "actual"),
  );
  await runJob(`projections wk${nfl.week}`, () =>
    importNflStats(nfl.season, nfl.week, "projection"),
  );
  // Re-price open polls' projected points from the fresh projections.
  await runJob("refresh projections", refreshOpenPollProjections);
}

// Daily MLB refresh: rosters (trades/injuries), today's & tomorrow's schedule
// (lock times), and yesterday's box scores (to resolve prior-day polls).
async function dailyMlbImports(): Promise<void> {
  const now = new Date();
  const season = now.getUTCFullYear();
  const today = ymd(now);
  const tomorrow = ymd(new Date(now.getTime() + 86_400_000));
  const yesterday = ymd(new Date(now.getTime() - 86_400_000));
  await runJob("mlb roster", importMlbPlayers);
  await runJob(`mlb games ${today}`, () => importMlbGames(season, today));
  await runJob(`mlb games ${tomorrow}`, () => importMlbGames(season, tomorrow));
  await runJob(`mlb stats ${yesterday}`, () => importMlbStats(yesterday));
}

// ET calendar date (YYYY-MM-DD) for a moment — MLB schedules are keyed by ET.
function etDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(d);
}

// A scoring period that has newly-final games needing their box scores pulled.
interface PendingPeriod {
  sport: "FOOTBALL" | "BASEBALL";
  season: number;
  week: number | null; // football week
  date: string | null; // baseball ET date (YYYY-MM-DD)
  gameIds: string[];
}

// Unified game-status sync (both sports). Runs every 15 min in the game window:
//   1. Refresh statuses by re-importing the active slate (games flip to FINAL).
//   2. For any FINAL game we haven't pulled stats for yet, import that period's
//      box scores exactly once (marked via statsImportedAt; retries on failure).
//   3. Resolve any polls whose games are now all final.
// This replaces the MLB-only sweep and makes both sports grade minutes after the
// last game ends, rather than waiting for the next-morning daily import.
async function syncGames(): Promise<string> {
  const now = new Date();
  const etHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/New_York",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );

  // 1. Refresh statuses from the providers.
  const nfl = await getNflState();
  if (nfl) {
    await runJob(`sync nfl wk${nfl.week}`, () =>
      importNflGames(nfl.season, nfl.week),
    );
  }
  const mlbSeason = now.getUTCFullYear();
  const mlbDates = [etDate(now)];
  // After midnight ET, a late game still belongs to yesterday's ET slate.
  if (etHour <= 1) mlbDates.push(etDate(new Date(now.getTime() - 86_400_000)));
  for (const d of mlbDates) {
    await runJob(`sync mlb ${d}`, () => importMlbGames(mlbSeason, d));
  }

  // 2. Import stats for FINAL games we haven't processed yet, one call per
  //    period, then mark those games done.
  const pending = await prisma.game.findMany({
    where: { status: "FINAL", statsImportedAt: null },
    select: { id: true, sport: true, season: true, week: true, kickoff: true },
  });
  const periods = new Map<string, PendingPeriod>();
  for (const g of pending) {
    let key: string;
    let period: PendingPeriod;
    if (g.sport === "FOOTBALL") {
      if (g.week == null) continue;
      key = `FB:${g.season}:${g.week}`;
      period = periods.get(key) ?? {
        sport: "FOOTBALL",
        season: g.season,
        week: g.week,
        date: null,
        gameIds: [],
      };
    } else {
      const date = etDate(g.kickoff);
      key = `BB:${date}`;
      period = periods.get(key) ?? {
        sport: "BASEBALL",
        season: g.season,
        week: null,
        date,
        gameIds: [],
      };
    }
    period.gameIds.push(g.id);
    periods.set(key, period);
  }

  let importedPeriods = 0;
  for (const p of periods.values()) {
    try {
      if (p.sport === "FOOTBALL") {
        await importNflStats(p.season, p.week!, "actual");
      } else {
        await importMlbStats(p.date!, { finalOnly: true });
      }
      await prisma.game.updateMany({
        where: { id: { in: p.gameIds } },
        data: { statsImportedAt: new Date() },
      });
      importedPeriods++;
    } catch (e) {
      // Leave statsImportedAt null so the next run retries this period.
      console.error(
        `[scheduler] sync stats ${p.sport} failed:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  // 3. Grade any polls whose games are now all final.
  const resolved = await resolveDuePolls();
  return `${pending.length} final pending · ${importedPeriods} periods · ${resolved.length} resolved`;
}

// Registers all recurring jobs. In-process for now (single node worker); the job
// bodies are plain functions, so this can move to platform cron later unchanged.
export function startScheduler(): void {
  if (process.env.SCHEDULER_ENABLED === "false") {
    console.log("[scheduler] disabled (SCHEDULER_ENABLED=false)");
    return;
  }

  // Lock polls whose time has passed — frequent, cheap DB update.
  cron.schedule("* * * * *", () => guardedJob("lock due", 2 * 60_000, lockDuePolls));
  // Resolve scoreable polls once their stats are in (cheap backstop for polls
  // that become gradable outside the sync window, e.g. via the daily import).
  cron.schedule("*/15 * * * *", () =>
    guardedJob("resolve due", 10 * 60_000, resolveDuePolls),
  );
  // Unified game-status sync (both sports): every 15 min, 1pm–1am ET. Flips
  // games to FINAL, imports their stats, and resolves dependent polls.
  cron.schedule(
    "*/15 13-23,0-1 * * *",
    () => guardedJob("sync games", 10 * 60_000, syncGames),
    { timezone: "America/New_York" },
  );
  // Daily data refresh (football 08:00 UTC, baseball 09:00 UTC).
  cron.schedule("0 8 * * *", () =>
    guardedJob("daily nfl", 20 * 60_000, dailyNflImports),
  );
  cron.schedule("0 9 * * *", () =>
    guardedJob("daily mlb", 20 * 60_000, dailyMlbImports),
  );

  console.log(
    "[scheduler] started — lock 1m · resolve 15m · game sync 15m (1pm–1am ET) · imports daily",
  );
}
