"use client"

import * as React from "react"
import { Phone, Plus, Search, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useStore } from "@/lib/store"
import { formatCurrency, generateAvatarColor, getInitials } from "@/lib/utils"
import { usePagination } from "@/lib/use-pagination"
import { PaginationBar } from "@/components/ui/pagination-bar"

export default function SuppliersPage() {
  const { suppliers, source } = useStore()
  const [search, setSearch] = React.useState("")
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || s.phone.includes(q)
    )
  }, [suppliers, search])

  const { page, setPage, pageCount, pageItems, rangeStart, rangeEnd, total } = usePagination(
    filtered,
    12,
    search
  )

  const totalDue = suppliers.reduce((s, x) => s + x.totalDue, 0)
  const totalPaid = suppliers.reduce((s, x) => s + x.totalPaid, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Suppliers</h2>
          <p className="text-sm text-muted-foreground">Track your suppliers, payables and purchases.</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" /> Add Supplier</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Total Suppliers</p><p className="mt-1 text-2xl font-bold">{suppliers.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Total Payable</p><p className="mt-1 text-2xl font-bold text-destructive">{source === "mock" ? formatCurrency(totalDue) : "Not tracked"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">{source === "mock" ? "Total Paid" : "Purchase Volume"}</p><p className="mt-1 text-2xl font-bold text-success">{source === "mock" ? formatCurrency(totalPaid) : formatCurrency(suppliers.reduce((n, s) => n + (s.totalPurchased || 0), 0))}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search suppliers..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
        <div className="grid grid-cols-1 gap-3 p-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No suppliers found</p>
          ) : pageItems.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border p-3 hover:border-brand-400 hover:shadow-sm">
              <Avatar className="h-11 w-11" style={{ backgroundColor: generateAvatarColor(s.name) }}>
                <AvatarFallback className="bg-transparent text-white">{getInitials(s.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {s.phone}</p>
                <p className="text-xs text-muted-foreground">{s.address || "—"}</p>
              </div>
              <div className="text-right">
                {s.paymentTracked === false ? <Badge variant="outline">Payments not tracked</Badge> : s.totalDue > 0 ? (
                  <Badge variant="warning">Due {formatCurrency(s.totalDue)}</Badge>
                ) : (
                  <Badge variant="success">Settled</Badge>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{s.paymentTracked === false ? `${formatCurrency(s.totalPurchased || 0)} purchased` : `${formatCurrency(s.totalPaid)} paid`}</p>
              </div>
            </div>
          ))}
        </div>
          <PaginationBar
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            total={total}
            itemLabel="suppliers"
          />
        </CardContent>
      </Card>
    </div>
  )
}
