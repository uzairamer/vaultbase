import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const [wallets, properties, stocks, commodities, sideInvestments, receivables, liabilities, transactions] =
    await Promise.all([
      prisma.wallet.findMany({ where: { userId } }),
      prisma.property.findMany({ where: { userId, archivedAt: null }, include: { installments: true } }),
      prisma.stockHolding.findMany({ where: { userId, archivedAt: null }, include: { trades: true } }),
      prisma.commodityHolding.findMany({ where: { userId, archivedAt: null }, include: { trades: true } }),
      prisma.sideInvestment.findMany({ where: { userId } }),
      prisma.receivable.findMany({ where: { userId } }),
      prisma.liability.findMany({ where: { userId } }),
      prisma.transaction.findMany({
        where: { userId, archivedAt: null, NOT: { source: "reconciliation" } },
        orderBy: { date: "asc" },
        include: { category: true },
      }),
    ])

  return NextResponse.json({
    wallets,
    properties,
    stocks,
    commodities,
    sideInvestments,
    receivables,
    liabilities,
    transactions,
  })
}
