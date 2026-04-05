import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  walletId:      z.string().min(1),
  actualBalance: z.coerce.number(),
  note:          z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { walletId, actualBalance, note } = parsed.data

  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, userId: session.user.id },
    include: { segments: { where: { isDefault: true } } },
  })
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 })

  const diff = actualBalance - Number(wallet.balance)

  if (Math.abs(diff) < 0.01) {
    return NextResponse.json({ message: "Already balanced", diff: 0 })
  }

  const type    = diff > 0 ? "inflow"  : "outflow"
  const subType = diff > 0 ? "other_inflow" : "other_outflow"
  const amount  = Math.abs(diff)
  const description = note?.trim() || "Balance reconciliation"

  const defaultSegment = wallet.segments[0] ?? null

  // Atomic: create transaction + update wallet balance + update default segment
  const [transaction] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId:      session.user.id,
        walletId,
        type,
        subType,
        amount,
        description,
        date:        new Date(),
        source:      "reconciliation",
      },
    }),
    prisma.wallet.update({
      where: { id: walletId },
      data:  { balance: actualBalance },
    }),
    ...(defaultSegment
      ? [
          prisma.walletSegment.update({
            where: { id: defaultSegment.id },
            data:  { amount: { increment: diff } },
          }),
        ]
      : []),
  ])

  return NextResponse.json({ transaction, diff, type }, { status: 201 })
}
