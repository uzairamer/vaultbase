import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const createSchema = z.object({
  walletId: z.string().min(1),
  name: z.string().min(1),
  amount: z.coerce.number().min(0),
  color: z.string().default("#6366f1"),
  resetSchedule: z.enum(["none", "weekly", "monthly", "quarterly"]).default("none"),
  resetAmount: z.coerce.number().min(0).optional().nullable(),
})

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  amount: z.coerce.number().min(0).optional(),
  color: z.string().optional(),
  resetSchedule: z.enum(["none", "weekly", "monthly", "quarterly"]).optional(),
  resetAmount: z.coerce.number().min(0).optional().nullable(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Verify wallet belongs to user
  const wallet = await prisma.wallet.findFirst({
    where: { id: parsed.data.walletId, userId: session.user.id },
  })
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 })

  const segment = await prisma.walletSegment.create({
    data: { ...parsed.data, userId: session.user.id },
  })

  return NextResponse.json(segment, { status: 201 })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { id, ...data } = parsed.data

  const segment = await prisma.walletSegment.updateMany({
    where: { id, userId: session.user.id },
    data,
  })

  return NextResponse.json(segment)
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  // Check segment exists and belongs to user
  const segment = await prisma.walletSegment.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!segment) return NextResponse.json({ error: "Segment not found" }, { status: 404 })

  // Prevent deleting the last segment of a wallet
  const count = await prisma.walletSegment.count({ where: { walletId: segment.walletId } })
  if (count <= 1) return NextResponse.json({ error: "Cannot delete the last segment" }, { status: 400 })

  await prisma.walletSegment.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
