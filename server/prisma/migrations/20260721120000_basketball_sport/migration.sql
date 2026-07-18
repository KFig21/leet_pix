-- Add basketball as a third sport: the BASKETBALL sport, its NBA league, and the
-- per-sport ESPN-athlete-id upsert key for NBA players (mirrors sleeperId for
-- NFL and mlbamId for MLB). Enum values and the column/index are added
-- idempotently so re-applying is a no-op. The new enum values aren't referenced
-- by the table changes below, so this is safe to run in one transaction.

-- AlterEnum
ALTER TYPE "Sport" ADD VALUE IF NOT EXISTS 'BASKETBALL';

-- AlterEnum
ALTER TYPE "League" ADD VALUE IF NOT EXISTS 'NBA';

-- AlterTable
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "nbaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "players_nbaId_key" ON "players"("nbaId");
