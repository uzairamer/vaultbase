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
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { SIDE_INVESTMENT_TYPES } from "@/lib/constants"
import { format } from "date-fns"
import { toast } from "sonner"

export default function OtherInvestmentsPage() {
  const { data: investments = [], isLoading } = useSideInvestments()
  const createInv = useCreateSideInvestment()
  const deleteInv = useDeleteSideInvestment()
  const [open, setOpen] = useState(false)

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(investments as Record<string, unknown>[]).map((inv) => {
            const invested = Number(inv.investedAmount)
            const current = Number(inv.currentValue)
            const pnl = current - invested
            const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0
            return (
              <Card key={inv.id as string}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">{inv.name as string}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Badge variant={inv.status === "active" ? "default" : "secondary"}>
                      {inv.status as string}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                      deleteInv.mutate(inv.id as string, { onSuccess: () => toast.success("Deleted") })
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-bold">{formatCurrency(current)}</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Invested: {formatCurrency(invested)}</span>
                    <span className={pnl >= 0 ? "text-green-500" : "text-red-500"}>
                      {formatCurrency(pnl)} ({formatPercent(pnlPct)})
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(SIDE_INVESTMENT_TYPES.find((t) => t.value === inv.type) || { label: inv.type }).label as string}
                    {" · "}Started {format(new Date(inv.startDate as string), "MMM yyyy")}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
