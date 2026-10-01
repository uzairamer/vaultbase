import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const closeSchema = z.object({
  walletId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  closingBalance: z.coerce.number(),
  note: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get("year")
  const month = searchParams.get("month")

  const closings = await prisma.walletMonthlyClosing.findMany({
    where: {
      userId: session.user.id,
      ...(year ? { year: parseInt(year) } : {}),
      ...(month ? { month: parseInt(month) } : {}),
    },
    include: { wallet: { select: { id: true, name: true, type: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }, { closedAt: "asc" }],
  })

  return NextResponse.json(closings)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = closeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { walletId, year, month, closingBalance, note } = parsed.data
  const userId = session.user.id

  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, userId },
    include: { segments: { where: { isDefault: true } } },
  })
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 })

  const existing = await prisma.walletMonthlyClosing.findUnique({
    where: { walletId_year_month: { walletId, year, month } },
  })
  if (existing) return NextResponse.json({ error: "This wallet is already closed for this month" }, { status: 400 })

  // Opening balance = current (live) balance minus everything logged within the target month,
  // so this works regardless of whether prior months were ever closed.
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)

  const txs = await prisma.transaction.findMany({
    where: { userId, walletId, archivedAt: null, date: { gte: monthStart, lte: monthEnd } },
  })

  let income = 0
  let transfersIn = 0
  let transfersOut = 0
  let trackedSpend = 0
  for (const t of txs) {
    const amt = Number(t.amount)
    if (t.type === "inflow") {
      if (t.subType === "transfer_in") transfersIn += amt
      else income += amt
    } else {
      if (t.subType === "transfer_out") transfersOut += amt
      else trackedSpend += amt
    }
  }

  const monthTxNet = txs.reduce((sum, t) => sum + (t.type === "inflow" ? Number(t.amount) : -Number(t.amount)), 0)
  const openingBalance = Number(wallet.balance) - monthTxNet

  // Known = what the balance should be if nothing beyond what's logged happened this month.
  const known = openingBalance + income + transfersIn - transfersOut - trackedSpend
  const residual = known - closingBalance

  // Bring the wallet's live balance in line with the verified closing figure, same mechanism
  // as the ad-hoc Reconcile feature, tagged the same way so it's excluded from cash-flow totals.
  const diff = closingBalance - Number(wallet.balance)
  const defaultSegment = wallet.segments[0] ?? null

  const ops = [
    prisma.walletMonthlyClosing.create({
      data: {
        userId,
        walletId,
        year,
        month,
        openingBalance,
        closingBalance,
        income,
        transfersIn,
        transfersOut,
        trackedSpend,
        residual,
        note: note?.trim() || undefined,
      },
      include: { wallet: { select: { id: true, name: true, type: true } } },
    }),
    ...(Math.abs(diff) >= 0.01
      ? [
          prisma.transaction.create({
            data: {
              userId,
              walletId,
              type: diff > 0 ? "inflow" : "outflow",
              subType: diff > 0 ? "other_inflow" : "other_outflow",
              amount: Math.abs(diff),
              description: note?.trim() || `Monthly closing adjustment — ${year}-${String(month).padStart(2, "0")}`,
              date: monthEnd,
              source: "reconciliation",
            },
          }),
          prisma.wallet.update({ where: { id: walletId }, data: { balance: closingBalance } }),
          ...(defaultSegment
            ? [prisma.walletSegment.update({ where: { id: defaultSegment.id }, data: { amount: { increment: diff } } })]
            : []),
        ]
      : []),
  ]

  const [closing] = await prisma.$transaction(ops)

  return NextResponse.json(closing, { status: 201 })
}
