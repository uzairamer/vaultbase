import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const holdingSchema = z.object({
  type: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.coerce.number().positive(),
  avgBuyPrice: z.coerce.number().positive(),
  currentPrice: z.coerce.number().optional(),
  currency: z.string().default("PKR"),
})

const tradeSchema = z.object({
  holdingId: z.string().min(1),
  type: z.string().min(1),
  quantity: z.coerce.number().positive(),
  price: z.coerce.number().positive(),
  date: z.coerce.date(),
  notes: z.string().optional(),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (id) {
    const holding = await prisma.commodityHolding.findFirst({
      where: { id, userId: session.user.id },
      include: { trades: { orderBy: { date: "desc" } } },
    })
    return NextResponse.json(holding)
  }

  const holdings = await prisma.commodityHolding.findMany({
    where: { userId: session.user.id, archivedAt: null },
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

    const holding = await prisma.commodityHolding.findFirst({
      where: { id: parsed.data.holdingId, userId: session.user.id },
    })
    if (!holding) return NextResponse.json({ error: "Holding not found" }, { status: 404 })

    const trade = await prisma.commodityTrade.create({ data: parsed.data })

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

    return NextResponse.json(trade, { status: 201 })
  }

  const parsed = holdingSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const holding = await prisma.commodityHolding.create({
    data: { ...parsed.data, userId: session.user.id },
  })

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
