"use client"

import { useState } from "react"
import { useStaticPrices, useCreateStaticPrice, useDeleteStaticPrice, useAddStaticPriceEntry, useDeleteStaticPriceEntry } from "@/modules/investments/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, ChevronDown, ChevronRight, Tag } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { allRates, TOLA_TO_GRAMS, OUNCE_TO_GRAMS } from "@/lib/commodity-prices"
import { format } from "date-fns"
import { toast } from "sonner"

export default function StaticPricesPage() {
  const { data: prices = [], isLoading } = useStaticPrices()
  const createPrice = useCreateStaticPrice()
  const deletePrice = useDeleteStaticPrice()
  const addEntry = useAddStaticPriceEntry()
  const deleteEntry = useDeleteStaticPriceEntry()

  const [newName, setNewName] = useState("")
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [entryForm, setEntryForm] = useState<Record<string, { price: string; date: string; note: string }>>({})

  const priceList = prices as Record<string, unknown>[]

  function toggleExpanded(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function getEntryForm(id: string) {
    return entryForm[id] ?? { price: "", date: new Date().toISOString().slice(0, 10), note: "" }
  }

  function setEntry(id: string, field: string, value: string) {
    setEntryForm((prev) => ({ ...prev, [id]: { ...getEntryForm(id), [field]: value } }))
  }

  function handleAddSeries(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    createPrice.mutate(newName.trim(), {
      onSuccess: () => { setNewName(""); toast.success("Price series created") },
      onError: (err) => toast.error(err.message),
    })
  }

  function handleAddEntry(seriesId: string) {
    const form = getEntryForm(seriesId)
    const price = Number(form.price)
    if (!form.price || isNaN(price) || price <= 0) { toast.error("Enter a valid price"); return }
    if (!form.date) { toast.error("Enter a date"); return }
    addEntry.mutate(
      { staticPriceId: seriesId, pricePerTola: price, date: form.date, note: form.note || undefined },
      {
        onSuccess: () => {
          setEntryForm((prev) => ({ ...prev, [seriesId]: { price: "", date: new Date().toISOString().slice(0, 10), note: "" } }))
          toast.success("Price entry added")
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Static Prices"
        description="Manage commodity price histories. Enter price per tola — gram and ounce rates are calculated automatically."
      />

      {/* Conversion reference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Conversion Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">1 Tola</p>
              <p className="font-semibold">{TOLA_TO_GRAMS} grams</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">1 Ounce</p>
              <p className="font-semibold">{OUNCE_TO_GRAMS} grams</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">1 Ounce</p>
              <p className="font-semibold">{(OUNCE_TO_GRAMS / TOLA_TO_GRAMS).toFixed(3)} tolas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add new series */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Add Price Series</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddSeries} className="flex gap-2">
            <Input
              placeholder="e.g. Gold, Silver, Platinum"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
              required
            />
            <Button type="submit" disabled={createPrice.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Price series list */}
      {priceList.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No price series yet. Add one above.</p>
      ) : (
        <div className="space-y-3">
          {priceList.map((series) => {
            const entries = (series.entries as Record<string, unknown>[]) || []
            const latestEntry = entries[0]
            const latestPrice = latestEntry ? Number(latestEntry.pricePerTola) : null
            const rates = latestPrice ? allRates(latestPrice) : null
            const isOpen = expanded[series.id as string] ?? true
            const form = getEntryForm(series.id as string)

            return (
              <Card key={series.id as string}>
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => toggleExpanded(series.id as string)}
                      className="flex items-center gap-2 text-left flex-1 min-w-0"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className="font-semibold">{series.name as string}</span>
                      {rates && (
                        <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                          {formatCurrency(rates.perTola)}/tola
                        </Badge>
                      )}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500"
                      onClick={() => deletePrice.mutate(series.id as string, { onSuccess: () => toast.success("Series deleted") })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Derived rates preview */}
                  {rates && (
                    <div className="flex gap-4 text-xs text-muted-foreground ml-6 mt-1 pb-3">
                      <span>Per gram: <span className="text-foreground font-medium tabular-nums">{formatCurrency(rates.perGram)}</span></span>
                      <span>Per ounce: <span className="text-foreground font-medium tabular-nums">{formatCurrency(rates.perOunce)}</span></span>
                    </div>
                  )}
                </CardHeader>

                {isOpen && (
                  <CardContent className="pt-0 space-y-3">
                    {/* Add entry form */}
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Price Entry</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Price per Tola (PKR)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="e.g. 280000"
                            value={form.price}
                            onChange={(e) => setEntry(series.id as string, "price", e.target.value)}
                            className="h-9"
                          />
                          {form.price && Number(form.price) > 0 && (() => {
                            const r = allRates(Number(form.price))
                            return (
                              <p className="text-[10px] text-muted-foreground">
                                → {formatCurrency(r.perGram)}/g · {formatCurrency(r.perOunce)}/oz
                              </p>
                            )
                          })()}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Date</Label>
                          <Input
                            type="date"
                            value={form.date}
                            onChange={(e) => setEntry(series.id as string, "date", e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Note (optional)</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="e.g. Bank Alfalah rate"
                              value={form.note}
                              onChange={(e) => setEntry(series.id as string, "note", e.target.value)}
                              className="h-9 flex-1"
                            />
                            <Button size="sm" className="h-9 shrink-0" onClick={() => handleAddEntry(series.id as string)} disabled={addEntry.isPending}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Entries table */}
                    {entries.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">No entries yet.</p>
                    ) : (
                      <div className="space-y-0 divide-y rounded-lg border overflow-hidden">
                        <div className="grid grid-cols-5 px-3 py-2 bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <span>Date</span>
                          <span className="text-right">Per Tola</span>
                          <span className="text-right">Per Gram</span>
                          <span className="text-right">Per Ounce</span>
                          <span className="text-right">Del</span>
                        </div>
                        {entries.map((entry) => {
                          const r = allRates(Number(entry.pricePerTola))
                          return (
                            <div key={entry.id as string} className="grid grid-cols-5 px-3 py-2 text-xs items-center hover:bg-muted/20 transition-colors">
                              <span className="text-muted-foreground">
                                {format(new Date(entry.date as string), "d MMM yyyy")}
                                {(entry.note as string | null) && <span className="block text-[10px] truncate">{entry.note as string}</span>}
                              </span>
                              <span className="text-right tabular-nums font-medium">{formatCurrency(r.perTola)}</span>
                              <span className="text-right tabular-nums text-muted-foreground">{formatCurrency(r.perGram)}</span>
                              <span className="text-right tabular-nums text-muted-foreground">{formatCurrency(r.perOunce)}</span>
                              <span className="text-right">
                                <button
                                  onClick={() => deleteEntry.mutate(entry.id as string, { onSuccess: () => toast.success("Entry deleted") })}
                                  className="p-1 rounded hover:bg-red-500/10 text-red-500"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
