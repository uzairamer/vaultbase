import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const entrySchema = z.object({
  type: z.enum(["income", "expense"]),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  amount: z.coerce.number().positive(),
  date: z.coerce.date(),
  description: z.string().optional(),
  paymentMethod: z.string().optional(),
  linkedInventoryId: z.string().optional(),
  linkedProductQuantity: z.coerce.number().int().positive().optional(),
  cogsAtTimeOfSale: z.coerce.number().nonnegative().optional(),
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
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const type = searchParams.get("type")
  const category = searchParams.get("category")

  const where: Record<string, unknown> = { businessId }
  if (type) where.type = type
  if (category) where.category = category
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    }
  }

  const entries = await prisma.ledgerEntry.findMany({
    where,
    orderBy: { date: "desc" },
    include: { linkedInventory: true },
  })

  return NextResponse.json(entries)
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
  const parsed = entrySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { linkedInventoryId, linkedProductQuantity, cogsAtTimeOfSale: _cogs, ...entryData } = parsed.data

  // ── Inventory-linked sale ────────────────────────────────────────────────────
  if (linkedInventoryId) {
    if (!linkedProductQuantity) {
      return NextResponse.json(
        { error: "linkedProductQuantity is required when linkedInventoryId is set" },
        { status: 400 }
      )
    }

    const item = await prisma.inventoryItem.findFirst({
      where: { id: linkedInventoryId, businessId },
    })
    if (!item) {
      return NextResponse.json(
        { error: "Inventory item not found in this business" },
        { status: 404 }
      )
    }
    if (item.quantity < linkedProductQuantity) {
      return NextResponse.json(
        { error: `Insufficient stock. Available: ${item.quantity}, requested: ${linkedProductQuantity}` },
        { status: 400 }
      )
    }

    const computedCogs = linkedProductQuantity * Number(item.purchasePrice)

    const [entry] = await prisma.$transaction([
      prisma.ledgerEntry.create({
        data: {
          ...entryData,
          businessId,
          linkedInventoryId,
          linkedProductQuantity,
          cogsAtTimeOfSale: computedCogs,
        },
      }),
      prisma.inventoryItem.update({
        where: { id: linkedInventoryId },
        data: { quantity: { decrement: linkedProductQuantity } },
      }),
    ])

    return NextResponse.json(entry, { status: 201 })
  }

  // ── Plain entry ──────────────────────────────────────────────────────────────
  const entry = await prisma.ledgerEntry.create({
    data: { ...entryData, businessId },
  })

  return NextResponse.json(entry, { status: 201 })
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

  const parsed = entrySchema.partial().safeParse(data)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Fetch the current entry to check for inventory adjustments
  const existing = await prisma.ledgerEntry.findFirst({
    where: { id, businessId },
  })
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

  const newLinkedInventoryId = parsed.data.linkedInventoryId ?? existing.linkedInventoryId
  const newQty = parsed.data.linkedProductQuantity ?? existing.linkedProductQuantity ?? 0
  const oldQty = existing.linkedProductQuantity ?? 0

  // ── Inventory quantity reconciliation ────────────────────────────────────────
  if (existing.linkedInventoryId && newLinkedInventoryId === existing.linkedInventoryId && newQty !== oldQty) {
    // Same item, quantity changed — restore old qty then deduct new qty (net: restore diff)
    const qtyDelta = oldQty - newQty // positive = net restore, negative = net deduct

    const item = await prisma.inventoryItem.findFirst({
      where: { id: existing.linkedInventoryId, businessId },
    })
    if (!item) return NextResponse.json({ error: "Linked inventory item not found" }, { status: 404 })

    if (qtyDelta < 0 && item.quantity < Math.abs(qtyDelta)) {
      return NextResponse.json(
        { error: `Insufficient stock for quantity increase. Available: ${item.quantity}` },
        { status: 400 }
      )
    }

    const computedCogs = newQty * Number(item.purchasePrice)

    const [entry] = await prisma.$transaction([
      prisma.ledgerEntry.update({
        where: { id },
        data: { ...parsed.data, cogsAtTimeOfSale: computedCogs },
      }),
      prisma.inventoryItem.update({
        where: { id: existing.linkedInventoryId },
        data: { quantity: { increment: qtyDelta } },
      }),
    ])

    return NextResponse.json(entry)
  }

  const entry = await prisma.ledgerEntry.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json(entry)
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

  const entry = await prisma.ledgerEntry.findFirst({
    where: { id, businessId },
  })
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

  // ── Restore inventory quantity if this was a sale ────────────────────────────
  if (entry.linkedInventoryId && entry.linkedProductQuantity) {
    await prisma.$transaction([
      prisma.ledgerEntry.delete({ where: { id } }),
      prisma.inventoryItem.update({
        where: { id: entry.linkedInventoryId },
        data: { quantity: { increment: entry.linkedProductQuantity } },
      }),
    ])
  } else {
    await prisma.ledgerEntry.delete({ where: { id } })
  }

  return NextResponse.json({ success: true })
}
