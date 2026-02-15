"use client"

import { useState } from "react"
import { useCategories, useCreateCategory, useDeleteCategory } from "@/modules/expenses/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { Plus, Tag, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories()
  const createCategory = useCreateCategory()
  const deleteCategory = useDeleteCategory()
  const [open, setOpen] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createCategory.mutate(
      {
        name: fd.get("name") as string,
        type: fd.get("type") as string,
        color: fd.get("color") as string || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false)
          toast.success("Category created")
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader title="Categories" description="Manage expense and income categories">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Category</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Category</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input name="name" placeholder="e.g. Food, Transport" required />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select name="type" required>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Color (optional)</Label>
                <Input name="color" type="color" defaultValue="#6366f1" />
              </div>
              <Button type="submit" className="w-full" disabled={createCategory.isPending}>
                {createCategory.isPending ? "Creating..." : "Create Category"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {(categories as Record<string, unknown>[]).length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No categories yet"
          description="Add categories to organize your transactions."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(categories as Record<string, unknown>[]).map((cat) => (
            <Card key={cat.id as string}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {cat.color ? (
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: cat.color as string }} />
                  ) : null}
                  <div>
                    <p className="font-medium">{cat.name as string}</p>
                    <p className="text-xs text-muted-foreground">
                      {((cat._count as Record<string, number>)?.transactions || 0)} transactions
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={(cat.type as string) === "income" ? "default" : "destructive"}>
                    {cat.type as string}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      deleteCategory.mutate(cat.id as string, {
                        onSuccess: () => toast.success("Category deleted"),
                      })
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
