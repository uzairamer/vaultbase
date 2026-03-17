"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { KeyRound, CheckCircle2, Trash2, Eye, EyeOff, AlertCircle, Wand2, X } from "lucide-react"

export const TOKEN_KEY   = "ahltd-token"
export const SESSION_KEY = "ahltd-session"

function parseCurl(raw: string): { token?: string; session?: string } {
  // Match: -H 'Authorization: Bearer <token>' or -H "Authorization: Bearer <token>"
  const tokenMatch = raw.match(/[Aa]uthorization['":\s]+Bearer\s+([A-Za-z0-9\-_=.]+)/)
  const token = tokenMatch?.[1]

  // Match laravel_session=<value> anywhere in the curl (Cookie header or -b flag)
  const sessionMatch = raw.match(/laravel_session=([A-Za-z0-9%\-_=.+/]+)/)
  const session = sessionMatch?.[1]

  return { token, session }
}

function SecretField({
  id, label, placeholder, hint, value, onChange,
}: {
  id: string; label: string; placeholder: string; hint: string
  value: string; onChange: (v: string) => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10 font-mono text-xs"
        />
        <button
          type="button"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setShow((v) => !v)}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export default function ConfigsPage() {
  const [token, setToken]     = useState("")
  const [session, setSession] = useState("")
  const [saved, setSaved]     = useState(false)
  const [curlInput, setCurlInput] = useState("")

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY)
    const s = localStorage.getItem(SESSION_KEY)
    if (t) setToken(t)
    if (s) setSession(s)
    if (t && s) setSaved(true)
  }, [])

  function handleParseCurl() {
    const { token: t, session: s } = parseCurl(curlInput)
    let found = 0
    if (t) { setToken(t); setSaved(false); found++ }
    if (s) { setSession(s); setSaved(false); found++ }

    if (found === 2) {
      toast.success("Both credentials extracted — review and save below")
      setCurlInput("")
    } else if (found === 1) {
      toast.warning(
        t ? "Bearer token extracted — laravel_session not found" : "laravel_session extracted — Bearer token not found"
      )
    } else {
      toast.error("Could not find credentials in the pasted curl command")
    }
  }

  function handleSave() {
    if (!token.trim())   { toast.error("Bearer token cannot be empty"); return }
    if (!session.trim()) { toast.error("Session cookie cannot be empty"); return }
    localStorage.setItem(TOKEN_KEY,   token.trim())
    localStorage.setItem(SESSION_KEY, session.trim())
    setSaved(true)
    toast.success("Credentials saved")
  }

  function handleClear() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(SESSION_KEY)
    setToken(""); setSession(""); setSaved(false)
    toast.success("Credentials cleared")
  }

  const dirty = !saved || token !== (localStorage.getItem(TOKEN_KEY) ?? "") || session !== (localStorage.getItem(SESSION_KEY) ?? "")

  return (
    <div>
      <PageHeader title="Configurations" description="Manage API tokens and external service settings" />

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" />
              Arif Habib Securities
            </CardTitle>
            <CardDescription>
              Required for Company Profile financial statements. Log in at{" "}
              <span className="font-mono text-xs">data.arifhabibltd.com</span>, open DevTools →
              Network, right-click any API request → Copy as cURL, then paste below.
              Everything is stored only in your browser&apos;s local storage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* cURL paste box */}
            <div className="space-y-2">
              <Label htmlFor="curl-input" className="flex items-center gap-1.5">
                <Wand2 className="h-3.5 w-3.5 text-muted-foreground" />
                Paste cURL Command
                <span className="text-xs font-normal text-muted-foreground ml-1">— auto-extracts both credentials</span>
              </Label>
              <div className="relative">
                <Textarea
                  id="curl-input"
                  placeholder={`curl 'https://data.arifhabibltd.com/...' \\\n  -H 'Authorization: Bearer eyJ...' \\\n  -H 'Cookie: laravel_session=eyJ...'`}
                  value={curlInput}
                  onChange={(e) => setCurlInput(e.target.value)}
                  className="font-mono text-xs resize-none h-24 pr-8"
                />
                {curlInput && (
                  <button
                    type="button"
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setCurlInput("")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleParseCurl}
                disabled={!curlInput.trim()}
                className="gap-1.5"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Extract Credentials
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-2 text-xs text-muted-foreground">or enter manually</span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-yellow-500" />
              <span>
                This API requires <strong>both</strong> a Bearer token and a session cookie.
                The Bearer token is in the <span className="font-mono">Authorization</span> header;
                the session value is the <span className="font-mono">laravel_session</span> cookie.
              </span>
            </div>

            {saved && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Credentials saved — Company Profile is ready to use.
              </div>
            )}

            <SecretField
              id="token"
              label="Bearer Token"
              placeholder="eyJ0eXAiOiJKV1QiLCJhbGci..."
              hint='Copy from Authorization header (without the "Bearer " prefix).'
              value={token}
              onChange={(v) => { setToken(v); setSaved(false) }}
            />

            <SecretField
              id="session"
              label="laravel_session Cookie"
              placeholder="eyJpdiI6Ik..."
              hint="Copy the value of the laravel_session cookie from any request to data.arifhabibltd.com."
              value={session}
              onChange={(v) => { setSession(v); setSaved(false) }}
            />

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!token.trim() || !session.trim() || !dirty}>
                {saved && !dirty ? "Saved" : "Save Credentials"}
              </Button>
              {(saved || token || session) && (
                <Button variant="outline" onClick={handleClear} className="gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
