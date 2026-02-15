import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const transactionSchema = z.object({
  walletId: z.string().min(1),
  categoryId: z.string().optional(),
  type: z.enum(["inflow", "outflow"]),
  subType: z.string().optional(),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
  date: z.coerce.date(),
  source: z.string().default("manual"),
  // Extra fields for auto-linking
  personName: z.string().optional(),     // for lending → auto-create receivable, debt_repayment → auto-update liability
  receivableId: z.string().optional(),   // for receivable_collection → auto-update receivable
  liabilityId: z.string().optional(),    // for debt_repayment → auto-update liability
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const walletId = searchParams.get("walletId")
  const type = searchParams.get("type")
  const subType = searchParams.get("subType")
  const categoryId = searchParams.get("categoryId")

  const where: Record<string, unknown> = { userId: session.user.id }
  if (walletId) where.walletId = walletId
  if (type) where.type = type
  if (subType) where.subType = subType
  if (categoryId) where.categoryId = categoryId

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: "desc" },
    include: { wallet: true, category: true },
  })

  return NextResponse.json(transactions)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = transactionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Verify wallet belongs to user
  const wallet = await prisma.wallet.findFirst({
    where: { id: parsed.data.walletId, userId: session.user.id },
  })
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 })

  // Strip extra fields not in the Transaction model
  const { personName, receivableId, liabilityId, ...txData } = parsed.data

  const transaction = await prisma.transaction.create({
    data: { ...txData, userId: session.user.id },
  })

  // Update wallet balance: inflow adds, outflow subtracts
  const balanceChange = parsed.data.type === "inflow" ? parsed.data.amount : -parsed.data.amount
  await prisma.wallet.update({
    where: { id: parsed.data.walletId },
    data: { balance: { increment: balanceChange } },
  })

  // Auto-create receivable when lending money
  if (parsed.data.subType === "lending" && personName) {
    await prisma.receivable.create({
      data: {
        userId: session.user.id,
        personName,
        amount: parsed.data.amount,
        givenDate: parsed.data.date,
        reason: parsed.data.description || undefined,
      },
    })
  }

  // Auto-update receivable when collecting payment
  if (parsed.data.subType === "receivable_collection" && receivableId) {
    const receivable = await prisma.receivable.findFirst({
      where: { id: receivableId, userId: session.user.id },
    })
    if (receivable) {
      const newPaid = Number(receivable.amountPaid) + parsed.data.amount
      const status = newPaid >= Number(receivable.amount) ? "settled" : "partial"
      await prisma.receivable.update({
        where: { id: receivableId },
        data: { amountPaid: newPaid, status },
      })
      await prisma.receivablePayment.create({
        data: { receivableId, amount: parsed.data.amount, date: parsed.data.date },
      })
    }
  }

  // Auto-update liability when repaying debt
  if (parsed.data.subType === "debt_repayment" && liabilityId) {
    const liability = await prisma.liability.findFirst({
      where: { id: liabilityId, userId: session.user.id },
    })
    if (liability) {
      const newPaid = Number(liability.amountPaid) + parsed.data.amount
      const status = newPaid >= Number(liability.amount) ? "settled" : "partial"
      await prisma.liability.update({
        where: { id: liabilityId },
        data: { amountPaid: newPaid, status },
      })
      await prisma.liabilityPayment.create({
        data: { liabilityId, amount: parsed.data.amount, date: parsed.data.date },
      })
    }
  }

  return NextResponse.json(transaction, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Reverse balance change
  const reversal = transaction.type === "inflow" ? -Number(transaction.amount) : Number(transaction.amount)
  await prisma.wallet.update({
    where: { id: transaction.walletId },
    data: { balance: { increment: reversal } },
  })

  await prisma.transaction.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
