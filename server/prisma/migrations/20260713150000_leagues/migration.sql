-- CreateTable
CREATE TABLE "leagues" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "numTeams" INTEGER NOT NULL,
    "lineup" JSONB NOT NULL,
    "scoringPreset" TEXT,
    "scoringFormatId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leagues_ownerId_name_key" ON "leagues"("ownerId", "name");

-- AlterTable
ALTER TABLE "polls" ADD COLUMN     "leagueId" UUID;

-- AddForeignKey
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_scoringFormatId_fkey" FOREIGN KEY ("scoringFormatId") REFERENCES "scoring_formats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
