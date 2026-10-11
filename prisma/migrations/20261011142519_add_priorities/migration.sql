-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('URGENT', 'HIGH', 'NORMAL', 'LOW');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "priority" "PriorityLevel" NOT NULL DEFAULT 'NORMAL',
ALTER COLUMN "leadId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PriorityDismissal" (
    "id" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "snoozedUntil" TIMESTAMP(3),
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriorityDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriorityDismissal_itemKey_key" ON "PriorityDismissal"("itemKey");

-- AddForeignKey
ALTER TABLE "PriorityDismissal" ADD CONSTRAINT "PriorityDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
