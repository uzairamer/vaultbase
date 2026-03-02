import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const sellSchema = z.object({
  symbol: z.string().min(1),
  quantity: z.coerce.number().positive(),
  price: z.coerce.number().positive(),
  fee: z.coerce.number().min(0).default(0),
  date: z.coerce.date(),
  walletId: z.string().min(1),
  segmentId: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = sellSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { symbol, quantity, price, fee, date, walletId, segmentId, notes } = parsed.data
  const userId = session.user.id

  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId } })
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 })

  // Fetch all lots for this symbol (oldest first — FIFO), including their existing sell trades
  const holdings = await prisma.stockHolding.findMany({
    where: { userId, symbol },
    include: { trades: { where: { type: "sell" } } },
    orderBy: { createdAt: "asc" },
  })

  // Compute available qty per lot: original buy qty minus already-sold qty
  const lotsWithAvail = holdings
    .map((h) => ({
      id: h.id,
      availableQty:
        Number(h.quantity) -
        h.trades.reduce((sum, t) => sum + Number(t.quantity), 0),
    }))
    .filter((h) => h.availableQty > 0)

  const totalAvailable = lotsWithAvail.reduce((sum, h) => sum + h.availableQty, 0)
  if (quantity > totalAvailable) {
    return NextResponse.json(
      { error: `Insufficient holdings. Available: ${totalAvailable.toFixed(4)}` },
      { status: 400 }
    )
  }

  // FIFO: create sell trade records — do NOT modify holding quantities
  let remaining = quantity
  for (const lot of lotsWithAvail) {
    if (remaining <= 0) break
    const sellFromLot = Math.min(remaining, lot.availableQty)
    await prisma.stockTrade.create({
      data: {
        holdingId: lot.id,
        type: "sell",
        quantity: sellFromLot,
        price,
        fee: 0,
        date,
        notes: notes || undefined,
      },
    })
    remaining -= sellFromLot
  }

  // Record inflow transaction: net proceeds = qty × price − fee
  const proceeds = quantity * price - fee
  const transaction = await prisma.transaction.create({
    data: {
      userId,
      walletId,
      type: "inflow",
      subType: "stock_sale",
      amount: proceeds,
      description: `Sold ${quantity} × ${symbol} @ PKR ${price}${fee > 0 ? ` (fee: ${fee})` : ""}`,
      date,
      source: "manual",
    },
  })

  await prisma.wallet.update({
    where: { id: walletId },
    data: { balance: { increment: proceeds } },
  })

  if (segmentId) {
    await prisma.walletSegment.updateMany({
      where: { id: segmentId, walletId, userId },
      data: { amount: { increment: proceeds } },
    })
  }

  return NextResponse.json({ transaction }, { status: 201 })
}
