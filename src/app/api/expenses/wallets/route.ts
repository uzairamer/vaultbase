import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const walletSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  bankName: z.string().optional(),
  balance: z.coerce.number(),
  currency: z.string().default("PKR"),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const wallets = await prisma.wallet.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { transactions: true } } },
  })

  return NextResponse.json(wallets)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = walletSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const wallet = await prisma.wallet.create({
    data: { ...parsed.data, userId: session.user.id },
  })

  return NextResponse.json(wallet, { status: 201 })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { id, ...data } = body
  const parsed = walletSchema.safeParse(data)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const wallet = await prisma.wallet.updateMany({
    where: { id, userId: session.user.id },
    data: parsed.data,
  })

  return NextResponse.json(wallet)
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  await prisma.wallet.deleteMany({ where: { id, userId: session.user.id } })

  return NextResponse.json({ success: true })
}
