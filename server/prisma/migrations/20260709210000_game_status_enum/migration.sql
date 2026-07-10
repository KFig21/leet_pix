-- Introduce the GameStatus enum and convert games.status from free-text to it,
-- preserving existing rows by mapping the old normalized strings to the labels.

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'FINAL', 'POSTPONED');

-- Normalize existing values so the type cast below succeeds.
UPDATE "games" SET "status" = CASE "status"
  WHEN 'final' THEN 'FINAL'
  WHEN 'in' THEN 'IN_PROGRESS'
  WHEN 'scheduled' THEN 'SCHEDULED'
  ELSE 'SCHEDULED'
END;

-- Switch the column type and give it a default.
ALTER TABLE "games"
  ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE "games"
  ALTER COLUMN "status" TYPE "GameStatus" USING ("status"::"GameStatus");
ALTER TABLE "games"
  ALTER COLUMN "status" SET DEFAULT 'SCHEDULED',
  ALTER COLUMN "status" SET NOT NULL;
