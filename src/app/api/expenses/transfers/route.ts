import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const transferSchema = z.object({
  fromWalletId: z.string().min(1),
  toWalletId: z.string().min(1),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
  date: z.coerce.date(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = transferSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { fromWalletId, toWalletId, amount, description, date } = parsed.data

  if (fromWalletId === toWalletId)
    return NextResponse.json({ error: "Source and destination wallets must be different" }, { status: 400 })

  // Verify both wallets belong to the user
  const [fromWallet, toWallet] = await Promise.all([
    prisma.wallet.findFirst({ where: { id: fromWalletId, userId: session.user.id } }),
    prisma.wallet.findFirst({ where: { id: toWalletId, userId: session.user.id } }),
  ])
  if (!fromWallet) return NextResponse.json({ error: "Source wallet not found" }, { status: 404 })
  if (!toWallet) return NextResponse.json({ error: "Destination wallet not found" }, { status: 404 })

  const [outTx, inTx] = await prisma.$transaction([
    // Outflow from source
    prisma.transaction.create({
      data: {
        userId: session.user.id,
        walletId: fromWalletId,
        type: "outflow",
        subType: "transfer_out",
        amount,
        description: description || `Transfer to ${toWallet.name}`,
        date,
      },
    }),
    // Inflow to destination
    prisma.transaction.create({
      data: {
        userId: session.user.id,
        walletId: toWalletId,
        type: "inflow",
        subType: "transfer_in",
        amount,
        description: description || `Transfer from ${fromWallet.name}`,
        date,
      },
    }),
    // Debit source
    prisma.wallet.update({
      where: { id: fromWalletId },
      data: { balance: { decrement: amount } },
    }),
    // Credit destination
    prisma.wallet.update({
      where: { id: toWalletId },
      data: { balance: { increment: amount } },
    }),
  ])

  return NextResponse.json({ outTx, inTx }, { status: 201 })
}
