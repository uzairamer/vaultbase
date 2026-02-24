import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const symbol = req.nextUrl.searchParams.get("symbol")
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 })
  }

  const now = Math.floor(Date.now() / 1000)
  // Start of today (Pakistan time, UTC+5)
  const pkToday = new Date()
  pkToday.setUTCHours(0, 0, 0, 0)
  // Adjust for PKT: midnight PKT = 19:00 UTC previous day
  const from = Math.floor(pkToday.getTime() / 1000) - 5 * 60 * 60

  const url = `https://chart.scstrade.com/history?symbol=${encodeURIComponent(symbol)}&resolution=1&from=${from}&to=${now}&countback=10000`

  const res = await fetch(url, {
    headers: {
      accept: "*/*",
      origin: "https://scstrade.com",
      referer: "https://scstrade.com/",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
    },
  })

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch live data" }, { status: 502 })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
