import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

function getQuarterRange(year: number, quarter: number): { from: Date; to: Date } {
  const monthStart = (quarter - 1) * 3
  const from = new Date(year, monthStart, 1)
  const to = new Date(year, monthStart + 3, 0, 23, 59, 59, 999)
  return { from, to }
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()))
  const quarter = parseInt(searchParams.get("quarter") ?? String(Math.ceil((now.getMonth() + 1) / 3)))

  if (quarter < 1 || quarter > 4) return NextResponse.json({ error: "Invalid quarter" }, { status: 400 })

  const { from, to } = getQuarterRange(year, quarter)
  const userId = session.user.id

  const [wallets, stocks, commodities, properties, sideInvestments, receivables, liabilities, transactions] =
    await Promise.all([
      prisma.wallet.findMany({ where: { userId }, include: { segments: true } }),
      prisma.stockHolding.findMany({ where: { userId }, include: { trades: { where: { type: "sell" } } } }),
      prisma.commodityHolding.findMany({ where: { userId } }),
      prisma.property.findMany({ where: { userId }, include: { installments: true } }),
      prisma.sideInvestment.findMany({ where: { userId } }),
      prisma.receivable.findMany({ where: { userId, status: { not: "settled" } } }),
      prisma.liability.findMany({ where: { userId, status: { not: "settled" } } }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: from, lte: to } },
        include: { category: true },
        orderBy: { date: "asc" },
      }),
    ])

  // ── Assets ────────────────────────────────────────────────────────────────

  const walletItems = wallets.map((w) => ({
    id: w.id,
    name: w.name,
    type: w.type,
    balance: Number(w.balance),
    segments: w.segments.map((s) => ({ id: s.id, name: s.name, amount: Number(s.amount), color: s.color })),
  }))
  const walletTotal = walletItems.reduce((sum, w) => sum + w.balance, 0)

  // Aggregate holdings with the same symbol: use net qty (buy − sold), weighted-average buy price
  const stockAggMap = stocks.reduce<Record<string, { symbol: string; name: string; quantity: number; totalCost: number; currentPrice: number | null }>>(
    (acc, s) => {
      const sym = s.symbol
      const buyQty = Number(s.quantity)
      const soldQty = s.trades.reduce((sum, t) => sum + Number(t.quantity), 0)
      const netQty = Math.max(0, buyQty - soldQty)
      const avg = Number(s.avgBuyPrice)
      if (!acc[sym]) acc[sym] = { symbol: sym, name: s.name, quantity: 0, totalCost: 0, currentPrice: s.currentPrice ? Number(s.currentPrice) : null }
      acc[sym].quantity += netQty
      acc[sym].totalCost += netQty * avg
      return acc
    },
    {}
  )
  const stockItems = Object.values(stockAggMap).map((entry) => {
    const avgBuyPrice = entry.quantity > 0 ? entry.totalCost / entry.quantity : 0
    const price = entry.currentPrice ?? avgBuyPrice
    return {
      symbol: entry.symbol,
      name: entry.name,
      quantity: entry.quantity,
      avgBuyPrice,
      currentPrice: entry.currentPrice,
      value: price * entry.quantity,
    }
  })
  const stockTotal = stockItems.reduce((sum, s) => sum + s.value, 0)

  const commodityItems = commodities.map((c) => {
    const qty = Number(c.quantity)
    const price = c.currentPrice ? Number(c.currentPrice) : Number(c.avgBuyPrice)
    return {
      type: c.type,
      unit: c.unit,
      quantity: qty,
      avgBuyPrice: Number(c.avgBuyPrice),
      currentPrice: c.currentPrice ? Number(c.currentPrice) : null,
      value: price * qty,
    }
  })
  const commodityTotal = commodityItems.reduce((sum, c) => sum + c.value, 0)

  const realEstateItems = properties.map((p) => {
    const paidInstallments = p.installments
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + Number(i.amount), 0)
    const amountPaid = Number(p.downPayment) + paidInstallments
    return {
      id: p.id,
      name: p.name,
      location: p.location,
      totalPrice: Number(p.totalPrice),
      currentValue: p.currentValue ? Number(p.currentValue) : null,
      value: p.currentValue ? Number(p.currentValue) : Number(p.totalPrice),
      amountPaid,
      status: p.status,
    }
  })
  const realEstateTotal = realEstateItems.reduce((sum, p) => sum + p.value, 0)

  const sideItems = sideInvestments
    .filter((s) => s.status === "active")
    .map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      investedAmount: Number(s.investedAmount),
      currentValue: Number(s.currentValue),
    }))
  const sideTotal = sideItems.reduce((sum, s) => sum + s.currentValue, 0)

  const receivableItems = receivables.map((r) => ({
    id: r.id,
    personName: r.personName,
    amount: Number(r.amount),
    amountPaid: Number(r.amountPaid),
    remaining: Number(r.amount) - Number(r.amountPaid),
    status: r.status,
    dueDate: r.dueDate?.toISOString() ?? null,
  }))
  const receivableTotal = receivableItems.reduce((sum, r) => sum + r.remaining, 0)

  const totalAssets = walletTotal + stockTotal + commodityTotal + realEstateTotal + sideTotal + receivableTotal

  // ── Liabilities ──────────────────────────────────────────────────────────

  const liabilityItems = liabilities.map((l) => ({
    id: l.id,
    personName: l.personName,
    amount: Number(l.amount),
    amountPaid: Number(l.amountPaid),
    remaining: Number(l.amount) - Number(l.amountPaid),
    status: l.status,
    dueDate: l.dueDate?.toISOString() ?? null,
  }))
  const liabilityTotal = liabilityItems.reduce((sum, l) => sum + l.remaining, 0)

  // ── Cash Flow (quarter window) ────────────────────────────────────────────

  const inflow = transactions.filter((t) => t.type === "inflow").reduce((sum, t) => sum + Number(t.amount), 0)
  const outflow = transactions.filter((t) => t.type === "outflow").reduce((sum, t) => sum + Number(t.amount), 0)

  // Aggregate by category name (or subType if no category)
  const catMap = new Map<string, { name: string; type: string; total: number }>()
  for (const t of transactions) {
    const key = t.category?.name ?? t.subType ?? "Uncategorized"
    const type = t.type
    if (!catMap.has(key)) catMap.set(key, { name: key, type, total: 0 })
    catMap.get(key)!.total += Number(t.amount)
  }
  const categories = Array.from(catMap.values()).sort((a, b) => b.total - a.total)

  return NextResponse.json({
    period: {
      year,
      quarter,
      label: `Q${quarter} ${year}`,
      from: from.toISOString(),
      to: to.toISOString(),
    },
    assets: {
      wallets: { total: walletTotal, items: walletItems },
      stocks: { total: stockTotal, items: stockItems },
      commodities: { total: commodityTotal, items: commodityItems },
      realEstate: { total: realEstateTotal, items: realEstateItems },
      sideInvestments: { total: sideTotal, items: sideItems },
      receivables: { total: receivableTotal, items: receivableItems },
      totalAssets,
    },
    liabilities: { total: liabilityTotal, items: liabilityItems },
    cashFlow: { inflow, outflow, net: inflow - outflow, categories },
    netWorth: totalAssets - liabilityTotal,
  })
}
