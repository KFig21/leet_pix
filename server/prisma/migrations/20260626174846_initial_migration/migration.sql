-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('FOOTBALL', 'BASEBALL');

-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('OPEN', 'LOCKED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "PollLockType" AS ENUM ('FIXED_TIME', 'GAME_START');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatar" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "followerId" UUID NOT NULL,
    "followingId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateTable
CREATE TABLE "polls" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "sport" "Sport" NOT NULL,
    "question" TEXT NOT NULL,
    "status" "PollStatus" NOT NULL DEFAULT 'OPEN',
    "lockType" "PollLockType" NOT NULL,
    "lockAt" TIMESTAMP(3),
    "scoringPreset" TEXT,
    "scoringFormatId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_options" (
    "id" UUID NOT NULL,
    "pollId" UUID NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "projectedPoints" DOUBLE PRECISION,
    "actualPoints" DOUBLE PRECISION,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" UUID NOT NULL,
    "pollId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "voterId" UUID NOT NULL,
    "consensusAtVote" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_results" (
    "id" UUID NOT NULL,
    "voteId" UUID NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_formats" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoring_formats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- CreateIndex
CREATE INDEX "profiles_username_idx" ON "profiles"("username");

-- CreateIndex
CREATE INDEX "follows_followingId_idx" ON "follows"("followingId");

-- CreateIndex
CREATE INDEX "polls_authorId_createdAt_idx" ON "polls"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "polls_status_lockAt_idx" ON "polls"("status", "lockAt");

-- CreateIndex
CREATE INDEX "poll_options_pollId_idx" ON "poll_options"("pollId");

-- CreateIndex
CREATE INDEX "votes_voterId_createdAt_idx" ON "votes"("voterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "votes_pollId_voterId_key" ON "votes"("pollId", "voterId");

-- CreateIndex
CREATE UNIQUE INDEX "poll_results_voteId_key" ON "poll_results"("voteId");

-- CreateIndex
CREATE INDEX "poll_results_resolvedAt_idx" ON "poll_results"("resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_formats_ownerId_name_key" ON "scoring_formats"("ownerId", "name");

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_scoringFormatId_fkey" FOREIGN KEY ("scoringFormatId") REFERENCES "scoring_formats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_results" ADD CONSTRAINT "poll_results_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "votes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_formats" ADD CONSTRAINT "scoring_formats_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
