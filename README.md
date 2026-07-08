# LeetPix 🏈⚾

A social platform for fantasy-sports **picks**. Users post poll-style questions
("Who should I start?"), the platform attaches statistical projections scored
into fantasy points, and every pick is graded over time with risk-weighted
accuracy stats, hot/cold streaks, and a GitHub-style participation heat map.

> No free-text posts/replies and no avatar uploads (by design — keeps moderation
> light). Avatars are chosen SVG icons + colors. Polls are anti-spam limited:
> one per 4h, bypassable by voting on 5 other polls.

## Stack

| Layer    | Tech                                                        |
| -------- | ----------------------------------------------------------- |
| Client   | React + Vite + TypeScript, React Router, TanStack Query, SCSS |
| Server   | Node + Express + TypeScript, Prisma                         |
| Database | Supabase (Postgres)                                         |
| Auth     | Supabase Auth (email/password + OAuth)                      |
| Stats    | Python + BeautifulSoup service (`scraper/`) — source TBD    |
| Shared   | `@leetpix/shared` — TS types + Zod schemas + constants      |

## Layout

```
client/            React app — paired Component.tsx + Component.scss
server/            Express API + Prisma schema/migrations
packages/shared/   Types, Zod schemas, domain constants (client + server)
scraper/           Python projections/stats service
styles/            Shared SCSS: _variables, _themes (light/dark), _mixins, global
docker-compose.yml
```

## Getting started

```bash
# 1. Install (npm workspaces)
npm install

# 2. Configure env
cp .env.example .env   # fill in Supabase URL/keys + DATABASE_URL

# 3. Set up the database
npm run db:generate    # prisma client
npm run db:migrate     # create tables in Supabase

# 4. Run client + server together
npm run dev
#   client → http://localhost:5173
#   server → http://localhost:4000
```

### Supabase notes

- `Profile.id` mirrors `auth.users.id`. Add a trigger/edge function (or the
  `PUT /api/profiles/me` upsert) to create a profile row on first sign-in.
- Server verifies Supabase access tokens with `SUPABASE_JWT_SECRET`.

## Domain rules (see `packages/shared/src/constants.ts`)

- **Cooldown:** 1 poll / 4h, or vote on 5 others' polls to bypass.
- **Locking:** fixed time, or 5 min before a referenced player's game.
- **Scoring:** built-in presets (standard / 0.5 PPR / PPR / baseball) or custom
  saved formats. Projected points = scoring format applied to projected stats.
- **Risk weighting:** a correct pick on a low-consensus option scores higher.

## Open decisions

- **Projection source** (`scraper/`): free API vs. library vs. scraping
  ESPN/Yahoo/Sleeper. Seam defined in `scraper/src/projections.py`.
- **Poll resolution / lock scheduling**: needs a job runner (cron/queue) — see
  TODOs in `server/src/routes/polls.ts`.
```
