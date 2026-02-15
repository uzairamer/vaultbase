"use client"

import { useState } from "react"
import Papa from "papaparse"
import { useWallets, useImportTransactions } from "@/modules/expenses/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Upload, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"

interface CSVRow {
  date: string
  amount: string | number
  type: string
  description?: string
  category?: string
}

export default function ImportPage() {
  const { data: wallets = [] } = useWallets()
  const importTx = useImportTransactions()
  const [walletId, setWalletId] = useState("")
  const [rows, setRows] = useState<CSVRow[]>([])
  const [fileName, setFileName] = useState("")

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setRows(result.data)
        toast.success(`Parsed ${result.data.length} rows`)
      },
      error: () => toast.error("Failed to parse CSV"),
    })
  }

  function handleImport() {
    if (!walletId) return toast.error("Select a wallet")
    if (rows.length === 0) return toast.error("No data to import")

    importTx.mutate(
      {
        walletId,
        rows: rows.map((r) => ({
          date: r.date,
          amount: Number(r.amount),
          type: r.type || (Number(r.amount) >= 0 ? "inflow" : "outflow"),
          description: r.description,
          category: r.category,
        })),
      },
      {
        onSuccess: (data) => {
          toast.success(`Imported ${(data as Record<string, number>).imported} transactions`)
          setRows([])
          setFileName("")
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  return (
    <div>
      <PageHeader title="Import Transactions" description="Import transactions from a CSV file" />

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Wallet</Label>
              <Select value={walletId} onValueChange={setWalletId}>
                <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
                <SelectContent>
                  {(wallets as Record<string, string>[]).map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>CSV File</Label>
              <Input type="file" accept=".csv" onChange={handleFile} />
              {fileName && <p className="text-sm text-muted-foreground">{fileName}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expected Format</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">Your CSV should have these columns:</p>
            <code className="text-xs bg-muted p-2 rounded block">
              date, amount, type, description, category
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              Type can be &quot;income&quot; or &quot;expense&quot;. Category is optional and will be matched by name.
            </p>
          </CardContent>
        </Card>
      </div>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Preview ({rows.length} rows)</CardTitle>
            <Button onClick={handleImport} disabled={importTx.isPending}>
              <Upload className="mr-2 h-4 w-4" />
              {importTx.isPending ? "Importing..." : "Import All"}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.amount}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell>{row.description || "-"}</TableCell>
                      <TableCell>{row.category || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 50 && (
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Showing first 50 of {rows.length} rows
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
