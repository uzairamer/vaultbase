"use client"

import { useState } from "react"
import { useSideInvestments, useCreateSideInvestment, useDeleteSideInvestment } from "@/modules/investments/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { Plus, Briefcase, Trash2 } from "lucide-react"
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog"
import { Badge } from "@/components/ui/badge"
import { cn, formatCurrency, formatPercent } from "@/lib/utils"
import { SIDE_INVESTMENT_TYPES } from "@/lib/constants"
import { format } from "date-fns"
import { toast } from "sonner"

export default function OtherInvestmentsPage() {
  const { data: investments = [], isLoading } = useSideInvestments()
  const createInv = useCreateSideInvestment()
  const deleteInv = useDeleteSideInvestment()
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState("")

  const totalValue = (investments as Record<string, unknown>[])
    .filter((i) => i.status === "active")
    .reduce((sum: number, i: Record<string, unknown>) => sum + Number(i.currentValue), 0)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createInv.mutate(
      {
        name: fd.get("name") as string,
        type: fd.get("type") as string,
        investedAmount: Number(fd.get("investedAmount")),
        currentValue: Number(fd.get("currentValue")),
        startDate: fd.get("startDate") as string,
        notes: (fd.get("notes") as string) || undefined,
      },
      {
        onSuccess: () => { setOpen(false); toast.success("Investment added") },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader title="Other Investments" description={`Active value: ${formatCurrency(totalValue)}`}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Investment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Side Investment</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input name="name" placeholder="e.g. Bitcoin, Friend's Business" required />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select name="type" required>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {SIDE_INVESTMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invested Amount</Label>
                  <Input name="investedAmount" type="number" step="0.01" min="0" required />
                </div>
                <div className="space-y-2">
                  <Label>Current Value</Label>
                  <Input name="currentValue" type="number" step="0.01" min="0" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input name="startDate" type="date" required />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea name="notes" />
              </div>
              <Button type="submit" className="w-full" disabled={createInv.isPending}>
                {createInv.isPending ? "Adding..." : "Add Investment"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {(investments as Record<string, unknown>[]).length === 0 ? (
        <EmptyState icon={Briefcase} title="No side investments" description="Track crypto, lending, business ventures, etc." />
      ) : (
        <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {(investments as Record<string, unknown>[]).map((inv) => {
            const invested = Number(inv.investedAmount)
            const current = Number(inv.currentValue)
            const pnl = current - invested
            const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0
            return (
              <div
                key={inv.id as string}
                className={cn(
                  "relative overflow-hidden rounded-xl border bg-gradient-to-br from-pink-500/25 to-rose-500/5 p-4 ring-1 ring-pink-500/40 hover:ring-2 hover:ring-pink-400/70 transition-all h-full",
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold truncate">{inv.name as string}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(SIDE_INVESTMENT_TYPES.find((t) => t.value === inv.type) || { label: inv.type }).label as string}
                      {" · "}Started {format(new Date(inv.startDate as string), "MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className="bg-pink-500/10 border-pink-500/40 text-pink-300 text-[10px] h-5">
                      {inv.status as string}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                      setDeleteId(inv.id as string); setDeleteName(inv.name as string)
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-2xl font-bold tabular-nums">{formatCurrency(current)}</p>
                <div className="flex items-center justify-between text-sm mt-1.5 tabular-nums">
                  <span className="text-muted-foreground">Invested {formatCurrency(invested)}</span>
                  <span className={cn("font-medium", pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)} ({formatPercent(pnlPct)})
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null) }}
        title={`Delete ${deleteName}?`}
        description={`This will permanently delete this investment. This cannot be undone.`}
        onConfirm={() => deleteInv.mutate(deleteId!, {
          onSuccess: () => toast.success("Deleted"),
          onError: (err) => toast.error(err.message),
        })}
        isPending={deleteInv.isPending}
      />
    </div>
  )
}
