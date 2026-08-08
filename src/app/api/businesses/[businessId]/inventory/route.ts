import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const inventorySchema = z.object({
  name: z.string().min(1),
  quantity: z.coerce.number().int().min(0),
  purchasePrice: z.coerce.number().positive(),
  sellingPrice: z.coerce.number().positive().optional(),
  vendor: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  description: z.string().optional(),
  productCategory: z.string().optional(),
  productUrl: z.string().url().optional().or(z.literal("")),
  sku: z.string().optional(),
  lowStockThreshold: z.coerce.number().int().default(5),
})

async function verifyBusinessOwnership(businessId: string, userId: string) {
  return prisma.business.findFirst({ where: { id: businessId, userId } })
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { businessId } = await params

  const business = await verifyBusinessOwnership(businessId, session.user.id)
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")
  const category = searchParams.get("category")

  const where: Record<string, unknown> = { businessId, isArchived: false }
  if (search) where.name = { contains: search, mode: "insensitive" }
  if (category) where.productCategory = category

  const items = await prisma.inventoryItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(items)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { businessId } = await params

  const business = await verifyBusinessOwnership(businessId, session.user.id)
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 })

  const body = await req.json()
  const parsed = inventorySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const item = await prisma.inventoryItem.create({
    data: { ...parsed.data, businessId },
  })

  return NextResponse.json(item, { status: 201 })
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { businessId } = await params

  const business = await verifyBusinessOwnership(businessId, session.user.id)
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 })

  const body = await req.json()
  const { id, ...data } = body
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const parsed = inventorySchema.partial().safeParse(data)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existing = await prisma.inventoryItem.findFirst({ where: { id, businessId } })
  if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 })

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json(item)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { businessId } = await params

  const business = await verifyBusinessOwnership(businessId, session.user.id)
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const item = await prisma.inventoryItem.findFirst({
    where: { id, businessId },
    include: { _count: { select: { ledgerEntries: true } } },
  })
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })

  if (item._count.ledgerEntries > 0) {
    return NextResponse.json(
      { error: "Archive this product instead — it has linked sales history." },
      { status: 400 }
    )
  }

  await prisma.inventoryItem.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
