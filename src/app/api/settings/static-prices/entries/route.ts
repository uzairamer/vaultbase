import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const createSchema = z.object({
  staticPriceId: z.string().min(1),
  pricePerTola: z.coerce.number().positive(),
  date: z.coerce.date(),
  note: z.string().optional(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Verify ownership
  const sp = await prisma.staticPrice.findFirst({
    where: { id: parsed.data.staticPriceId, userId: session.user.id },
  })
  if (!sp) return NextResponse.json({ error: "Static price not found" }, { status: 404 })

  const entry = await prisma.staticPriceEntry.create({ data: parsed.data })
  return NextResponse.json(entry, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  // Verify ownership via join
  const entry = await prisma.staticPriceEntry.findFirst({
    where: { id, staticPrice: { userId: session.user.id } },
  })
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

  await prisma.staticPriceEntry.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
