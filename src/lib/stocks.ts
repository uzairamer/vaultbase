// Stock value math helpers.
//
// IMPORTANT: A `StockHolding.quantity` is the ORIGINAL purchase quantity.
// The sell endpoint creates sell-trade records but intentionally does NOT
// decrement `quantity`. So to get the qty you currently own you must subtract
// the sum of sell trades from the holding's quantity.
//
// Any totals/aggregates that ignore this will overcount your portfolio.

type AnyNumber = number | string | { toString(): string } | null | undefined

interface StockLike {
  quantity: AnyNumber
  avgBuyPrice: AnyNumber
  currentPrice?: AnyNumber
  trades?: Array<{ type: string; quantity: AnyNumber }>
}

function n(v: AnyNumber): number {
  if (v == null) return 0
  return typeof v === "number" ? v : Number(v)
}

export function netStockQuantity(s: StockLike): number {
  const buy = n(s.quantity)
  const sold = (s.trades ?? [])
    .filter((t) => t.type === "sell")
    .reduce((a, t) => a + n(t.quantity), 0)
  return Math.max(0, buy - sold)
}

export function holdingValue(s: StockLike): number {
  const qty = netStockQuantity(s)
  const price = s.currentPrice != null ? n(s.currentPrice) : n(s.avgBuyPrice)
  return qty * price
}

export function totalStocksValue(stocks: StockLike[]): number {
  return stocks.reduce((sum, s) => sum + holdingValue(s), 0)
}
