-- AddColumn
ALTER TABLE "games" ADD COLUMN "statsImportedAt" TIMESTAMP(3);

-- Existing FINAL games were already handled by the prior pipeline; mark them so
-- the new status sync doesn't re-import their historical stats on first run.
UPDATE "games" SET "statsImportedAt" = CURRENT_TIMESTAMP WHERE "status" = 'FINAL';
