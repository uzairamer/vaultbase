import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const importRowSchema = z.object({
  date: z.coerce.date(),
  amount: z.coerce.number(),
  type: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
})

const importSchema = z.object({
  walletId: z.string().min(1),
  rows: z.array(importRowSchema),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = importSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const wallet = await prisma.wallet.findFirst({
    where: { id: parsed.data.walletId, userId: session.user.id },
  })
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 })

  let balanceChange = 0
  const transactions = []

  for (const row of parsed.data.rows) {
    let categoryId: string | undefined
    if (row.category) {
      const cat = await prisma.category.findFirst({
        where: { userId: session.user.id, name: row.category },
      })
      if (cat) categoryId = cat.id
    }

    transactions.push({
      userId: session.user.id,
      walletId: parsed.data.walletId,
      categoryId: categoryId || null,
      type: row.type,
      amount: Math.abs(row.amount),
      description: row.description || null,
      date: row.date,
      source: "csv_import",
    })

    balanceChange += row.type === "inflow" ? Math.abs(row.amount) : -Math.abs(row.amount)
  }

  await prisma.transaction.createMany({ data: transactions })
  await prisma.wallet.update({
    where: { id: parsed.data.walletId },
    data: { balance: { increment: balanceChange } },
  })

  return NextResponse.json({ imported: transactions.length }, { status: 201 })
}
