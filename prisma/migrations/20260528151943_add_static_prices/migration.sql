-- AlterTable
ALTER TABLE "CommodityHolding" ADD COLUMN     "staticPriceId" TEXT;

-- CreateTable
CREATE TABLE "StaticPrice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaticPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaticPriceEntry" (
    "id" TEXT NOT NULL,
    "staticPriceId" TEXT NOT NULL,
    "pricePerTola" DECIMAL(15,4) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaticPriceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaticPrice_userId_name_key" ON "StaticPrice"("userId", "name");

-- AddForeignKey
ALTER TABLE "CommodityHolding" ADD CONSTRAINT "CommodityHolding_staticPriceId_fkey" FOREIGN KEY ("staticPriceId") REFERENCES "StaticPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaticPrice" ADD CONSTRAINT "StaticPrice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaticPriceEntry" ADD CONSTRAINT "StaticPriceEntry_staticPriceId_fkey" FOREIGN KEY ("staticPriceId") REFERENCES "StaticPrice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
