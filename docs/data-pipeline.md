# Data pipeline: games, schedules, locking & resolution

How LeetPix turns real-world schedules and box scores into locked, graded polls.
Everything runs from an **in-process scheduler** (`server/src/scheduler.ts`) using
`node-cron`; the job bodies are plain functions in `server/src/jobs/*` and
`server/src/services/*`, so they double as CLI scripts and can move to platform
cron later unchanged.

---

## The lifecycle at a glance

```
 provider APIs                    our DB                         polls
 ─────────────                    ──────                         ─────
 ESPN / MLB  ──importGames──▶  Game(SCHEDULED)  ──creation──▶  PollGame links
 schedule                         │                            lockAt = min(kickoff) − lead
                                  │ kickoff − lead reached
                                  ▼
                            lockDuePolls (1m)  ──────────────▶  Poll: OPEN → LOCKED
                                  │
 syncGames (15m, in-window) ─────┤ refresh status
                                  ▼
                            Game(FINAL) ──import box scores──▶  PlayerStat(ACTUAL)
                                  │  (statsImportedAt marker)
                                  ▼
                            resolveDuePolls ────────────────▶  Poll: LOCKED → RESOLVED
                                  (all linked games FINAL             + grade votes
                                   AND stats present)                 + notify voters
```

Two enums drive it:
- **`GameStatus`** — `SCHEDULED → IN_PROGRESS → FINAL` (+ `POSTPONED`).
- **`PollStatus`** — `OPEN → LOCKED → RESOLVED`.

---

## 1. How do games get into the DB?

Two importers, both keyless/free provider APIs, upserting by `(source, sourceId)`
so re-running is idempotent:

| Sport | Job | Source | File |
|-------|-----|--------|------|
| NFL | `importNflGames(season, week)` | ESPN scoreboard | `server/src/jobs/importGames.ts` |
| MLB | `importMlbGames(season, date)` | MLB Stats API | `server/src/jobs/importGames.ts` |

Each game row stores `kickoff`, `status` (normalized to `GameStatus`), the team
abbreviations, and FK `homeTeamId`/`awayTeamId` (resolved via `teamIdByAbbr`).

They run in two places:
- **Daily** (`dailyNflImports` at 08:00 UTC, `dailyMlbImports` at 09:00 UTC) —
  pulls the current + upcoming slate so lock times are known **before** game day,
  alongside roster/injury sync and projections.
- **Every 15 min in-window** (`syncGames`, 1 PM–1 AM ET) — re-imports the active
  slate to keep `status` fresh (this is what flips games to `FINAL`).

**So going into a day, we already know every game and its kickoff.**

---

## 2. How do we know when a game starts?

`Game.kickoff` is the provider's scheduled start. A poll doesn't lock exactly at
kickoff — it locks a lead time earlier (`GAME_LOCK_LEAD_MS` in
`@leetpix/shared`) so nobody votes after lineups matter.

---

## 3. How does the app know when to lock a poll?

**At poll creation** (`server/src/routes/polls.ts`) we compute the lock time from
the schedule and freeze the exact games the poll depends on:

- Football → `gameStartLockAt(season, week, playerIds)` = earliest kickoff of the
  players' games, minus the lead.
- Baseball → `baseballStartInfo(playerIds)` = each player's next game date.
- `pollGameIds(...)` records the specific `Game` rows into the **`PollGame`** join
  table. Frozen at creation, so a later trade can't drift the dependency set.

The result is stored as `Poll.lockAt`.

**At lock time**, `lockDuePolls()` (`server/src/services/locking.ts`) runs **every
minute**:

```
UPDATE polls SET status = LOCKED
WHERE status = OPEN AND lockAt < now()
```

Voting is also guarded server-side (`server/src/routes/votes.ts`) — a vote is
rejected if the poll isn't `OPEN` or `lockAt` has passed, so the 1-minute cron is
just the visible state change, not the enforcement boundary.

---

## 4. How does the app know a game is over, and resolve the poll?

This is the `syncGames` loop (`server/src/scheduler.ts`), every 15 min, 1 PM–1 AM ET:

