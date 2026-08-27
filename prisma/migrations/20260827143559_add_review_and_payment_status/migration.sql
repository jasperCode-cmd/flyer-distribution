-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('NOT_REQUESTED', 'REQUESTED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_PAID', 'DEPOSIT_PAID', 'PARTIAL_PAID', 'PAID_IN_FULL');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "amountPaid" DECIMAL(10,2),
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_PAID',
ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'NOT_REQUESTED';

