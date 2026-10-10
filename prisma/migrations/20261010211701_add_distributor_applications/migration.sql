-- CreateEnum
CREATE TYPE "DistributorApplicationStatus" AS ENUM ('NEW', 'CONTACTED', 'APPROVED', 'NOT_SUITABLE');

-- CreateEnum
CREATE TYPE "DistributorApplicationSource" AS ENUM ('WEBSITE_FORM', 'GMAIL_IMPORT');

-- CreateTable
CREATE TABLE "DistributorApplication" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "area" TEXT,
    "age" TEXT,
    "hasCar" BOOLEAN,
    "hasLicence" BOOLEAN,
    "availability" TEXT,
    "status" "DistributorApplicationStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "source" "DistributorApplicationSource" NOT NULL,
    "distributorId" TEXT,
    "gmailMessageId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DistributorApplication_gmailMessageId_key" ON "DistributorApplication"("gmailMessageId");

-- CreateIndex
CREATE INDEX "DistributorApplication_status_idx" ON "DistributorApplication"("status");

-- CreateIndex
CREATE INDEX "DistributorApplication_receivedAt_idx" ON "DistributorApplication"("receivedAt");

-- CreateIndex
CREATE INDEX "DistributorApplication_phone_idx" ON "DistributorApplication"("phone");

-- CreateIndex
CREATE INDEX "DistributorApplication_distributorId_idx" ON "DistributorApplication"("distributorId");

-- AddForeignKey
ALTER TABLE "DistributorApplication" ADD CONSTRAINT "DistributorApplication_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
