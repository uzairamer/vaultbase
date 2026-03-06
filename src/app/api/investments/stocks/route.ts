import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const holdingSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  quantity: z.coerce.number().positive(),
  avgBuyPrice: z.coerce.number().positive(),
  currentPrice: z.coerce.number().optional(),
  purchaseDate: z.coerce.date().optional(),
  currency: z.string().default("PKR"),
  walletId: z.string().optional(),
  segmentId: z.string().optional(),
})

const tradeSchema = z.object({
  holdingId: z.string().min(1),
  type: z.string().min(1),
  quantity: z.coerce.number().positive(),
  price: z.coerce.number().positive(),
  fee: z.coerce.number().default(0),
  date: z.coerce.date(),
  notes: z.string().optional(),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (id) {
    const holding = await prisma.stockHolding.findFirst({
      where: { id, userId: session.user.id },
      include: { trades: { orderBy: { date: "desc" } } },
    })
    return NextResponse.json(holding)
  }

  const holdings = await prisma.stockHolding.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { trades: { orderBy: { date: "desc" } } },
  })

  return NextResponse.json(holdings)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  if (body.holdingId) {
    const parsed = tradeSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const holding = await prisma.stockHolding.findFirst({
      where: { id: parsed.data.holdingId, userId: session.user.id },
    })
    if (!holding) return NextResponse.json({ error: "Holding not found" }, { status: 404 })

    const trade = await prisma.stockTrade.create({ data: parsed.data })

    // Recalculate average price and quantity
    const allTrades = await prisma.stockTrade.findMany({ where: { holdingId: parsed.data.holdingId } })
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
    await prisma.stockHolding.update({
      where: { id: parsed.data.holdingId },
      data: {
        quantity: Math.max(0, totalQty),
        avgBuyPrice: totalQty > 0 ? totalCost / totalQty : Number(holding.avgBuyPrice),
      },
    })

    return NextResponse.json(trade, { status: 201 })
  }

  const parsed = holdingSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { walletId, segmentId, ...holdingData } = parsed.data

  if (walletId) {
    const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId: session.user.id } })
    if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 })
  }

  const holding = await prisma.stockHolding.create({
    data: { ...holdingData, userId: session.user.id },
  })

  if (walletId) {
    const cost = holdingData.quantity * holdingData.avgBuyPrice
    const purchaseDate = holdingData.purchaseDate ?? new Date()

    await prisma.transaction.create({
      data: {
        userId: session.user.id,
        walletId,
        type: "outflow",
        subType: "stock_purchase",
        amount: cost,
        description: `Bought ${holdingData.quantity} × ${holdingData.symbol} @ PKR ${holdingData.avgBuyPrice}`,
        date: purchaseDate,
        source: "manual",
      },
    })

    await prisma.wallet.update({
      where: { id: walletId },
      data: { balance: { decrement: cost } },
    })

    if (segmentId) {
      await prisma.walletSegment.updateMany({
        where: { id: segmentId, walletId, userId: session.user.id },
        data: { amount: { decrement: cost } },
      })
    }
  }

  return NextResponse.json(holding, { status: 201 })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { id, ...data } = body

  await prisma.stockHolding.updateMany({
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

  await prisma.stockHolding.deleteMany({ where: { id, userId: session.user.id } })
  return NextResponse.json({ success: true })
}
