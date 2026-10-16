"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileDown,
  Filter,
  Plus,
  Receipt,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useStore } from "@/lib/store"

export default function SalesPage() {
  const { transactions } = useStore()
  const [tab, setTab] = React.useState("all")
  const [search, setSearch] = React.useState("")

  const filtered = React.useMemo(() => {
    let list = [...transactions].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    if (tab === "sale") list = list.filter((t) => t.type === "SALE")
    if (tab === "buy") list = list.filter((t) => t.type === "BUY")
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (t) =>
          (t.customerName || "").toLowerCase().includes(q) ||
          (t.supplierName || "").toLowerCase().includes(q) ||
          (t.note || "").toLowerCase().includes(q)
      )
    }
    return list
  }, [transactions, tab, search])

  const totalSales = transactions.filter((t) => t.type === "SALE").reduce((s, t) => s + t.total, 0)
  const totalPurchases = transactions.filter((t) => t.type === "BUY").reduce((s, t) => s + t.total, 0)
  const totalDue = transactions.reduce((s, t) => s + (t.due || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sales & Purchases</h2>
          <p className="text-sm text-muted-foreground">Track all your sale and purchase transactions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline">
            <FileDown className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button asChild>
            <Link href="/sell"><Plus className="mr-2 h-4 w-4" /> New Sale</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Sales</p>
          <p className="mt-1 text-2xl font-bold text-success">{formatCurrency(totalSales)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Purchases</p>
          <p className="mt-1 text-2xl font-bold text-warning">{formatCurrency(totalPurchases)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Outstanding Due</p>
          <p className="mt-1 text-2xl font-bold text-destructive">{formatCurrency(totalDue)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">Transactions</CardTitle>
            <div className="flex gap-2">
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab} className="mb-4">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="sale">Sales</TabsTrigger>
              <TabsTrigger value="buy">Purchases</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    <Receipt className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    No transactions yet
                  </TableCell></TableRow>
                ) : (
                  filtered.map((t) => {
                    const isSale = t.type === "SALE"
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap text-sm">{formatDate(t.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant={isSale ? "success" : "warning"} className="gap-1">
                            {isSale ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                            {t.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {isSale ? t.customerName : t.supplierName}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.items.length} items</TableCell>
                        <TableCell>
                          <Badge variant="outline">{t.paymentMethod === "UNKNOWN" ? "Not recorded" : t.paymentMethod}</Badge>
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${isSale ? "text-success" : ""}`}>
                          {formatCurrency(t.total)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${t.due > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {t.paymentTracked === false ? "Not tracked" : t.due > 0 ? formatCurrency(t.due) : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
