import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"
import { buildLedger } from "../route"

const schema = z.object({
  propertyId: z.string().min(1),
  // Optional: update the property's installment config in the same call
  downPayment: z.coerce.number().nonnegative().optional(),
  purchaseDate: z.coerce.date().optional(),
  monthlyInstallment: z.coerce.number().nonnegative().optional().nullable(),
  balloonAmount: z.coerce.number().nonnegative().optional().nullable(),
  balloonEveryNMonths: z.coerce.number().int().positive().optional().nullable(),
  installmentStartDate: z.coerce.date().optional().nullable(),
  installmentDueDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  installmentMonths: z.coerce.number().int().positive().optional().nullable(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { propertyId, ...updates } = parsed.data

  // Verify ownership
  const existing = await prisma.property.findFirst({
    where: { id: propertyId, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: "Property not found" }, { status: 404 })

  // Apply any config updates first
  const updateData: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) updateData[k] = v
  }
  if (Object.keys(updateData).length > 0) {
    await prisma.property.update({ where: { id: propertyId }, data: updateData })
  }

  // Read final state
  const p = await prisma.property.findUnique({ where: { id: propertyId } })
  if (!p) return NextResponse.json({ error: "Property not found" }, { status: 404 })

  // Wipe ALL existing installments — this is a destructive regenerate
  await prisma.installment.deleteMany({ where: { propertyId } })

  // Build new ledger
  const rows: Array<{ type: string; amount: number; dueDate: Date; status?: string; paidDate?: Date }> = []

  if (Number(p.downPayment) > 0) {
    rows.push({
      type: "downpayment",
      amount: Number(p.downPayment),
      dueDate: p.purchaseDate,
      status: "paid",
      paidDate: p.purchaseDate,
    })
  }

  if (p.installmentStartDate && p.installmentDueDay && p.installmentMonths && p.monthlyInstallment) {
    rows.push(...buildLedger({
      startDate: p.installmentStartDate,
      dueDay: p.installmentDueDay,
      months: p.installmentMonths,
      monthlyAmount: Number(p.monthlyInstallment),
      balloonAmount: p.balloonAmount ? Number(p.balloonAmount) : null,
      balloonEveryN: p.balloonEveryNMonths,
    }))
  }

  if (rows.length > 0) {
    await prisma.installment.createMany({
      data: rows.map((r) => ({ ...r, propertyId })),
    })
  }

  return NextResponse.json({ generated: rows.length })
}
