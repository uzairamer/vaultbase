import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { pricePerUnit } from "@/lib/commodity-prices"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const [wallets, properties, stocks, commodities, sideInvestments, receivables, liabilities, transactions] =
    await Promise.all([
      prisma.wallet.findMany({ where: { userId } }),
      prisma.property.findMany({ where: { userId, archivedAt: null }, include: { installments: true } }),
      prisma.stockHolding.findMany({ where: { userId, archivedAt: null }, include: { trades: true } }),
      prisma.commodityHolding.findMany({ where: { userId, archivedAt: null }, include: { trades: { where: { type: "sell" } }, staticPrice: { include: { entries: { orderBy: { date: "desc" }, take: 1 } } } } }),
      prisma.sideInvestment.findMany({ where: { userId } }),
      prisma.receivable.findMany({ where: { userId } }),
      prisma.liability.findMany({ where: { userId } }),
      prisma.transaction.findMany({
        where: { userId, archivedAt: null, NOT: { source: "reconciliation" } },
        orderBy: { date: "asc" },
        include: { category: true },
      }),
    ])

  // Attach resolvedPrice to each commodity so consumers don't have to re-derive
  const commoditiesResolved = commodities.map((c) => {
    let resolvedPrice = c.currentPrice != null ? Number(c.currentPrice) : Number(c.avgBuyPrice)
    const sp = (c as unknown as { staticPrice?: { entries?: Array<{ pricePerTola: unknown }> } }).staticPrice
    if (sp?.entries?.length) {
      resolvedPrice = pricePerUnit(Number(sp.entries[0].pricePerTola), c.unit)
    }
    return { ...c, resolvedPrice }
  })

  return NextResponse.json({
    wallets,
    properties,
    stocks,
    commodities: commoditiesResolved,
    sideInvestments,
    receivables,
    liabilities,
    transactions,
  })
}
