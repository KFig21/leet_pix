/*
  Warnings:

  - You are about to drop the column `question` on the `polls` table. All the data in the column will be lost.
  - Added the required column `questionType` to the `polls` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PollQuestionType" AS ENUM ('START', 'ADD', 'DROP', 'TRADE_FOR', 'TRADE_AWAY', 'BUY_LOW');

-- AlterTable
ALTER TABLE "polls" DROP COLUMN "question",
ADD COLUMN     "questionType" "PollQuestionType" NOT NULL;
