import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  prices: z.array(z.object({
    symbol: z.string(),
    price: z.coerce.number().positive(),
  })),
})

// Called by the client after fetching live prices — persists them to DB
// so server-side pages (investments overview, financial position) stay accurate.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const userId = session.user.id
  const updates = await Promise.all(
    parsed.data.prices.map(({ symbol, price }) =>
      prisma.stockHolding.updateMany({
        where: { userId, symbol, archivedAt: null },
        data: { currentPrice: price },
      })
    )
  )

  return NextResponse.json({ synced: updates.reduce((sum, u) => sum + u.count, 0) })
}
