-- CreateEnum
CREATE TYPE "JobCostCategory" AS ENUM ('DISTRIBUTOR', 'FUEL', 'PRINTING', 'DESIGN', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "DistributorPayType" AS ENUM ('FLAT', 'PER_THOUSAND');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "wonAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "JobCost" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "category" "JobCostCategory" NOT NULL,
    "distributorId" TEXT,
    "payType" "DistributorPayType",
    "ratePence" INTEGER,
    "leafletCount" INTEGER,
    "amountPence" INTEGER NOT NULL,
    "label" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobCost_leadId_idx" ON "JobCost"("leadId");

-- CreateIndex
CREATE INDEX "JobCost_distributorId_idx" ON "JobCost"("distributorId");

-- CreateIndex
CREATE INDEX "Lead_wonAt_idx" ON "Lead"("wonAt");

-- AddForeignKey
ALTER TABLE "JobCost" ADD CONSTRAINT "JobCost_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCost" ADD CONSTRAINT "JobCost_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
