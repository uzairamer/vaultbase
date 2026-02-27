"use client"

import { useState } from "react"
import { useReceivables, useCreateReceivable, useDeleteReceivable, useWallets, useCreateTransaction } from "@/modules/expenses/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { Plus, Users, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { toast } from "sonner"

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function ReceivablesPage() {
  const { data: receivables = [], isLoading } = useReceivables()
  const { data: wallets = [] } = useWallets()
  const createReceivable = useCreateReceivable()
  const createTransaction = useCreateTransaction()
  const deleteReceivable = useDeleteReceivable()
  const [open, setOpen] = useState(false)
  const [payOpen, setPayOpen] = useState<string | null>(null)
  const [payWalletId, setPayWalletId] = useState<string>("")
  const [paySegmentId, setPaySegmentId] = useState<string>("")

  const typedWallets = wallets as Array<{
    id: string
    name: string
    balance: number
    segments: Array<{ id: string; name: string; amount: number }>
  }>

  const selectedWallet = typedWallets.find((w) => w.id === payWalletId)
  const selectedSegments = selectedWallet?.segments ?? []

  const totalOwed = (receivables as Record<string, unknown>[])
    .filter((r) => r.status !== "settled")
    .reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.amount) - Number(r.amountPaid), 0)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createReceivable.mutate(
      {
        personName: fd.get("personName") as string,
        amount: Number(fd.get("amount")),
        givenDate: fd.get("givenDate") as string,
        dueDate: (fd.get("dueDate") as string) || undefined,
        reason: fd.get("reason") as string || undefined,
        notes: fd.get("notes") as string || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false)
          toast.success("Receivable added")
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function handlePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createTransaction.mutate(
      {
        walletId: payWalletId,
        segmentId: paySegmentId || undefined,
        type: "inflow",
        subType: "receivable_collection",
        receivableId: payOpen,
        amount: Number(fd.get("amount")),
        date: fd.get("date") as string,
        description: (fd.get("notes") as string) || undefined,
      },
      {
        onSuccess: () => {
          setPayOpen(null)
          setPayWalletId("")
          setPaySegmentId("")
          toast.success("Payment recorded")
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader title="Receivables" description={`Total owed to you: ${formatCurrency(totalOwed)}`}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Receivable</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Receivable</DialogTitle></DialogHeader>
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
                  <Label>Given Date</Label>
                  <Input name="givenDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
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
              <Button type="submit" className="w-full" disabled={createReceivable.isPending}>
                {createReceivable.isPending ? "Adding..." : "Add Receivable"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Payment dialog */}
      <Dialog
        open={!!payOpen}
        onOpenChange={(o) => {
          if (!o) {
            setPayOpen(null)
            setPayWalletId("")
            setPaySegmentId("")
          }
        }}
      >
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
              <Label>Deposit to Wallet</Label>
              <Select value={payWalletId} onValueChange={(v) => { setPayWalletId(v); setPaySegmentId("") }} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select wallet" />
                </SelectTrigger>
                <SelectContent>
                  {typedWallets.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedSegments.length > 0 && (
              <div className="space-y-2">
                <Label>Segment <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select value={paySegmentId} onValueChange={setPaySegmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select segment" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedSegments.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input name="notes" />
            </div>
            <Button type="submit" className="w-full" disabled={!payWalletId || createTransaction.isPending}>
              {createTransaction.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {(receivables as Record<string, unknown>[]).length === 0 ? (
        <EmptyState icon={Users} title="No receivables" description="Track money people owe you." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(receivables as Record<string, unknown>[]).map((r) => {
            const amount = Number(r.amount)
            const paid = Number(r.amountPaid)
            const remaining = amount - paid
            return (
              <Card key={r.id as string}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">{r.personName as string}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.status === "settled" ? "default" : r.status === "partial" ? "secondary" : "destructive"}>
                      {r.status as string}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteReceivable.mutate(r.id as string, { onSuccess: () => toast.success("Deleted") })}>
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
                  {r.reason ? <p className="text-sm text-muted-foreground">{r.reason as string}</p> : null}
                  <div className="text-xs text-muted-foreground">
                    Given: {format(new Date(r.givenDate as string), "MMM dd, yyyy")}
                    {r.dueDate ? ` · Due: ${format(new Date(r.dueDate as string), "MMM dd, yyyy")}` : null}
                  </div>
                  {r.status !== "settled" && (
                    <Button size="sm" variant="outline" onClick={() => setPayOpen(r.id as string)}>
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
