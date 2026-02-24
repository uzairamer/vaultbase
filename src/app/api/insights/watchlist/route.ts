import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const items = await prisma.watchlistItem.findMany({
    where: { userId: session.user.id },
    orderBy: { symbol: "asc" },
  })

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const symbol = (body.symbol as string)?.trim().toUpperCase()
  if (!symbol) return NextResponse.json({ error: "symbol is required" }, { status: 400 })

  const item = await prisma.watchlistItem.upsert({
    where: { userId_symbol: { userId: session.user.id, symbol } },
    update: {},
    create: { userId: session.user.id, symbol },
  })

  return NextResponse.json(item, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const symbol = req.nextUrl.searchParams.get("symbol")?.trim().toUpperCase()
  if (!symbol) return NextResponse.json({ error: "symbol is required" }, { status: 400 })

  await prisma.watchlistItem.deleteMany({
    where: { userId: session.user.id, symbol },
  })

  return NextResponse.json({ success: true })
}
