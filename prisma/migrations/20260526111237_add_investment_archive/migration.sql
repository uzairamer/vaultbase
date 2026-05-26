-- AlterTable
ALTER TABLE "CommodityHolding" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StockHolding" ADD COLUMN     "archivedAt" TIMESTAMP(3);
