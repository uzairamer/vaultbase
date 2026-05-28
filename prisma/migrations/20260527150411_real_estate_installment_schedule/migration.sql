-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'regular',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "balloonAmount" DECIMAL(15,2),
ADD COLUMN     "balloonEveryNMonths" INTEGER,
ADD COLUMN     "installmentDueDay" INTEGER,
ADD COLUMN     "installmentMonths" INTEGER,
ADD COLUMN     "installmentStartDate" TIMESTAMP(3),
ADD COLUMN     "monthlyInstallment" DECIMAL(15,2);
