-- CreateEnum
CREATE TYPE "ScrapReason" AS ENUM ('NOT_INTERESTED', 'WRONG_NUMBER', 'ALREADY_CUSTOMER', 'ASKED_NOT_TO_CONTACT', 'NO_ANSWER', 'OTHER');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "nextCallableAt" TIMESTAMP(3),
ADD COLUMN     "noAnswerStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scrapNote" TEXT,
ADD COLUMN     "scrapReason" "ScrapReason",
ADD COLUMN     "scrapped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scrappedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Lead_scrapped_idx" ON "Lead"("scrapped");

-- CreateIndex
CREATE INDEX "Lead_nextCallableAt_idx" ON "Lead"("nextCallableAt");
