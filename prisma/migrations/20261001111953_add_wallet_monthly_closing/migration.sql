-- CreateTable
CREATE TABLE "WalletMonthlyClosing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "openingBalance" DECIMAL(15,2) NOT NULL,
    "closingBalance" DECIMAL(15,2) NOT NULL,
    "income" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "transfersIn" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "transfersOut" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "trackedSpend" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "residual" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletMonthlyClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletMonthlyClosing_walletId_year_month_key" ON "WalletMonthlyClosing"("walletId", "year", "month");

-- AddForeignKey
ALTER TABLE "WalletMonthlyClosing" ADD CONSTRAINT "WalletMonthlyClosing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletMonthlyClosing" ADD CONSTRAINT "WalletMonthlyClosing_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
