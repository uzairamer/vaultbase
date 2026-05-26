import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

function isDue(schedule: string, lastResetAt: Date | null, now: Date): boolean {
  if (schedule === "none") return false

  if (schedule === "weekly") {
    // Due if today is Monday and we haven't reset this week yet
    const dayOfWeek = now.getDay() // 0=Sun, 1=Mon
    if (dayOfWeek !== 1) return false
    if (!lastResetAt) return true
    const lastMonday = new Date(now)
    lastMonday.setHours(0, 0, 0, 0)
    return lastResetAt < lastMonday
  }

  if (schedule === "monthly") {
    // Due if today is the 1st and we haven't reset this month
    if (now.getDate() !== 1) return false
    if (!lastResetAt) return true
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    return lastResetAt < startOfMonth
  }

  if (schedule === "quarterly") {
    // Due if today is the 1st of a quarter-start month (Jan, Apr, Jul, Oct)
    const month = now.getMonth() // 0-indexed
    const isQuarterStart = [0, 3, 6, 9].includes(month)
    if (!isQuarterStart || now.getDate() !== 1) return false
    if (!lastResetAt) return true
    const startOfQuarter = new Date(now.getFullYear(), month, 1)
    return lastResetAt < startOfQuarter
  }

  return false
}

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id
  const now = new Date()

  const segments = await prisma.walletSegment.findMany({
    where: { userId, resetSchedule: { not: "none" } },
  })

  const due = segments.filter((s) => isDue(s.resetSchedule, s.lastResetAt, now))

  if (due.length === 0) return NextResponse.json({ reset: 0 })

  await prisma.$transaction(
    due.map((s) =>
      prisma.walletSegment.update({
        where: { id: s.id },
        data: {
          amount: s.resetAmount ?? 0,
          lastResetAt: now,
        },
      })
    )
  )

  return NextResponse.json({ reset: due.length })
}
