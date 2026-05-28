import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  propertyId: z.string().min(1).optional(), // if omitted, scan all user's properties
})

// Auto-mark past-due, still-pending installments as paid (paidDate = dueDate).
// User can later flip these to "unpaid" to log a miss.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const now = new Date()

  const where = {
    status: "pending",
    dueDate: { lt: now },
    property: {
      userId: session.user.id,
      archivedAt: null,
      ...(parsed.data.propertyId ? { id: parsed.data.propertyId } : {}),
    },
  }

  const due = await prisma.installment.findMany({ where, select: { id: true, dueDate: true } })

  if (due.length === 0) return NextResponse.json({ marked: 0 })

  await prisma.$transaction(
    due.map((i) =>
      prisma.installment.update({
        where: { id: i.id },
        data: { status: "paid", paidDate: i.dueDate },
      })
    )
  )

  return NextResponse.json({ marked: due.length })
}