1. **Refresh statuses** — re-import the active NFL week + MLB slate; games flip to
   `FINAL` when the provider reports them final.
2. **Import box scores on the `→ FINAL` transition** — find every `FINAL` game
   whose `statsImportedAt` is still null, group them by scoring period, and import
   that period's `PlayerStat(ACTUAL)` rows exactly once:
   - Football → `importNflStats(season, week, "actual")` (Sleeper).
   - Baseball → `importMlbStats(date, { finalOnly: true })` (MLB boxscores).
   - On success the games are stamped `statsImportedAt`; on failure the marker
     stays null so the **next run retries**. No double-imports, no missed finals.
3. **Resolve** — `resolveDuePolls()` (`server/src/services/resolution.ts`) grades
   any poll that is past lock, tagged with a season/period, and **complete**:
   - `pollGamesFinal(pollId)` — are *this poll's* linked games all `FINAL`/`POSTPONED`?
   - Falls back to `periodGamesFinal(sport, season, week)` for multi-week or
     legacy/unlinked polls.
   - Plus a guard that the period's box scores actually exist (so scoring reflects
     real numbers, not zeros).

   When complete, `resolvePoll(...)` scores every option, marks the winner,
   grades each vote into `PollResult`, sets `Poll.status = RESOLVED`, and notifies
   the author + all voters (`notifyPollResolved`).

**Net effect:** a poll grades within ~15 minutes of its last game ending — not the
next morning.

### Why "game FINAL" instead of "stats exist"?
The old heuristic ("resolve as soon as any stat row exists") couldn't tell a
*partial* slate from a *complete* one, which risked grading against half-finished
games. Gating on real `FINAL` game status is the correct completion signal, and it
works identically for both sports. `POSTPONED` games count as "done" too (they
never produce stats), so a rainout can't hold a poll open forever.

---

## Cron schedule summary

| Job | Frequency | Purpose |
|-----|-----------|---------|
| `lockDuePolls` | every 1 min | `OPEN → LOCKED` at lock time |
| `resolveDuePolls` | every 15 min | backstop resolver (outside sync window) |
| `syncGames` | every 15 min, 1 PM–1 AM ET | status refresh → stat import → resolve |
| `dailyNflImports` | 08:00 UTC | rosters, schedule, actuals, projections |
| `dailyMlbImports` | 09:00 UTC | rosters, schedule, prior-day box scores |

Disable the whole scheduler with `SCHEDULER_ENABLED=false` (useful in dev).

---

## 5. Will the DB get bloated?

Short answer: **games and polls are tiny; votes are the only table that grows with
engagement, and even that is cheap for a long time.**

**Games** — bounded by the sports calendar, not by users:
- NFL ≈ 272 games/season; MLB ≈ 2,430 games/season. Call it ~2.7k rows/year.
- These are small rows. Years of history is still well under a million rows —
  negligible for Postgres.

**Polls / options / poll_games** — grow with how much people post:
- Each poll adds 1 poll row, 2–4 option rows, and (for scored polls) a handful of
  `PollGame` links. All small.

**Votes / poll_results** — the real growth driver, one row per user per poll they
answer. This scales with users × polls, but rows are tiny (a few UUIDs + a float).
Millions of rows is fine on Postgres with the existing indexes.

### If/when you want to keep it lean
Nothing here needs action now, but the levers are:
- **Prune old games** you'll never grade against (e.g. `DELETE FROM games WHERE
  status = 'FINAL' AND kickoff < now() - interval '2 years'`). `PollGame` cascades,
  and resolved polls no longer need their links.
- **Archive resolved polls** older than N months to cold storage if the timeline
  query ever slows (it's already `take`-limited and index-backed).
- **Thin `PlayerStat`** for seasons you no longer score.

The current indexes that matter for these access patterns:
`Game(sport, season, week)`, `Game(sport, kickoff)`, `Poll(status, lockAt)`,
`Vote(pollId, voterId)` unique, and `PollGame(gameId)`.

---

## Operational note

The scheduler is **in-process and single-worker**. If you ever run multiple server
instances, add a single-instance guard (or move these jobs to platform cron /
a dedicated worker) so imports and resolution don't run twice concurrently.
