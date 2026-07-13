-- CreateEnum
CREATE TYPE "PollHorizon" AS ENUM ('DAILY', 'SEASON', 'DYNASTY');

-- AlterEnum
ALTER TYPE "PollQuestionType" ADD VALUE 'KEEP';

-- AlterTable
ALTER TABLE "polls" ADD COLUMN     "horizon" "PollHorizon" NOT NULL DEFAULT 'SEASON';
