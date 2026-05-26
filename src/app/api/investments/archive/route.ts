import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  type: z.enum(["stocks", "commodities", "realestate"]),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const userId = session.user.id
  const archivedAt = new Date()

  let count = 0
  if (parsed.data.type === "stocks") {
    const res = await prisma.stockHolding.updateMany({
      where: { userId, archivedAt: null },
      data: { archivedAt },
    })
    count = res.count
  } else if (parsed.data.type === "commodities") {
    const res = await prisma.commodityHolding.updateMany({
      where: { userId, archivedAt: null },
      data: { archivedAt },
    })
    count = res.count
  } else {
    const res = await prisma.property.updateMany({
      where: { userId, archivedAt: null },
      data: { archivedAt },
    })
    count = res.count
  }

  return NextResponse.json({ archived: count, archivedAt })
}
