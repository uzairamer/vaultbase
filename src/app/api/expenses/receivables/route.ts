import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const receivableSchema = z.object({
  personName: z.string().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().default("PKR"),
  reason: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  givenDate: z.coerce.date(),
  notes: z.string().optional(),
})

const paymentSchema = z.object({
  receivableId: z.string().min(1),
  amount: z.coerce.number().positive(),
  date: z.coerce.date(),
  notes: z.string().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const receivables = await prisma.receivable.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { payments: { orderBy: { date: "desc" } } },
  })

  return NextResponse.json(receivables)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  // Check if this is a payment
  if (body.receivableId) {
    const parsed = paymentSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const receivable = await prisma.receivable.findFirst({
      where: { id: parsed.data.receivableId, userId: session.user.id },
    })
    if (!receivable) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const payment = await prisma.receivablePayment.create({ data: parsed.data })

    const newPaid = Number(receivable.amountPaid) + parsed.data.amount
    const status = newPaid >= Number(receivable.amount) ? "settled" : "partial"

    await prisma.receivable.update({
      where: { id: parsed.data.receivableId },
      data: { amountPaid: newPaid, status },
    })

    return NextResponse.json(payment, { status: 201 })
  }

  const parsed = receivableSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const receivable = await prisma.receivable.create({
    data: { ...parsed.data, userId: session.user.id },
  })

  return NextResponse.json(receivable, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  await prisma.receivable.deleteMany({ where: { id, userId: session.user.id } })

  return NextResponse.json({ success: true })
}
