-- CreateEnum
CREATE TYPE "League" AS ENUM ('NFL', 'MLB');

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "awayTeamId" UUID,
ADD COLUMN     "homeTeamId" UUID;

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "teamId" UUID;

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "sport" "Sport" NOT NULL,
    "league" "League" NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "espnAbbr" TEXT,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_sport_abbreviation_key" ON "teams"("sport", "abbreviation");

-- CreateIndex
CREATE INDEX "games_homeTeamId_idx" ON "games"("homeTeamId");

-- CreateIndex
CREATE INDEX "games_awayTeamId_idx" ON "games"("awayTeamId");

-- CreateIndex
CREATE INDEX "players_teamId_idx" ON "players"("teamId");

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
