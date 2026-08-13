import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const sellAllSchema = z.object({
  amount: z.coerce.number().positive(),
  date: z.coerce.date(),
  walletId: z.string().min(1),
  segmentId: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = sellAllSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { amount, date, walletId, segmentId, notes } = parsed.data
  const userId = session.user.id

  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId } })
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 })

  const holdings = await prisma.stockHolding.findMany({
    where: { userId, archivedAt: null },
    include: { trades: { where: { type: "sell" } } },
  })

  const openLots = holdings
    .map((h) => ({
      id: h.id,
      symbol: h.symbol,
      availableQty: Number(h.quantity) - h.trades.reduce((sum, t) => sum + Number(t.quantity), 0),
      price: Number(h.currentPrice ?? h.avgBuyPrice),
    }))
    .filter((h) => h.availableQty > 0)

  if (openLots.length === 0) {
    return NextResponse.json({ error: "No open stock positions to sell" }, { status: 400 })
  }

  const symbols = Array.from(new Set(openLots.map((l) => l.symbol))).sort()

  const [transaction] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId,
        walletId,
        type: "inflow",
        subType: "stock_sale",
        amount,
        description: notes?.trim() || `Sold complete stock portfolio (${symbols.join(", ")})`,
        date,
        source: "manual",
      },
    }),
    prisma.wallet.update({ where: { id: walletId }, data: { balance: { increment: amount } } }),
    ...(segmentId
      ? [prisma.walletSegment.updateMany({ where: { id: segmentId, walletId, userId }, data: { amount: { increment: amount } } })]
      : []),
    ...openLots.map((lot) =>
      prisma.stockTrade.create({
        data: {
          holdingId: lot.id,
          type: "sell",
          quantity: lot.availableQty,
          price: lot.price,
          fee: 0,
          date,
          notes: "Full portfolio liquidation",
        },
      })
    ),
    ...openLots.map((lot) =>
      prisma.stockHolding.update({ where: { id: lot.id }, data: { archivedAt: new Date() } })
    ),
  ])

  return NextResponse.json({ transaction, soldLots: openLots.length, symbols }, { status: 201 })
}
