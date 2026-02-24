"use client"

import { useState, useMemo, useCallback } from "react"
import { useStockHistories, fetchStockHistory } from "../hooks"
import type { StockHistory, StockHistoryPoint } from "../hooks"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Plus, X, Loader2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"

const DEFAULT_SYMBOLS = ["SAZEW", "MEBL", "DCR", "MARI", "SYS"]

type HeatmapMetric = "dod" | "wow" | "mom" | "ytd" | "yoy" | "yo2y" | "yo3y" | "yo4y"

const HEATMAP_METRICS: { key: HeatmapMetric; label: string }[] = [
  { key: "dod", label: "DoD" },
  { key: "wow", label: "WoW" },
  { key: "mom", label: "MoM" },
  { key: "ytd", label: "YTD" },
  { key: "yoy", label: "1Y" },
  { key: "yo2y", label: "2Y" },
  { key: "yo3y", label: "3Y" },
  { key: "yo4y", label: "4Y" },
]

function findClosestBefore(data: StockHistoryPoint[], targetTs: number): StockHistoryPoint | null {
  let best: StockHistoryPoint | null = null
  for (const point of data) {
    if (point.timestamp <= targetTs) best = point
    else break
  }
  return best
}

type Column = { label: string; startTs: number; endTs: number }

function generateColumns(metric: HeatmapMetric, tradingDays: number[], extended = false): Column[] {
  const now = new Date()

  switch (metric) {
    case "dod": {
      const count = extended ? 31 : 16
      const days = tradingDays.slice(-count)
      const cols: Column[] = []
      for (let i = 1; i < days.length; i++) {
        cols.push({
          label: new Date(days[i] * 1000).toLocaleDateString("en-PK", { month: "short", day: "numeric" }),
          startTs: days[i - 1],
          endTs: days[i],
        })
      }
      return cols
    }

    case "wow": {
      const count = extended ? 24 : 12
      const boundaries: number[] = []
      for (let i = count; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i * 7)
        boundaries.push(Math.floor(d.getTime() / 1000))
      }
      return boundaries.slice(1).map((endTs, i) => ({
        label: new Date(endTs * 1000).toLocaleDateString("en-PK", { month: "short", day: "numeric" }),
        startTs: boundaries[i],
        endTs,
      }))
    }

    case "mom": {
      const months = extended ? 24 : 12
      const bnd: { label: string; ts: number }[] = []
      for (let i = months; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        bnd.push({
          label: d.toLocaleDateString("en-PK", { month: "short", year: "2-digit" }),
          ts: Math.floor(d.getTime() / 1000),
        })
      }
      return bnd.slice(1).map((b, i) => ({
        label: b.label,
        startTs: bnd[i].ts,
        endTs: b.ts,
      }))
    }

    case "yoy": {
      const months = extended ? 18 : 12
      const bnd: { label: string; ts: number }[] = []
      for (let i = months; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        bnd.push({
          label: d.toLocaleDateString("en-PK", { month: "short", year: "2-digit" }),
          ts: Math.floor(d.getTime() / 1000),
        })
      }
      return bnd.slice(1).map((b, i) => ({
        label: b.label,
        startTs: bnd[i].ts,
        endTs: b.ts,
      }))
    }

    case "ytd": {
      const jan1Ts = Math.floor(new Date(now.getFullYear(), 0, 1).getTime() / 1000)
      if (extended) {
        const bnd: { label: string; ts: number }[] = []
        const d = new Date(now.getFullYear(), 0, 1)
        while (d.getTime() <= now.getTime()) {
          bnd.push({
            label: d.toLocaleDateString("en-PK", { month: "short", day: "numeric" }),
            ts: Math.floor(d.getTime() / 1000),
          })
          d.setDate(d.getDate() + 7)
        }
        bnd.push({ label: "Now", ts: Math.floor(now.getTime() / 1000) })
        return bnd.slice(1).map((b, i) => ({
          label: b.label,
          startTs: bnd[i].ts,
          endTs: b.ts,
        }))
      }
      const bnd: { label: string; ts: number }[] = [
        { label: "Jan 1", ts: jan1Ts },
      ]
      for (let m = 1; m <= now.getMonth(); m++) {
        const d = new Date(now.getFullYear(), m, 1)
        bnd.push({
          label: d.toLocaleDateString("en-PK", { month: "short" }),
          ts: Math.floor(d.getTime() / 1000),
        })
      }
      bnd.push({ label: "Now", ts: Math.floor(now.getTime() / 1000) })
      return bnd.slice(1).map((b, i) => ({
        label: b.label,
        startTs: bnd[i].ts,
        endTs: b.ts,
      }))
    }

    case "yo2y": {
      if (extended) {
        const months = 24
        const bnd: { label: string; ts: number }[] = []
        for (let i = months; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          bnd.push({
            label: d.toLocaleDateString("en-PK", { month: "short", year: "2-digit" }),
            ts: Math.floor(d.getTime() / 1000),
          })
        }
        return bnd.slice(1).map((b, i) => ({
          label: b.label,
          startTs: bnd[i].ts,
          endTs: b.ts,
        }))
      }
      const quarters = 8
      const bnd: { label: string; ts: number }[] = []
      for (let i = quarters; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1)
        const q = Math.floor(d.getMonth() / 3) + 1
        bnd.push({
          label: `Q${q}'${d.getFullYear().toString().slice(-2)}`,
          ts: Math.floor(d.getTime() / 1000),
        })
      }
      return bnd.slice(1).map((b, i) => ({
        label: b.label,
        startTs: bnd[i].ts,
        endTs: b.ts,
      }))
    }

    case "yo3y":
    case "yo4y": {
      const years = metric === "yo3y" ? 3 : 4
      const quarters = extended ? years * 6 : years * 4
      const bnd: { label: string; ts: number }[] = []
      for (let i = quarters; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1)
        const q = Math.floor(d.getMonth() / 3) + 1
        bnd.push({
          label: `Q${q}'${d.getFullYear().toString().slice(-2)}`,
          ts: Math.floor(d.getTime() / 1000),
        })
      }
      return bnd.slice(1).map((b, i) => ({
        label: b.label,
        startTs: bnd[i].ts,
        endTs: b.ts,
      }))
    }

    default:
      return []
  }
}

