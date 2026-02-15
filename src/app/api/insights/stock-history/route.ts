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
  // Default: since inception (~20 years back, the API will return whatever it has)
  const fromParam = req.nextUrl.searchParams.get("from")
  const from = fromParam ? Number(fromParam) : now - 20 * 365 * 24 * 60 * 60

  const url = `https://chart.scstrade.com/history?symbol=${encodeURIComponent(symbol)}&resolution=1D&from=${from}&to=${now}&countback=10000`

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
    return NextResponse.json({ error: "Failed to fetch stock history" }, { status: 502 })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
