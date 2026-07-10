-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL,
    "sport" "Sport" NOT NULL,
    "season" INTEGER NOT NULL,
    "week" INTEGER,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "kickoff" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "games_sport_season_week_idx" ON "games"("sport", "season", "week");

-- CreateIndex
CREATE INDEX "games_sport_kickoff_idx" ON "games"("sport", "kickoff");

-- CreateIndex
CREATE UNIQUE INDEX "games_source_sourceId_key" ON "games"("source", "sourceId");
