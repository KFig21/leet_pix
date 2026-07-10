-- CreateTable
CREATE TABLE "poll_games" (
    "pollId" UUID NOT NULL,
    "gameId" UUID NOT NULL,

    CONSTRAINT "poll_games_pkey" PRIMARY KEY ("pollId", "gameId")
);

-- CreateIndex
CREATE INDEX "poll_games_gameId_idx" ON "poll_games"("gameId");

-- AddForeignKey
ALTER TABLE "poll_games" ADD CONSTRAINT "poll_games_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_games" ADD CONSTRAINT "poll_games_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
