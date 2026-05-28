import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const rowSchema = z.object({
  type: z.enum(["regular", "balloon", "downpayment"]),
  amount: z.coerce.number().nonnegative(),
  dueDate: z.coerce.date(),
  status: z.enum(["pending", "paid", "unpaid"]).default("pending"),
  paidDate: z.coerce.date().optional().nullable(),
  receiptNote: z.string().optional().nullable(),
})

const schema = z.object({
  propertyId: z.string().min(1),
  rows: z.array(rowSchema).min(1),
})

// Atomically replace the entire installment ledger and lock it.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { propertyId, rows } = parsed.data

  const property = await prisma.property.findFirst({
    where: { id: propertyId, userId: session.user.id },
  })
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 })

  await prisma.$transaction([
    prisma.installment.deleteMany({ where: { propertyId } }),
    prisma.installment.createMany({
      data: rows.map((r) => ({
        propertyId,
        type: r.type,
        amount: r.amount,
        dueDate: r.dueDate,
        status: r.status,
        paidDate: r.paidDate ?? null,
        receiptNote: r.receiptNote ?? null,
      })),
    }),
    prisma.property.update({
      where: { id: propertyId },
      data: { ledgerLocked: true },
    }),
  ])

  return NextResponse.json({ saved: rows.length })
}

// Unlock the ledger (called before regenerating from schedule).
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get("propertyId")
  if (!propertyId) return NextResponse.json({ error: "Missing propertyId" }, { status: 400 })

  await prisma.property.updateMany({
    where: { id: propertyId, userId: session.user.id },
    data: { ledgerLocked: false },
  })

  return NextResponse.json({ unlocked: true })
}
