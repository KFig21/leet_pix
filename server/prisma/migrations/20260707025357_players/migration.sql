-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL,
    "sport" "Sport" NOT NULL,
    "fullName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "team" TEXT,
    "position" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sleeperId" TEXT,
    "espnId" TEXT,
    "yahooId" TEXT,
    "mlbamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_sleeperId_key" ON "players"("sleeperId");

-- CreateIndex
CREATE UNIQUE INDEX "players_mlbamId_key" ON "players"("mlbamId");

-- CreateIndex
CREATE INDEX "players_sport_active_fullName_idx" ON "players"("sport", "active", "fullName");

-- CreateIndex
CREATE INDEX "players_fullName_idx" ON "players"("fullName");
