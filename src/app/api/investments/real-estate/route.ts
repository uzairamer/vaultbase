import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const propertySchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
  totalPrice: z.coerce.number().positive(),
  downPayment: z.coerce.number().default(0),
  monthlyInstallment: z.coerce.number().nonnegative().optional().nullable(),
  balloonAmount: z.coerce.number().nonnegative().optional().nullable(),
  balloonEveryNMonths: z.coerce.number().int().positive().optional().nullable(),
  installmentStartDate: z.coerce.date().optional().nullable(),
  installmentDueDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  installmentMonths: z.coerce.number().int().positive().optional().nullable(),
  currentValue: z.coerce.number().optional(),
  status: z.string().default("active"),
  purchaseDate: z.coerce.date(),
  notes: z.string().optional(),
})

const installmentSchema = z.object({
  propertyId: z.string().min(1),
  type: z.enum(["regular", "balloon"]).default("regular"),
  amount: z.coerce.number().positive(),
  dueDate: z.coerce.date(),
  paidDate: z.coerce.date().optional(),
  status: z.string().default("pending"),
  receiptNote: z.string().optional(),
})

// Build the installment ledger from property params.
// Returns rows ready for prisma.installment.createMany (minus propertyId).
// Uses UTC math so dates are stable regardless of server timezone.
export function buildLedger(opts: {
  startDate: Date
  dueDay: number
  months: number
  monthlyAmount: number
  balloonAmount?: number | null
  balloonEveryN?: number | null
}) {
  const rows: Array<{ type: string; amount: number; dueDate: Date }> = []
  const start = new Date(opts.startDate)
  const startY = start.getUTCFullYear()
  const startM = start.getUTCMonth()
  const n = opts.balloonEveryN ?? 0

  for (let i = 0; i < opts.months; i++) {
    const totalMonths = startM + i
    const targetY = startY + Math.floor(totalMonths / 12)
    const targetM = ((totalMonths % 12) + 12) % 12
    // Last day of target month: day 0 of next month
    const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate()
    const day = Math.min(opts.dueDay, lastDay)
    const d = new Date(Date.UTC(targetY, targetM, day))

    const isBalloonMonth = n > 0 && !!opts.balloonAmount && opts.balloonAmount > 0 && (i + 1) % n === 0
    if (isBalloonMonth) {
      rows.push({ type: "balloon", amount: opts.balloonAmount!, dueDate: d })
    } else if (opts.monthlyAmount > 0) {
      rows.push({ type: "regular", amount: opts.monthlyAmount, dueDate: d })
    }
  }
  return rows
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (id) {
    const property = await prisma.property.findFirst({
      where: { id, userId: session.user.id },
      include: { installments: { orderBy: [{ dueDate: "asc" }, { type: "asc" }] } },
    })
    if (property) {
      // Push downpayment-type entries to the front (regardless of dueDate)
      const sortedInstallments = [
        ...property.installments.filter((i) => i.type === "downpayment"),
        ...property.installments.filter((i) => i.type !== "downpayment"),
      ]
      return NextResponse.json({ ...property, installments: sortedInstallments })
    }
    return NextResponse.json(property)
  }

  const properties = await prisma.property.findMany({
    where: { userId: session.user.id, archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: { installments: true },
  })

  return NextResponse.json(properties)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  // Check if it's an installment
  if (body.propertyId) {
    const parsed = installmentSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const property = await prisma.property.findFirst({
      where: { id: parsed.data.propertyId, userId: session.user.id },
    })
    if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 })

    const installment = await prisma.installment.create({ data: parsed.data })
    return NextResponse.json(installment, { status: 201 })
  }

  const parsed = propertySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const property = await prisma.property.create({
    data: { ...parsed.data, userId: session.user.id },
  })

  // If installment schedule was provided, auto-generate ledger
  const d = parsed.data
  if (d.installmentStartDate && d.installmentDueDay && d.installmentMonths && d.monthlyInstallment) {
    const rows: Array<{ type: string; amount: number; dueDate: Date; status?: string; paidDate?: Date }> = []

    // Down payment ledger entry on the purchase date (auto-marked paid)
    if (d.downPayment && d.downPayment > 0) {
      rows.push({
        type: "downpayment",
        amount: d.downPayment,
        dueDate: d.purchaseDate,
        status: "paid",
        paidDate: d.purchaseDate,
      })
    }

    rows.push(...buildLedger({
      startDate: d.installmentStartDate,
      dueDay: d.installmentDueDay,
      months: d.installmentMonths,
      monthlyAmount: d.monthlyInstallment,
      balloonAmount: d.balloonAmount,
      balloonEveryN: d.balloonEveryNMonths,
    }))

    if (rows.length > 0) {
      await prisma.installment.createMany({
        data: rows.map((r) => ({ ...r, propertyId: property.id })),
      })
    }
  }

  return NextResponse.json(property, { status: 201 })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  // Update installment status
  if (body.installmentId) {
    // Verify ownership via the property
    const inst = await prisma.installment.findFirst({
      where: { id: body.installmentId, property: { userId: session.user.id } },
    })
    if (!inst) return NextResponse.json({ error: "Installment not found" }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (body.status) data.status = body.status
    if (body.status === "paid") {
      data.paidDate = body.paidDate ? new Date(body.paidDate) : inst.dueDate
    } else if (body.status === "unpaid" || body.status === "pending") {
      data.paidDate = null
    }
    if (body.receiptNote !== undefined) data.receiptNote = body.receiptNote
    if (body.amount !== undefined) {
      const n = Number(body.amount)
      if (!isFinite(n) || n < 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
      data.amount = n
    }
    if (body.dueDate) data.dueDate = new Date(body.dueDate)

    await prisma.installment.update({ where: { id: body.installmentId }, data })
    return NextResponse.json({ success: true })
  }

  const { id, ...data } = body
  await prisma.property.updateMany({
    where: { id, userId: session.user.id },
    data,
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  await prisma.property.deleteMany({ where: { id, userId: session.user.id } })
  return NextResponse.json({ success: true })
}
