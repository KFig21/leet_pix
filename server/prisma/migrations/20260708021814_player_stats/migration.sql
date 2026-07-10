-- CreateEnum
CREATE TYPE "PlayerStatKind" AS ENUM ('ACTUAL', 'PROJECTION');

-- AlterTable
ALTER TABLE "polls" ADD COLUMN     "season" INTEGER,
ADD COLUMN     "week" INTEGER;

-- CreateTable
CREATE TABLE "player_stats" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "season" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "kind" "PlayerStatKind" NOT NULL,
    "stats" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_stats_season_week_kind_idx" ON "player_stats"("season", "week", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "player_stats_playerId_season_week_kind_key" ON "player_stats"("playerId", "season", "week", "kind");

-- AddForeignKey
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
