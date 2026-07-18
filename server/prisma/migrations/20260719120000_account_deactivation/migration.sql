-- Reversible deactivation flag on profiles (deletedAt already exists).
ALTER TABLE "profiles" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
