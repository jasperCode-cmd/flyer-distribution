-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('CALL', 'COLD_CALL_BLOCK', 'DISTRIBUTOR_SHIFT', 'GENERAL');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "distributorId" TEXT;

-- CreateTable
CREATE TABLE "Distributor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Distributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "type" "CalendarEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3),
    "notes" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "linkedLeadId" TEXT,
    "linkedJobId" TEXT,
    "assignedToUserId" TEXT,
    "distributorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Distributor_active_idx" ON "Distributor"("active");

-- CreateIndex
CREATE INDEX "CalendarEvent_startDateTime_idx" ON "CalendarEvent"("startDateTime");

-- CreateIndex
CREATE INDEX "CalendarEvent_type_idx" ON "CalendarEvent"("type");

-- CreateIndex
CREATE INDEX "CalendarEvent_assignedToUserId_idx" ON "CalendarEvent"("assignedToUserId");

-- CreateIndex
CREATE INDEX "CalendarEvent_distributorId_idx" ON "CalendarEvent"("distributorId");

-- CreateIndex
CREATE INDEX "CalendarEvent_linkedLeadId_idx" ON "CalendarEvent"("linkedLeadId");

-- CreateIndex
CREATE INDEX "CalendarEvent_linkedJobId_idx" ON "CalendarEvent"("linkedJobId");

-- CreateIndex
CREATE INDEX "Job_distributorId_idx" ON "Job"("distributorId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_linkedLeadId_fkey" FOREIGN KEY ("linkedLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_linkedJobId_fkey" FOREIGN KEY ("linkedJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
