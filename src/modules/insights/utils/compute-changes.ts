import type { StockHistoryPoint } from "../hooks"

/**
 * Finds the most recent PREVIOUS occurrence of the current price level (±2%)
 * in historical daily closes, skipping the current contiguous cluster of days
 * that are already at this price.
 *
 * Phase 1: skip consecutive recent days that are already within ±2% (the current plateau).
 * Phase 2: walk further back to find the last time the price was at this level before now.
 *
 * Example: if the stock is at 150 today and was also at 150 in Oct 2025 before
 * rallying above, this returns the days since that Oct 2025 date — not "1 day ago."
 */
export function computeDaysAtCurrentPrice(
  currentPrice: number,
  data: StockHistoryPoint[]
): number | null {
  if (!currentPrice || currentPrice === 0 || data.length < 2) return null

  const low = currentPrice * 0.99
  const high = currentPrice * 1.01
  const latestTs = data[data.length - 1].timestamp

  let i = data.length - 2

  // Phase 1: skip the current in-range cluster (days trivially near today's price)
  while (i >= 0 && data[i].close >= low && data[i].close <= high) {
    i--
  }

  // Phase 2: find the previous occurrence of this price level
  while (i >= 0) {
    const { close, timestamp } = data[i]
    if (close >= low && close <= high) {
      return Math.round((latestTs - timestamp) / (24 * 60 * 60))
    }
    i--
  }

  return null // price not found in available history before the current cluster
}

export interface ChangeMetrics {
  dod: number | null
  wow: number | null
  mom: number | null
  ytd: number | null
  yoy: number | null
  yo2y: number | null
  yo3y: number | null
  yo4y: number | null
  yo5y: number | null
  inception: number | null
}

export const METRIC_LABELS: Record<keyof ChangeMetrics, string> = {
  dod: "DoD",
  wow: "WoW",
  mom: "MoM",
  ytd: "YTD",
  yoy: "YoY",
  yo2y: "2Y",
  yo3y: "3Y",
  yo4y: "4Y",
  yo5y: "5Y",
  inception: "All",
}

function findClosestBefore(data: StockHistoryPoint[], targetTs: number): StockHistoryPoint | null {
  let best: StockHistoryPoint | null = null
  for (const point of data) {
    if (point.timestamp <= targetTs) {
      best = point
    } else {
      break
    }
  }
  return best
}

export function computeChangeMetrics(data: StockHistoryPoint[]): ChangeMetrics {
  if (data.length < 2) {
    return { dod: null, wow: null, mom: null, ytd: null, yoy: null, yo2y: null, yo3y: null, yo4y: null, yo5y: null, inception: null }
  }

  const latest = data[data.length - 1]
  const currentPrice = latest.close
  const nowTs = latest.timestamp

  const DAY = 24 * 60 * 60

  function change(daysBack: number): number | null {
    const targetTs = nowTs - daysBack * DAY
    if (targetTs < data[0].timestamp) return null
    const point = findClosestBefore(data, targetTs)
    if (!point || point.close === 0) return null
    return ((currentPrice - point.close) / point.close) * 100
  }

  // YTD: compare to Jan 1 of the current year
  const jan1 = new Date(new Date(latest.timestamp * 1000).getFullYear(), 0, 1)
  const jan1Ts = Math.floor(jan1.getTime() / 1000)
  let ytd: number | null = null
  if (jan1Ts >= data[0].timestamp) {
    const point = findClosestBefore(data, jan1Ts)
    if (point && point.close > 0) {
      ytd = ((currentPrice - point.close) / point.close) * 100
    }
  }

  return {
    dod: change(1),
    wow: change(7),
    mom: change(30),
    ytd,
    yoy: change(365),
    yo2y: change(2 * 365),
    yo3y: change(3 * 365),
    yo4y: change(4 * 365),
    yo5y: change(5 * 365),
    inception: data[0].close > 0 ? ((currentPrice - data[0].close) / data[0].close) * 100 : null,
  }
}
