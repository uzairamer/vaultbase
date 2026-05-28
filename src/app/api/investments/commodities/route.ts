import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"
import { pricePerUnit } from "@/lib/commodity-prices"

// Resolve the effective current price for a holding, preferring static price if linked.
function resolvePrice(holding: { unit: string; currentPrice: unknown; avgBuyPrice: unknown; staticPrice?: { entries: Array<{ pricePerTola: unknown; date: unknown }> } | null }): number {
  if (holding.staticPrice?.entries?.length) {
    // Entries are ordered by date desc — first = latest
    const latest = holding.staticPrice.entries[0]
    return pricePerUnit(Number(latest.pricePerTola), holding.unit)
  }
  return holding.currentPrice != null ? Number(holding.currentPrice) : Number(holding.avgBuyPrice)
}

const holdingSchema = z.object({
  type: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.coerce.number().positive(),
  totalCostPaid: z.coerce.number().positive(),
  avgBuyPrice: z.coerce.number().positive().optional(),
  purchaseDate: z.coerce.date().optional(),
  currentPrice: z.coerce.number().optional().nullable(),
  staticPriceId: z.string().optional().nullable(),
  currency: z.string().default("PKR"),
  walletId: z.string().optional().nullable(),
})

const tradeSchema = z.object({
  holdingId: z.string().min(1),
  type: z.string().min(1),
  quantity: z.coerce.number().positive(),
  price: z.coerce.number().positive(),
  date: z.coerce.date(),
  notes: z.string().optional(),
  walletId: z.string().optional().nullable(),  // optional — credit sale proceeds to wallet
  totalReceived: z.coerce.number().optional(), // total received on sell (for wallet tx amount)
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  const includeStatic = {
    trades: { orderBy: { date: "desc" } },
    staticPrice: { include: { entries: { orderBy: { date: "desc" }, take: 1 } } },
  } as const

  if (id) {
    const holding = await prisma.commodityHolding.findFirst({
      where: { id, userId: session.user.id },
      include: includeStatic,
    })
    if (!holding) return NextResponse.json(holding)
    return NextResponse.json({ ...holding, resolvedPrice: resolvePrice(holding) })
  }

  const holdings = await prisma.commodityHolding.findMany({
    where: { userId: session.user.id, archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: includeStatic,
  })

  return NextResponse.json(holdings.map((h) => ({ ...h, resolvedPrice: resolvePrice(h) })))
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  if (body.holdingId) {
    const parsed = tradeSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const holding = await prisma.commodityHolding.findFirst({
      where: { id: parsed.data.holdingId, userId: session.user.id },
    })
    if (!holding) return NextResponse.json({ error: "Holding not found" }, { status: 404 })

    const { walletId, totalReceived, ...tradeData } = parsed.data

    const trade = await prisma.commodityTrade.create({ data: tradeData })

    const allTrades = await prisma.commodityTrade.findMany({ where: { holdingId: parsed.data.holdingId } })
    let totalQty = 0
    let totalCost = 0
    for (const t of allTrades) {
      if (t.type === "buy") {
        totalQty += Number(t.quantity)
        totalCost += Number(t.quantity) * Number(t.price)
      } else {
        totalQty -= Number(t.quantity)
      }
    }
    await prisma.commodityHolding.update({
      where: { id: parsed.data.holdingId },
      data: {
        quantity: Math.max(0, totalQty),
        avgBuyPrice: totalQty > 0 ? totalCost / totalQty : Number(holding.avgBuyPrice),
      },
    })

    // Optionally credit sale proceeds to wallet
    if (walletId && parsed.data.type === "sell") {
      const amount = totalReceived ?? (parsed.data.quantity * parsed.data.price)
      const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId: session.user.id } })
      if (wallet) {
        await prisma.$transaction([
          prisma.transaction.create({
            data: {
              userId: session.user.id,
              walletId,
              type: "inflow",
              subType: "other_inflow",
              amount,
              description: `Sold ${holding.type} (${parsed.data.quantity} ${holding.unit})`,
              date: parsed.data.date,
            },
          }),
          prisma.wallet.update({ where: { id: walletId }, data: { balance: { increment: amount } } }),
        ])
      }
    }

    return NextResponse.json(trade, { status: 201 })
  }

  const parsed = holdingSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { totalCostPaid, quantity, avgBuyPrice, walletId, ...rest } = parsed.data
  const derivedAvgBuyPrice = avgBuyPrice ?? (totalCostPaid / quantity)

  const holding = await prisma.commodityHolding.create({
    data: { ...rest, quantity, totalCostPaid, avgBuyPrice: derivedAvgBuyPrice, userId: session.user.id },
  })

  // Optionally deduct purchase cost from wallet
  if (walletId) {
    const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId: session.user.id } })
    if (wallet) {
      await prisma.$transaction([
        prisma.transaction.create({
          data: {
            userId: session.user.id,
            walletId,
            type: "outflow",
            subType: "savings_investment",
            amount: totalCostPaid,
            description: `Bought ${holding.type} (${quantity} ${holding.unit})`,
            date: new Date(),
          },
        }),
        prisma.wallet.update({ where: { id: walletId }, data: { balance: { decrement: totalCostPaid } } }),
      ])
    }
  }

  return NextResponse.json(holding, { status: 201 })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { id, ...data } = body

  await prisma.commodityHolding.updateMany({
    where: { id, userId: session.user.id },
    data,
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  await prisma.commodityHolding.deleteMany({ where: { id, userId: session.user.id } })
  return NextResponse.json({ success: true })
}
