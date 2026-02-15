"use client"

import { useState } from "react"
import { useLiabilities, useCreateLiability, useDeleteLiability } from "@/modules/expenses/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/shared/empty-state"
import { Plus, HandCoins, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { toast } from "sonner"

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function LiabilitiesPage() {
  const { data: liabilities = [], isLoading } = useLiabilities()
  const createLiability = useCreateLiability()
  const deleteLiability = useDeleteLiability()
  const [open, setOpen] = useState(false)
  const [payOpen, setPayOpen] = useState<string | null>(null)

  const totalOwed = (liabilities as Record<string, unknown>[])
    .filter((l) => l.status !== "settled")
    .reduce((sum: number, l: Record<string, unknown>) => sum + Number(l.amount) - Number(l.amountPaid), 0)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createLiability.mutate(
      {
        personName: fd.get("personName") as string,
        amount: Number(fd.get("amount")),
        takenDate: fd.get("takenDate") as string,
        dueDate: (fd.get("dueDate") as string) || undefined,
        reason: fd.get("reason") as string || undefined,
        notes: fd.get("notes") as string || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false)
          toast.success("Liability added")
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function handlePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createLiability.mutate(
      {
        liabilityId: payOpen,
        amount: Number(fd.get("amount")),
        date: fd.get("date") as string,
        notes: fd.get("notes") as string || undefined,
      },
      {
        onSuccess: () => {
          setPayOpen(null)
          toast.success("Payment recorded")
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader title="Liabilities" description={`Total you owe: ${formatCurrency(totalOwed)}`}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Liability</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Liability</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Person Name</Label>
                <Input name="personName" required />
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input name="amount" type="number" step="0.01" min="0" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Taken Date</Label>
                  <Input name="takenDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
                </div>
                <div className="space-y-2">
                  <Label>Due Date (optional)</Label>
                  <Input name="dueDate" type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Input name="reason" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea name="notes" />
              </div>
              <Button type="submit" className="w-full" disabled={createLiability.isPending}>
                {createLiability.isPending ? "Adding..." : "Add Liability"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Dialog open={!!payOpen} onOpenChange={() => setPayOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input name="amount" type="number" step="0.01" min="0" required />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input name="notes" />
            </div>
            <Button type="submit" className="w-full">Record Payment</Button>
          </form>
        </DialogContent>
      </Dialog>

      {(liabilities as Record<string, unknown>[]).length === 0 ? (
        <EmptyState icon={HandCoins} title="No liabilities" description="Track money you owe." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(liabilities as Record<string, unknown>[]).map((l) => {
            const amount = Number(l.amount)
            const paid = Number(l.amountPaid)
            const remaining = amount - paid
            return (
              <Card key={l.id as string}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">{l.personName as string}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={l.status === "settled" ? "default" : l.status === "partial" ? "secondary" : "destructive"}>
                      {l.status as string}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteLiability.mutate(l.id as string, { onSuccess: () => toast.success("Deleted") })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Total: {formatCurrency(amount)}</span>
                    <span>Paid: {formatCurrency(paid)}</span>
                    <span className="font-medium">Remaining: {formatCurrency(remaining)}</span>
                  </div>
                  <ProgressBar value={paid} max={amount} />
                  {l.reason ? <p className="text-sm text-muted-foreground">{l.reason as string}</p> : null}
                  <div className="text-xs text-muted-foreground">
                    Taken: {format(new Date(l.takenDate as string), "MMM dd, yyyy")}
                    {l.dueDate ? ` · Due: ${format(new Date(l.dueDate as string), "MMM dd, yyyy")}` : null}
                  </div>
                  {l.status !== "settled" && (
                    <Button size="sm" variant="outline" onClick={() => setPayOpen(l.id as string)}>
                      Record Payment
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
