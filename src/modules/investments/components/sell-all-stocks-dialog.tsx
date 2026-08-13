"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Banknote } from "lucide-react"
import { toast } from "sonner"
import { useSellAllStocks } from "../hooks"

interface WalletOption {
  id: string
  name: string
  segments?: { id: string; name: string }[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  symbols: string[]
  lotCount: number
  wallets: WalletOption[]
}

export function SellAllStocksDialog({ open, onOpenChange, symbols, lotCount, wallets }: Props) {
  const sellAll = useSellAllStocks()
  const [amount, setAmount] = useState("")
  const [walletId, setWalletId] = useState("")
  const [segmentId, setSegmentId] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0])
  const [notes, setNotes] = useState("")
  const [confirmInput, setConfirmInput] = useState("")

  const confirmed = confirmInput === "sell all"
  const wallet = wallets.find((w) => w.id === walletId)
  const segments = wallet?.segments ?? []
  const valid = Number(amount) > 0 && !!walletId && confirmed

  function close() {
    setAmount("")
    setWalletId("")
    setSegmentId("")
    setNotes("")
    setConfirmInput("")
    setDate(new Date().toISOString().split("T")[0])
    onOpenChange(false)
  }

  function handleSubmit() {
    if (!valid) return
    sellAll.mutate(
      { amount: Number(amount), date, walletId, segmentId: segmentId || undefined, notes: notes.trim() || undefined },
      {
        onSuccess: (res: { soldLots: number; symbols: string[] }) => {
          toast.success(`Sold ${res.soldLots} position${res.soldLots === 1 ? "" : "s"} across ${res.symbols.length} symbol${res.symbols.length === 1 ? "" : "s"}`)
          close()
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) close() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            Sell Complete Portfolio
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm">
            <p className="text-foreground">
              This will close <span className="font-medium">{lotCount}</span> open position{lotCount === 1 ? "" : "s"} across{" "}
              <span className="font-medium">{symbols.length}</span> symbol{symbols.length === 1 ? "" : "s"} ({symbols.join(", ")}) and mark them as archived.
            </p>
            <p className="text-xs mt-2 text-muted-foreground">
              A sell trade is recorded per open lot at its last known price for your records — the lump sum you enter below is what actually gets credited to your wallet as one inflow, and doesn&rsquo;t need to match exactly.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Amount Received (PKR)</Label>
            <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>

          <div className="space-y-2">
            <Label>Deposit To</Label>
            <Select value={walletId} onValueChange={(v) => { setWalletId(v); setSegmentId("") }}>
              <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
              <SelectContent>
                {wallets.map((w) => (<SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {segments.length > 0 && (
            <div className="space-y-2">
              <Label>Segment <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={segmentId} onValueChange={setSegmentId}>
                <SelectTrigger><SelectValue placeholder="No segment" /></SelectTrigger>
                <SelectContent>
                  {segments.map((seg) => (<SelectItem key={seg.id} value={seg.id}>{seg.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input placeholder="e.g. Liquidated ahead of move abroad" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">
              Type <span className="font-mono font-semibold text-foreground">sell all</span> to confirm
            </Label>
            <Input
              placeholder="sell all"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              className={confirmed ? "border-blue-500 focus-visible:ring-blue-500/30" : ""}
            />
          </div>

          <Button className="w-full" disabled={!valid || sellAll.isPending} onClick={handleSubmit}>
            {sellAll.isPending ? "Selling..." : "Sell Complete Portfolio"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
