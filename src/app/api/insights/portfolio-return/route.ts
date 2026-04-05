import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

const SCSTRADE_HEADERS = {
  accept: "*/*",
  origin: "https://scstrade.com",
  referer: "https://scstrade.com/",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
}

type PriceRow = { timestamp: number; close: number }

async function fetchDailyPrices(symbol: string, from: number, to: number): Promise<PriceRow[]> {
  try {
    const url = `https://chart.scstrade.com/history?symbol=${encodeURIComponent(symbol)}&resolution=1D&from=${from}&to=${to}&countback=10000`
    const res = await fetch(url, { headers: SCSTRADE_HEADERS })
    if (!res.ok) return []
    const data = await res.json()
    if (data.s !== "ok" || !Array.isArray(data.t)) return []
    return (data.t as number[]).map((t: number, i: number) => ({
      timestamp: t,
      close: (data.c as number[])[i],
    }))
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const period = req.nextUrl.searchParams.get("period") ?? "1y"
  const now = Math.floor(Date.now() / 1000)

  const holdings = await prisma.stockHolding.findMany({
    where: { userId: session.user.id },
    include: { trades: { orderBy: { date: "asc" } } },
  })

  if (holdings.length === 0) return NextResponse.json({ points: [], events: [] })

  // All trades across all holdings (with symbol attached)
  const allTrades = holdings.flatMap((h) => {
    const trades = h.trades.map((t) => ({
      symbol:    h.symbol,
      type:      t.type,
      quantity:  Number(t.quantity),
      price:     Number(t.price),
      timestamp: Math.floor(new Date(t.date).getTime() / 1000),
      date:      t.date,
    }))

    // If the holding has no buy trades, the initial position isn't captured in trades.
    // Add a synthetic buy event at purchaseDate so it shows on the chart.
    const totalBuyTrades  = h.trades.filter((t) => t.type === "buy" ).reduce((s, t) => s + Number(t.quantity), 0)
    const totalSellTrades = h.trades.filter((t) => t.type === "sell").reduce((s, t) => s + Number(t.quantity), 0)
    const initialQty = Number(h.quantity) + totalSellTrades - totalBuyTrades
    if (initialQty > 0) {
      trades.push({
        symbol:    h.symbol,
        type:      "buy",
        quantity:  initialQty,
        price:     Number(h.avgBuyPrice),
        timestamp: Math.floor(new Date(h.purchaseDate).getTime() / 1000),
        date:      h.purchaseDate,
      })
    }

    return trades
  })

  // Earliest relevant timestamp: min(all purchaseDates, all tradeDates)
  const earliestHoldingTs = holdings.reduce(
    (m, h) => Math.min(m, Math.floor(new Date(h.purchaseDate).getTime() / 1000)),
    Infinity
  )
  const earliestTradeTs = allTrades.length > 0
    ? allTrades.reduce((m, t) => Math.min(m, t.timestamp), allTrades[0].timestamp)
    : earliestHoldingTs
  const earliestTs = Math.min(earliestHoldingTs, earliestTradeTs)

  // Period start for price history
  let periodStartTs: number
  switch (period) {
    case "ytd": {
      const jan1 = new Date(new Date().getFullYear(), 0, 1)
      periodStartTs = Math.floor(jan1.getTime() / 1000)
      break
    }
    case "1y": periodStartTs = now - 365 * 24 * 3600; break
    case "3y": periodStartTs = now - 3 * 365 * 24 * 3600; break
    default:   periodStartTs = earliestTs  // "max"
  }

  // Fetch prices from max(period_start, earliest_holding_date)
  const fetchFrom = Math.max(periodStartTs, earliestTs)

  // Unique symbols
  const symbols = [...new Set(holdings.map((h) => h.symbol))]

  // Fetch price histories in parallel
  const priceHistories = await Promise.all(
    symbols.map(async (sym) => ({
      symbol: sym,
      rows: await fetchDailyPrices(sym, fetchFrom, now),
    }))
  )

  // Build sorted price lookup per symbol
  const priceMap = new Map<string, PriceRow[]>()
  for (const ph of priceHistories) {
    priceMap.set(ph.symbol, ph.rows.sort((a, b) => a.timestamp - b.timestamp))
  }

  // All unique trading-day timestamps (union of all price series)
  const allTimestamps = [
    ...new Set(priceHistories.flatMap((ph) => ph.rows.map((r) => r.timestamp))),
  ].sort((a, b) => a - b)

  if (allTimestamps.length === 0) return NextResponse.json({ points: [], events: [] })

  // Last known close price for a symbol at or before ts
  function getPriceAtOrBefore(symbol: string, ts: number): number | null {
    const rows = priceMap.get(symbol)
    if (!rows || rows.length === 0) return null
    let best: number | null = null
    for (const r of rows) {
      if (r.timestamp <= ts + 86399) best = r.close
      else break
    }
    return best
  }

  /**
   * Net quantity of a symbol held at timestamp ts.
   *
   * StockHolding.quantity is the CURRENT net qty. We derive the initial
   * pre-trade position by working backwards:
   *   initialQty = currentQty + totalSells - totalBuys
   * Then apply all trades up to ts chronologically.
   */
  function getQtyAt(symbol: string, ts: number): number {
    let qty = 0
    for (const h of holdings) {
      if (h.symbol !== symbol) continue

      const purchaseTs = Math.floor(new Date(h.purchaseDate).getTime() / 1000)
      if (ts < purchaseTs) continue  // holding didn't exist yet

      const totalBuyTrades  = h.trades.filter((t) => t.type === "buy" ).reduce((s, t) => s + Number(t.quantity), 0)
      const totalSellTrades = h.trades.filter((t) => t.type === "sell").reduce((s, t) => s + Number(t.quantity), 0)
      const initialQty = Number(h.quantity) + totalSellTrades - totalBuyTrades

      qty += initialQty  // starting position before any recorded trades

      // Apply each trade that happened on or before ts
      for (const t of h.trades) {
        const tTs = Math.floor(new Date(t.date).getTime() / 1000)
        if (tTs <= ts + 86399) {
          qty += t.type === "buy" ? Number(t.quantity) : -Number(t.quantity)
        }
      }
    }
    return Math.max(0, qty)
  }

  // Sample to keep response size reasonable
  let sample = 1
  if (allTimestamps.length > 1000) sample = 5
  else if (allTimestamps.length > 500) sample = 3

  // Compute portfolio value at each (sampled) date
  const points: { timestamp: number; date: string; value: number }[] = []

  for (let i = 0; i < allTimestamps.length; i += sample) {
    const ts = allTimestamps[i]
    let totalValue = 0
    let hasPosition = false

    for (const sym of symbols) {
      const qty = getQtyAt(sym, ts)
      if (qty <= 0) continue
      const price = getPriceAtOrBefore(sym, ts)
      if (price === null) continue
      hasPosition = true
      totalValue += qty * price
    }

    if (hasPosition) {
      points.push({
        timestamp: ts,
        date: new Date(ts * 1000).toLocaleDateString("en-PK", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        value: Math.round(totalValue),
      })
    }
  }

  // Consolidated buy/sell events within the fetched period
  const periodTrades = allTrades.filter((t) => t.timestamp >= fetchFrom)
  const eventsByDay = new Map<number, typeof allTrades>()
  for (const t of periodTrades) {
    const dayTs = t.timestamp - (t.timestamp % 86400)
    if (!eventsByDay.has(dayTs)) eventsByDay.set(dayTs, [])
    eventsByDay.get(dayTs)!.push(t)
  }

  const events = [...eventsByDay.entries()]
    .map(([dayTs, trades]) => ({
      timestamp: dayTs,
      date: new Date(dayTs * 1000).toLocaleDateString("en-PK", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      trades: trades.map(({ symbol, type, quantity, price }) => ({ symbol, type, quantity, price })),
    }))
    .sort((a, b) => a.timestamp - b.timestamp)

  return NextResponse.json({ points, events })
}
