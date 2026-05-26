"use client"

import { useState } from "react"
import { useProperties, useCreateProperty, useDeleteProperty } from "@/modules/investments/hooks"
import { InvestmentArchiveDialog } from "@/modules/investments/components/archive-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/shared/empty-state"
import { Plus, Building2, Trash2, MapPin, Archive } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { toast } from "sonner"
import Link from "next/link"

export default function RealEstatePage() {
  const { data: properties = [], isLoading } = useProperties()
  const createProperty = useCreateProperty()
  const deleteProperty = useDeleteProperty()
  const [open, setOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)

  const totalValue = (properties as Record<string, unknown>[]).reduce(
    (sum: number, p: Record<string, unknown>) => sum + Number(p.currentValue ?? p.totalPrice),
    0
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createProperty.mutate(
      {
        name: fd.get("name") as string,
        location: (fd.get("location") as string) || undefined,
        totalPrice: Number(fd.get("totalPrice")),
        downPayment: Number(fd.get("downPayment") || 0),
        currentValue: Number(fd.get("currentValue")) || undefined,
        purchaseDate: fd.get("purchaseDate") as string,
        notes: (fd.get("notes") as string) || undefined,
      },
      {
        onSuccess: () => { setOpen(false); toast.success("Property added") },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader title="Real Estate" description={`Total value: ${formatCurrency(totalValue)}`}>
        {(properties as Record<string, unknown>[]).length > 0 && (
          <Button variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-900 dark:hover:bg-orange-950" onClick={() => setArchiveOpen(true)}>
            <Archive className="mr-2 h-4 w-4" /> Archive All
          </Button>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Property</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Property</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input name="name" placeholder="e.g. DHA Phase 8 Plot" required />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input name="location" placeholder="e.g. DHA Phase 8, Lahore" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Price</Label>
                  <Input name="totalPrice" type="number" step="0.01" min="0" required />
                </div>
                <div className="space-y-2">
                  <Label>Down Payment</Label>
                  <Input name="downPayment" type="number" step="0.01" min="0" defaultValue="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Current Value (est.)</Label>
                  <Input name="currentValue" type="number" step="0.01" min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Purchase Date</Label>
                  <Input name="purchaseDate" type="date" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea name="notes" />
              </div>
              <Button type="submit" className="w-full" disabled={createProperty.isPending}>
                {createProperty.isPending ? "Adding..." : "Add Property"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {(properties as Record<string, unknown>[]).length === 0 ? (
        <EmptyState icon={Building2} title="No properties" description="Track your real estate investments here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(properties as Record<string, unknown>[]).map((p) => {
            const totalPaid = Number(p.downPayment) + ((p.installments as Record<string, unknown>[]) || [])
              .filter((i: Record<string, unknown>) => i.status === "paid")
              .reduce((sum: number, i: Record<string, unknown>) => sum + Number(i.amount), 0)
            return (
              <Link key={p.id as string} href={`/investments/real-estate/${p.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base">{p.name as string}</CardTitle>
                    <div className="flex items-center gap-1">
                      <Badge>{p.status as string}</Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => {
                        e.preventDefault()
                        deleteProperty.mutate(p.id as string, { onSuccess: () => toast.success("Deleted") })
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {p.location ? (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {p.location as string}
                      </div>
                    ) : null}
                    <div className="text-2xl font-bold">{formatCurrency(Number(p.currentValue ?? p.totalPrice))}</div>
                    <div className="text-sm text-muted-foreground">
                      Paid: {formatCurrency(totalPaid)} / {formatCurrency(Number(p.totalPrice))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {((p.installments as unknown[]) || []).length} installments · Purchased {format(new Date(p.purchaseDate as string), "MMM yyyy")}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
      <InvestmentArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        type="realestate"
        itemCount={(properties as Record<string, unknown>[]).length}
      />
    </div>
  )
}