function computeCellValues(
  data: StockHistoryPoint[],
  columns: Column[],
): (number | null)[] {
  return columns.map((col) => {
    const startPoint = findClosestBefore(data, col.startTs)
    const endPoint = findClosestBefore(data, col.endTs)
    if (!startPoint || !endPoint || startPoint.close === 0) return null
    if (startPoint.timestamp === endPoint.timestamp) return null
    return ((endPoint.close - startPoint.close) / startPoint.close) * 100
  })
}

function getHeatmapColor(percent: number | null): string {
  if (percent === null) return "hsl(0 0% 25%)"
  const clamped = Math.max(-15, Math.min(15, percent))
  const intensity = Math.abs(clamped) / 15
  const hue = percent >= 0 ? 142 : 0
  const saturation = 70 + intensity * 20
  const lightness = 45 - intensity * 15
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

function getTextColor(percent: number | null): string {
  if (percent === null) return "hsl(0 0% 70%)"
  return "white"
}

function formatValue(v: number | null): string {
  if (v === null) return "-"
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`
}

function getMetricDescription(metric: HeatmapMetric, colCount: number): string {
  switch (metric) {
    case "dod": return `Last ${colCount} trading days`
    case "wow": return `Last ${colCount} weeks`
    case "mom": return `Last ${colCount} months`
    case "ytd": return `Year to date`
    case "yoy": return `Last 12 months`
    case "yo2y": return `Last 8 quarters`
    case "yo3y": return `Last ${colCount} quarters`
    case "yo4y": return `Last ${colCount} quarters`
    default: return ""
  }
}

function computeWinRatio(values: (number | null)[]): { wins: number; total: number } {
  let wins = 0
  let total = 0
  for (const v of values) {
    if (v !== null) {
      total++
      if (v > 0) wins++
    }
  }
  return { wins, total }
}

type SortKey = "name" | "wins" | number // number = column index
type SortDir = "asc" | "desc"

export function StockHeatmap() {
  const [selectedMetric, setSelectedMetric] = useState<HeatmapMetric>("dod")
  const [symbolInput, setSymbolInput] = useState("")
  const [customHistories, setCustomHistories] = useState<StockHistory[]>([])
  const [customLoading, setCustomLoading] = useState(false)
  const [hiddenSymbols, setHiddenSymbols] = useState<Set<string>>(new Set())
  const [selectedStock, setSelectedStock] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        return prev
      }
      setSortDir(key === "name" ? "asc" : "desc")
      return key
    })
  }, [])

  const { data: defaultHistories, isLoading } = useStockHistories(DEFAULT_SYMBOLS, "max")

  const allHistories = useMemo(() => {
    const base = (defaultHistories || []).filter((h) => !hiddenSymbols.has(h.symbol))
    return [...base, ...customHistories]
  }, [defaultHistories, customHistories, hiddenSymbols])

  const displaySymbols = useMemo(() => allHistories.map((h) => h.symbol), [allHistories])

  const addStock = useCallback(async () => {
    const sym = symbolInput.trim().toUpperCase()
    if (!sym) return
    if (DEFAULT_SYMBOLS.includes(sym) && hiddenSymbols.has(sym)) {
      setHiddenSymbols((prev) => { const next = new Set(prev); next.delete(sym); return next })
      setSymbolInput("")
      return
    }
    if (displaySymbols.includes(sym)) {
      setSymbolInput("")
      return
    }
    setCustomLoading(true)
    const history = await fetchStockHistory(sym, "max")
    setCustomLoading(false)
    if (history.data.length === 0) return
    setCustomHistories((prev) => [...prev, history])
    setSymbolInput("")
  }, [symbolInput, hiddenSymbols, displaySymbols])

  const removeStock = useCallback((sym: string) => {
    if (selectedStock === sym) setSelectedStock(null)
    if (DEFAULT_SYMBOLS.includes(sym)) {
      setHiddenSymbols((prev) => new Set([...prev, sym]))
    } else {
      setCustomHistories((prev) => prev.filter((h) => h.symbol !== sym))
    }
  }, [selectedStock])

  const tradingDays = useMemo(() => {
    const tsSet = new Set<number>()
    for (const h of allHistories) {
      for (const p of h.data) tsSet.add(p.timestamp)
    }
    return [...tsSet].sort((a, b) => a - b)
  }, [allHistories])

  const columns = useMemo(
    () => generateColumns(selectedMetric, tradingDays, false),
    [selectedMetric, tradingDays],
  )

  const cellValues = useMemo(() => {
    const result = new Map<string, (number | null)[]>()
    for (const h of allHistories) {
      result.set(h.symbol, computeCellValues(h.data, columns))
    }
    return result
  }, [allHistories, columns])

  const sortedSymbols = useMemo(() => {
    const syms = [...displaySymbols]
    const dir = sortDir === "asc" ? 1 : -1
    syms.sort((a, b) => {
      if (sortKey === "name") {
        return dir * a.localeCompare(b)
      }
      if (sortKey === "wins") {
        const aRatio = (() => { const { wins, total } = computeWinRatio(cellValues.get(a) || []); return total > 0 ? wins / total : -1 })()
        const bRatio = (() => { const { wins, total } = computeWinRatio(cellValues.get(b) || []); return total > 0 ? wins / total : -1 })()
        return dir * (aRatio - bRatio)
      }
      // Sort by column index
      const aVal = (cellValues.get(a) || [])[sortKey] ?? -Infinity
      const bVal = (cellValues.get(b) || [])[sortKey] ?? -Infinity
      return dir * (aVal - bVal)
    })
    return syms
  }, [displaySymbols, cellValues, sortKey, sortDir])

  const detailColumns = useMemo(
    () => selectedStock ? generateColumns(selectedMetric, tradingDays, true) : [],
    [selectedStock, selectedMetric, tradingDays],
  )

  const detailValues = useMemo(() => {
    if (!selectedStock) return []
    const h = allHistories.find((hist) => hist.symbol === selectedStock)
    if (!h) return []
    return computeCellValues(h.data, detailColumns)
  }, [selectedStock, allHistories, detailColumns])

  if (isLoading) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Loading heatmap data...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border p-0.5 text-xs">
          {HEATMAP_METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedMetric(m.key)}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                selectedMetric === m.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <Input
            placeholder="Add symbol (e.g. LUCK)"
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStock() } }}
            className="max-w-[180px] h-7 text-xs"
          />
          <Button size="sm" className="h-7 text-xs px-2" onClick={addStock} disabled={customLoading || !symbolInput.trim()}>
            {customLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-0.5" />}
            {customLoading ? "..." : "Add"}
          </Button>
        </div>

        {hiddenSymbols.size > 0 && (
          <button
            onClick={() => setHiddenSymbols(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Restore {hiddenSymbols.size} hidden
          </button>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground">{getMetricDescription(selectedMetric, columns.length)}</p>

      {/* Heatmap grid — fixed layout, no horizontal scroll */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[110px]" />
            {columns.map((_, i) => (
              <col key={i} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left text-[11px] font-medium text-muted-foreground px-1 py-1.5">
                <button onClick={() => toggleSort("name")} className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors">
                  Stock
                  {sortKey === "name"
                    ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                    : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </button>
              </th>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className="text-center text-[10px] font-medium text-muted-foreground py-1.5 px-0"
                  title={`Sort by ${col.label}`}
                >
                  <button
                    onClick={() => toggleSort(i)}
                    className="w-full truncate hover:text-foreground transition-colors"
                  >
                    {col.label}
                    {sortKey === i && (
                      sortDir === "asc"
                        ? <ArrowUp className="inline h-2.5 w-2.5 ml-px" />
                        : <ArrowDown className="inline h-2.5 w-2.5 ml-px" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedSymbols.map((symbol) => {
              const values = cellValues.get(symbol) || []
              const isSelected = selectedStock === symbol
              const { wins, total } = computeWinRatio(values)
              return (
                <tr
                  key={symbol}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? "bg-primary/10" : "hover:bg-muted/20"
                  }`}
                  onClick={() => setSelectedStock(isSelected ? null : symbol)}
                >
                  <td className="px-1 py-px whitespace-nowrap">
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); removeStock(symbol) }}
                        className="shrink-0 p-0.5 rounded hover:bg-destructive/20 transition-colors"
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                      <span className={`text-xs truncate ${isSelected ? "font-bold" : "font-medium"}`}>
                        {symbol}
                      </span>
                      {total > 0 && (
                        <span className={`text-[10px] tabular-nums ${wins > total / 2 ? "text-green-500" : "text-red-500"}`}>
                          {wins}/{total}
                        </span>
                      )}
                    </div>
                  </td>
                  {columns.map((_, i) => {
                    const value = values[i] ?? null
                    return (
                      <td key={i} className="px-px py-px">
                        <div
                          className="rounded-sm py-0.5 text-[10px] font-medium tabular-nums text-center overflow-hidden"
                          style={{
                            backgroundColor: getHeatmapColor(value),
                            color: getTextColor(value),
                          }}
                        >
                          {formatValue(value)}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Detail modal for selected stock */}
      <Dialog open={!!selectedStock} onOpenChange={(open) => { if (!open) setSelectedStock(null) }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedStock}</DialogTitle>
            <DialogDescription>
              {getMetricDescription(selectedMetric, detailColumns.length)}
              {detailValues.length > 0 && (() => {
                const { wins, total } = computeWinRatio(detailValues)
                return total > 0 ? ` · ${wins}/${total} green` : ""
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5">
            {detailColumns.map((col, i) => {
              const value = detailValues[i] ?? null
              return (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] text-muted-foreground whitespace-nowrap leading-none">
                    {col.label}
                  </span>
                  <div
                    className="rounded px-1.5 py-1 text-[11px] font-medium tabular-nums min-w-[48px] text-center"
                    style={{
                      backgroundColor: getHeatmapColor(value),
                      color: getTextColor(value),
                    }}
                  >
                    {formatValue(value)}
                  </div>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>-10%</span>
        <div
          className="flex-1 h-2.5 rounded-full max-w-xs"
          style={{
            background:
              "linear-gradient(to right, hsl(0 90% 30%), hsl(0 70% 45%), hsl(0 0% 50%), hsl(142 70% 45%), hsl(142 90% 30%))",
          }}
        />
        <span>+10%</span>
      </div>
    </div>
  )
}
