-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('OFFICE', 'SOFTWARE', 'VEHICLE', 'MARKETING', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseKind" AS ENUM ('ONE_OFF', 'MONTHLY');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "isRetainer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retainerEnd" DATE,
ADD COLUMN     "retainerMonthlyPence" INTEGER,
ADD COLUMN     "retainerStart" DATE;

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amountPence" INTEGER NOT NULL,
    "kind" "ExpenseKind" NOT NULL,
    "date" DATE,
    "startMonth" DATE,
    "endMonth" DATE,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_startMonth_idx" ON "Expense"("startMonth");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
