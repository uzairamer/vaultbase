import type { StockHistoryPoint } from "../hooks"

/**
 * Finds the OLDEST session in available history where today's live price fell
 * within that day's intraday high–low range, after skipping the current
 * contiguous cluster of sessions where the price is already in range.
 *
 * Phase 1: skip consecutive recent sessions where currentPrice ∈ [low, high]
 *          (the current plateau — stock has been at this level continuously).
 * Phase 2: walk all the way back through remaining history and record every
 *          session where currentPrice ∈ [low, high], keeping only the oldest.
 *
 * Returning the OLDEST match answers "how far back does this price level go?"
 * rather than being fooled by a brief intraday wick that touched this price
 * recently during a different move.
 *
 * Returns { days, date } of the oldest matching session, or null if not found.
 */
export function computeDaysAtCurrentPrice(
  currentPrice: number,
  data: StockHistoryPoint[]
): { days: number; date: string } | null {
  if (!currentPrice || currentPrice === 0 || data.length < 2) return null

  const latestTs = data[data.length - 1].timestamp

  let i = data.length - 2

  // Phase 1: skip the current in-range cluster
  while (i >= 0 && currentPrice >= data[i].low && currentPrice <= data[i].high) {
    i--
  }

  // Phase 2: walk all the way back and keep the OLDEST match
  let oldest: { days: number; date: string } | null = null
  while (i >= 0) {
    const { low, high, timestamp, date } = data[i]
    if (currentPrice >= low && currentPrice <= high) {
      oldest = { days: Math.round((latestTs - timestamp) / (24 * 60 * 60)), date }
    }
    i--
  }

  return oldest
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
