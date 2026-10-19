-- CreateEnum
CREATE TYPE "AreaKind" AS ENUM ('CIRCLE', 'RECTANGLE', 'POLYGON', 'POSTCODE');

-- CreateEnum
CREATE TYPE "AreaStatus" AS ENUM ('PLANNED', 'ASSIGNED', 'DONE');

-- AlterTable
ALTER TABLE "Distributor" ADD COLUMN     "mapColour" TEXT;

-- AlterTable
ALTER TABLE "JobCost" ADD COLUMN     "areaId" TEXT;

-- CreateTable
CREATE TABLE "AreaProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "leadId" TEXT,
    "business" "Business" NOT NULL DEFAULT 'FDH',
    "distributorTitle" TEXT,
    "targetLeaflets" INTEGER,
    "ldbLinksEnabled" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedArea" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "AreaKind" NOT NULL,
    "geometry" JSONB NOT NULL,
    "centreLat" DOUBLE PRECISION,
    "centreLng" DOUBLE PRECISION,
    "radiusM" INTEGER,
    "postcode" TEXT,
    "label" TEXT,
    "distributorId" TEXT,
    "leafletCount" INTEGER,
    "status" "AreaStatus" NOT NULL DEFAULT 'PLANNED',
    "households" INTEGER,
    "payType" "DistributorPayType",
    "ratePence" INTEGER,
    "amountPence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaShareLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),

    CONSTRAINT "AreaShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AreaProject_leadId_key" ON "AreaProject"("leadId");

-- CreateIndex
CREATE INDEX "AreaProject_closedAt_idx" ON "AreaProject"("closedAt");

-- CreateIndex
CREATE INDEX "PlannedArea_projectId_idx" ON "PlannedArea"("projectId");

-- CreateIndex
CREATE INDEX "PlannedArea_distributorId_idx" ON "PlannedArea"("distributorId");

-- CreateIndex
CREATE UNIQUE INDEX "AreaShareLink_tokenHash_key" ON "AreaShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX "AreaShareLink_projectId_distributorId_idx" ON "AreaShareLink"("projectId", "distributorId");

-- CreateIndex
CREATE UNIQUE INDEX "JobCost_areaId_key" ON "JobCost"("areaId");

-- AddForeignKey
ALTER TABLE "JobCost" ADD CONSTRAINT "JobCost_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "PlannedArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaProject" ADD CONSTRAINT "AreaProject_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedArea" ADD CONSTRAINT "PlannedArea_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AreaProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedArea" ADD CONSTRAINT "PlannedArea_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaShareLink" ADD CONSTRAINT "AreaShareLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AreaProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaShareLink" ADD CONSTRAINT "AreaShareLink_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
