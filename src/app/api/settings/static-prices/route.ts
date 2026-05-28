import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

// ── Series CRUD ───────────────────────────────────────────────────────────────

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const prices = await prisma.staticPrice.findMany({
    where: { userId: session.user.id },
    include: { entries: { orderBy: { date: "desc" } } },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(prices)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = z.object({ name: z.string().min(1).max(50) }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existing = await prisma.staticPrice.findFirst({
    where: { userId: session.user.id, name: parsed.data.name },
  })
  if (existing) return NextResponse.json({ error: "A static price with that name already exists" }, { status: 400 })

  const price = await prisma.staticPrice.create({
    data: { userId: session.user.id, name: parsed.data.name },
    include: { entries: true },
  })

  return NextResponse.json(price, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  await prisma.staticPrice.deleteMany({ where: { id, userId: session.user.id } })
  return NextResponse.json({ success: true })
}
