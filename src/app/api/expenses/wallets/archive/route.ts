import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  walletId: z.string().min(1),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const wallet = await prisma.wallet.findFirst({
    where: { id: parsed.data.walletId, userId: session.user.id },
  })
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 })

  const archivedAt = new Date()

  const [{ count }] = await prisma.$transaction([
    prisma.transaction.updateMany({
      where: { walletId: wallet.id, userId: session.user.id, archivedAt: null },
      data: { archivedAt },
    }),
    prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: 0 },
    }),
    prisma.walletSegment.updateMany({
      where: { walletId: wallet.id, userId: session.user.id },
      data: { amount: 0 },
    }),
  ])

  return NextResponse.json({ archived: count, archivedAt })
}
