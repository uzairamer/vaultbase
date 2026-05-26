"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Archive } from "lucide-react"
import { toast } from "sonner"
import { useArchiveInvestments } from "../hooks"

type ArchiveType = "stocks" | "commodities" | "realestate"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: ArchiveType
  itemCount: number
}

const LABELS: Record<ArchiveType, { title: string; noun: string; nounPlural: string }> = {
  stocks: { title: "stock portfolio", noun: "holding", nounPlural: "holdings" },
  commodities: { title: "commodity portfolio", noun: "holding", nounPlural: "holdings" },
  realestate: { title: "real estate portfolio", noun: "property", nounPlural: "properties" },
}

export function InvestmentArchiveDialog({ open, onOpenChange, type, itemCount }: Props) {
  const archive = useArchiveInvestments()
  const [confirmInput, setConfirmInput] = useState("")
  const confirmed = confirmInput === "archive me"
  const { title, noun, nounPlural } = LABELS[type]

  function close() {
    setConfirmInput("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) close() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <Archive className="h-4 w-4" />
            Archive & reset {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-3 text-sm">
            <p className="text-foreground">
              This will archive all <span className="font-medium">{itemCount}</span> active{" "}
              {itemCount === 1 ? noun : nounPlural} and remove them from the active view.
            </p>
            <p className="text-xs mt-2 text-muted-foreground">
              Archived data is hidden from analytics and dashboards but preserved in the database for audit. Start fresh by adding new {nounPlural} from your latest statements.
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">
              Type <span className="font-mono font-semibold text-foreground">archive me</span> to confirm
            </Label>
            <Input
              placeholder="archive me"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              autoFocus
              className={confirmed ? "border-orange-500 focus-visible:ring-orange-500/30" : ""}
            />
          </div>
          <Button
            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            disabled={!confirmed || archive.isPending || itemCount === 0}
            onClick={() => {
              archive.mutate(type, {
                onSuccess: (res: { archived: number }) => {
                  toast.success(`Archived ${res.archived} ${res.archived === 1 ? noun : nounPlural}.`)
                  close()
                },
                onError: (err) => toast.error(err.message),
              })
            }}
          >
            {archive.isPending ? "Archiving..." : `Archive & reset ${nounPlural}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
