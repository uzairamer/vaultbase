import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "annually"] as const

const schema = z.object({
  name:        z.string().min(1),
  amount:      z.coerce.number().nonnegative(),
  currency:    z.string().default("PKR"),
  color:       z.string().default("#6366f1"),
  frequency:   z.enum(FREQUENCIES).default("monthly"),
  description: z.string().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sources = await prisma.incomeSource.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      breakdown: {
        where: { parentId: null },
        orderBy: { createdAt: "asc" },
        include: {
          children: {
            orderBy: { createdAt: "asc" },
            include: {
              children: {
                orderBy: { createdAt: "asc" },
                include: { children: { orderBy: { createdAt: "asc" } } },
              },
            },
          },
        },
      },
    },
  })

  return NextResponse.json(sources)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const source = await prisma.incomeSource.create({
      data: { ...parsed.data, userId: session.user.id },
    })
    return NextResponse.json(source, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: "Server error", detail: String(err) }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id, ...data } = await req.json()
    const parsed = schema.partial().safeParse(data)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    await prisma.incomeSource.updateMany({
      where: { id, userId: session.user.id },
      data: parsed.data,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "Server error", detail: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  await prisma.incomeSource.deleteMany({ where: { id, userId: session.user.id } })
  return NextResponse.json({ success: true })
}
