import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const sideInvestmentSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  investedAmount: z.coerce.number().positive(),
  currentValue: z.coerce.number(),
  currency: z.string().default("PKR"),
  status: z.string().default("active"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  notes: z.string().optional(),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (id) {
    const inv = await prisma.sideInvestment.findFirst({
      where: { id, userId: session.user.id },
    })
    return NextResponse.json(inv)
  }

  const investments = await prisma.sideInvestment.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(investments)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = sideInvestmentSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const investment = await prisma.sideInvestment.create({
    data: { ...parsed.data, userId: session.user.id },
  })

  return NextResponse.json(investment, { status: 201 })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { id, ...data } = body

  await prisma.sideInvestment.updateMany({
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

  await prisma.sideInvestment.deleteMany({ where: { id, userId: session.user.id } })
  return NextResponse.json({ success: true })
}
