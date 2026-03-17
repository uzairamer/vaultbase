import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const symbol  = searchParams.get("symbol")
  const interval = searchParams.get("interval") || "annual"
  const type    = searchParams.get("type") || "profile"
  const token   = req.headers.get("x-api-token")
  const cookie  = req.headers.get("x-api-session")

  if (!symbol)  return NextResponse.json({ error: "symbol is required" }, { status: 400 })
  if (!token)   return NextResponse.json({ error: "Bearer token not configured — add it in Settings → Configs" }, { status: 400 })
  if (!cookie)  return NextResponse.json({ error: "Session cookie not configured — add it in Settings → Configs" }, { status: 400 })

  const url = `https://data.arifhabibltd.com/api/v3/company-statement?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&type=${encodeURIComponent(type)}`

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `laravel_session=${cookie}`,
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        Referer: `https://data.arifhabibltd.com/research/company/${symbol}`,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
      },
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return NextResponse.json(
        { error: `Upstream error ${res.status}`, detail: text.slice(0, 500) },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: "Network error", detail: String(err) }, { status: 502 })
  }
}
