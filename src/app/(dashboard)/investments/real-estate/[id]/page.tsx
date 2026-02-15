"use client"

import { use, useState } from "react"
import { useProperty, useCreateProperty, useUpdateProperty } from "@/modules/investments/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/shared/stat-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Building2, DollarSign, Calendar, CheckCircle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { toast } from "sonner"

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: property, isLoading } = useProperty(id)
  const createInstallment = useCreateProperty()
  const updateInstallment = useUpdateProperty()
  const [open, setOpen] = useState(false)

  if (isLoading) return <div className="p-6">Loading...</div>
  if (!property) return <div className="p-6">Property not found</div>

  const p = property as Record<string, unknown>
  const installments = (p.installments as Record<string, unknown>[]) || []
  const totalPaid = Number(p.downPayment) + installments
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.amount), 0)
  const remaining = Number(p.totalPrice) - totalPaid

  function handleAddInstallment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createInstallment.mutate(
      {
        propertyId: id,
        amount: Number(fd.get("amount")),
        dueDate: fd.get("dueDate") as string,
      },
      {
        onSuccess: () => { setOpen(false); toast.success("Installment added") },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function markPaid(installmentId: string) {
    updateInstallment.mutate(
      { installmentId, status: "paid", paidDate: new Date().toISOString() },
      { onSuccess: () => toast.success("Marked as paid") }
    )
  }

  return (
    <div>
      <PageHeader title={p.name as string} description={p.location as string || "Real Estate Investment"} />

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <StatCard title="Total Price" value={formatCurrency(Number(p.totalPrice))} icon={DollarSign} />
        <StatCard title="Current Value" value={formatCurrency(Number(p.currentValue ?? p.totalPrice))} icon={Building2} />
        <StatCard title="Total Paid" value={formatCurrency(totalPaid)} icon={CheckCircle} />
        <StatCard title="Remaining" value={formatCurrency(remaining)} icon={Calendar} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Installments</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Installment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Installment</DialogTitle></DialogHeader>
            <form onSubmit={handleAddInstallment} className="space-y-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input name="amount" type="number" step="0.01" min="0" required />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input name="dueDate" type="date" required />
              </div>
              <Button type="submit" className="w-full">Add</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Paid Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {installments.map((inst, i) => (
                <TableRow key={inst.id as string}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{formatCurrency(Number(inst.amount))}</TableCell>
                  <TableCell>{format(new Date(inst.dueDate as string), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{inst.paidDate ? format(new Date(inst.paidDate as string), "MMM dd, yyyy") : "-"}</TableCell>
                  <TableCell>
                    <Badge variant={inst.status === "paid" ? "default" : inst.status === "overdue" ? "destructive" : "secondary"}>
                      {inst.status as string}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {inst.status !== "paid" && (
                      <Button size="sm" variant="outline" onClick={() => markPaid(inst.id as string)}>
                        Mark Paid
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {installments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-20 text-muted-foreground">
                    No installments yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
