"use client"

import { useState } from "react"
import { useCommodities, useCreateCommodity, useDeleteCommodity } from "@/modules/investments/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { Plus, Gem, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { COMMODITY_TYPES, COMMODITY_UNITS } from "@/lib/constants"
import { toast } from "sonner"
import Link from "next/link"

export default function CommoditiesPage() {
  const { data: commodities = [], isLoading } = useCommodities()
  const createCommodity = useCreateCommodity()
  const deleteCommodity = useDeleteCommodity()
  const [open, setOpen] = useState(false)

  const totalValue = (commodities as Record<string, unknown>[]).reduce((sum: number, c: Record<string, unknown>) => {
    return sum + Number(c.quantity) * Number(c.currentPrice ?? c.avgBuyPrice)
  }, 0)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createCommodity.mutate(
      {
        type: fd.get("type") as string,
        unit: fd.get("unit") as string,
        quantity: Number(fd.get("quantity")),
        avgBuyPrice: Number(fd.get("avgBuyPrice")),
        currentPrice: Number(fd.get("currentPrice")) || undefined,
      },
      {
        onSuccess: () => { setOpen(false); toast.success("Commodity added") },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader title="Commodities" description={`Total value: ${formatCurrency(totalValue)}`}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Commodity</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Commodity Holding</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select name="type" required>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {COMMODITY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select name="unit" required>
                    <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      {COMMODITY_UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input name="quantity" type="number" step="0.0001" min="0" required />
                </div>
                <div className="space-y-2">
                  <Label>Avg Buy Price</Label>
                  <Input name="avgBuyPrice" type="number" step="0.0001" min="0" required />
                </div>
                <div className="space-y-2">
                  <Label>Current Price</Label>
                  <Input name="currentPrice" type="number" step="0.0001" min="0" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createCommodity.isPending}>
                {createCommodity.isPending ? "Adding..." : "Add Commodity"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {(commodities as Record<string, unknown>[]).length === 0 ? (
        <EmptyState icon={Gem} title="No commodities" description="Track gold, silver, and other commodity holdings." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(commodities as Record<string, unknown>[]).map((c) => {
            const qty = Number(c.quantity)
            const avg = Number(c.avgBuyPrice)
            const cur = Number(c.currentPrice ?? avg)
            const value = qty * cur
            const pnl = (cur - avg) * qty
            const pnlPct = avg > 0 ? ((cur - avg) / avg) * 100 : 0
            return (
              <Link key={c.id as string} href={`/investments/commodities/${c.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base capitalize">{c.type as string}</CardTitle>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary">{qty} {c.unit as string}</Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => {
                        e.preventDefault()
                        deleteCommodity.mutate(c.id as string, { onSuccess: () => toast.success("Deleted") })
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(value)}</div>
                    <p className={`text-sm ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {formatCurrency(pnl)} ({formatPercent(pnlPct)})
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
