-- AlterTable
ALTER TABLE "profiles"
    ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3);

-- Existing users are already set up — don't force them through the setup wizard.
UPDATE "profiles" SET "onboardingCompletedAt" = NOW();
