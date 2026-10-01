"use client"

import { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserCog, AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function AccountSettingsPage() {
  const { data: session } = useSession()
  const email = session?.user?.email ?? ""
  const name = session?.user?.name ?? ""

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmInput, setConfirmInput] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const confirmed = email.length > 0 && confirmInput.trim().toLowerCase() === email.toLowerCase()

  function closeDialog() {
    setDeleteOpen(false)
    setConfirmInput("")
  }

  async function handleDelete() {
    if (!confirmed || isDeleting) return
    setIsDeleting(true)
    try {
      const res = await fetch("/api/settings/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: confirmInput.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "Failed to delete account")
      }
      toast.success("Account deleted")
      await signOut({ callbackUrl: "/login" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account")
      setIsDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader title="Account" description="Manage your account" />
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="h-4 w-4" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <p className="text-sm font-medium">{name || "—"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="text-sm font-medium">{email || "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Permanently delete your account and everything in it. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              Delete Account
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteOpen} onOpenChange={(isOpen) => { if (!isOpen) closeDialog() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Delete your entire account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <p className="font-medium">This permanently deletes everything — with no way back.</p>
              <p className="text-xs mt-2 text-destructive/80">
                Every wallet and transaction, receivable and liability, stock, commodity (gold, silver, etc.),
                property, business, income breakdown, watchlist item, and static price setting tied to{" "}
                <span className="font-medium">{email}</span> will be permanently erased, and you&rsquo;ll be signed out immediately after.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">
                Type your email <span className="font-mono font-semibold text-foreground">{email}</span> to confirm
              </Label>
              <Input
                placeholder={email}
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                autoFocus
                className={confirmed ? "border-destructive focus-visible:ring-destructive/30" : ""}
              />
            </div>
            <Button
              variant="destructive"
              className="w-full"
              disabled={!confirmed || isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting everything...
                </>
              ) : (
                "Permanently delete my account"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
