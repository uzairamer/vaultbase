import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const liabilitySchema = z.object({
  personName: z.string().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().default("PKR"),
  reason: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  takenDate: z.coerce.date(),
  notes: z.string().optional(),
})

const paymentSchema = z.object({
  liabilityId: z.string().min(1),
  amount: z.coerce.number().positive(),
  date: z.coerce.date(),
  notes: z.string().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const liabilities = await prisma.liability.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { payments: { orderBy: { date: "desc" } } },
  })

  return NextResponse.json(liabilities)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  if (body.liabilityId) {
    const parsed = paymentSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const liability = await prisma.liability.findFirst({
      where: { id: parsed.data.liabilityId, userId: session.user.id },
    })
    if (!liability) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const payment = await prisma.liabilityPayment.create({ data: parsed.data })

    const newPaid = Number(liability.amountPaid) + parsed.data.amount
    const status = newPaid >= Number(liability.amount) ? "settled" : "partial"

    await prisma.liability.update({
      where: { id: parsed.data.liabilityId },
      data: { amountPaid: newPaid, status },
    })

    return NextResponse.json(payment, { status: 201 })
  }

  const parsed = liabilitySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const liability = await prisma.liability.create({
    data: { ...parsed.data, userId: session.user.id },
  })

  return NextResponse.json(liability, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  await prisma.liability.deleteMany({ where: { id, userId: session.user.id } })

  return NextResponse.json({ success: true })
}
