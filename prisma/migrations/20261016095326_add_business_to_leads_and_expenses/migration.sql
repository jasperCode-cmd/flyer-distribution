-- CreateEnum
CREATE TYPE "Business" AS ENUM ('FDH', 'LDB');

-- CreateEnum
CREATE TYPE "ExpenseBusiness" AS ENUM ('FDH', 'LDB', 'SHARED');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "business" "Business" NOT NULL DEFAULT 'FDH';

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "business" "ExpenseBusiness" NOT NULL DEFAULT 'SHARED';

-- CreateIndex
CREATE INDEX "Lead_business_idx" ON "Lead"("business");

