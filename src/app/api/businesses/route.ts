import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const businessSchema = z.object({
  name: z.string().min(1),
  type: z.string().default("other"),
  currency: z.string().default("PKR"),
  startDate: z.coerce.date().optional(),
  description: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const businesses = await prisma.business.findMany({
    where: { userId: session.user.id, isArchived: false },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { entries: true, inventory: true } },
    },
  })

  return NextResponse.json(businesses)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = businessSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const business = await prisma.business.create({
    data: { ...parsed.data, userId: session.user.id },
  })

  return NextResponse.json(business, { status: 201 })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { id, ...data } = body

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const parsed = businessSchema.partial().safeParse(data)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const business = await prisma.business.updateMany({
    where: { id, userId: session.user.id },
    data: parsed.data,
  })

  return NextResponse.json(business)
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  // Verify ownership
  const business = await prisma.business.findFirst({
    where: { id, userId: session.user.id },
    include: { _count: { select: { entries: true } } },
  })
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 })

  // Block hard delete if there are ledger entries — caller should archive instead
  if (business._count.entries > 0) {
    return NextResponse.json(
      { error: "Cannot delete a business with ledger entries. Archive it instead." },
      { status: 400 }
    )
  }

  await prisma.business.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
