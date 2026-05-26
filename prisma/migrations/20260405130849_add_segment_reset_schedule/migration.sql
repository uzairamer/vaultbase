-- AlterTable
ALTER TABLE "WalletSegment" ADD COLUMN     "lastResetAt" TIMESTAMP(3),
ADD COLUMN     "resetAmount" DECIMAL(15,2),
ADD COLUMN     "resetSchedule" TEXT NOT NULL DEFAULT 'none';
