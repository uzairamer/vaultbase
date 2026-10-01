import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const deleteSchema = z.object({
  confirmEmail: z.string().min(1),
})

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Missing confirmation" }, { status: 400 })

  if (parsed.data.confirmEmail.trim().toLowerCase() !== session.user.email.toLowerCase()) {
    return NextResponse.json({ error: "Email confirmation does not match your account" }, { status: 400 })
  }

  // Every table in the schema cascades from User (onDelete: Cascade), so this single
  // delete wipes wallets, transactions, receivables/liabilities, stocks, commodities,
  // real estate, businesses, income breakdown, watchlist, static prices, and auth records.
  await prisma.user.delete({ where: { id: session.user.id } })

  return NextResponse.json({ success: true })
}
