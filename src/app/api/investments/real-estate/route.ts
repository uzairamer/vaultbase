import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const propertySchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
  totalPrice: z.coerce.number().positive(),
  downPayment: z.coerce.number().default(0),
  currentValue: z.coerce.number().optional(),
  status: z.string().default("active"),
  purchaseDate: z.coerce.date(),
  notes: z.string().optional(),
})

const installmentSchema = z.object({
  propertyId: z.string().min(1),
  amount: z.coerce.number().positive(),
  dueDate: z.coerce.date(),
  paidDate: z.coerce.date().optional(),
  status: z.string().default("pending"),
  receiptNote: z.string().optional(),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (id) {
    const property = await prisma.property.findFirst({
      where: { id, userId: session.user.id },
      include: { installments: { orderBy: { dueDate: "asc" } } },
    })
    return NextResponse.json(property)
  }

  const properties = await prisma.property.findMany({
    where: { userId: session.user.id },
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

  return NextResponse.json(property, { status: 201 })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  // Update installment status
  if (body.installmentId) {
    await prisma.installment.update({
      where: { id: body.installmentId },
      data: { status: body.status, paidDate: body.paidDate ? new Date(body.paidDate) : undefined },
    })
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
