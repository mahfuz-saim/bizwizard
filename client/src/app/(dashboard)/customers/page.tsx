"use client"

import * as React from "react"
import { Phone, Plus, Search, UserPlus, Users } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useStore } from "@/lib/store"
import { formatCurrency, generateAvatarColor, getInitials } from "@/lib/utils"
import { usePagination } from "@/lib/use-pagination"
import { PaginationBar } from "@/components/ui/pagination-bar"

export default function CustomersPage() {
  const { customers } = useStore()
  const [search, setSearch] = React.useState("")
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    )
  }, [customers, search])

  const { page, setPage, pageCount, pageItems, rangeStart, rangeEnd, total } = usePagination(
    filtered,
    12,
    search
  )

  const totalDue = customers.reduce((s, c) => s + c.totalDue, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Customers</h2>
          <p className="text-sm text-muted-foreground">Manage customers, their purchases and dues.</p>
        </div>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

      <div className="metric-grid grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Customers</p>
          <p className="mt-1 text-2xl font-bold">{customers.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Receivable</p>
          <p className="mt-1 text-2xl font-bold text-destructive">{formatCurrency(totalDue)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Top Customer</p>
          <p className="mt-1 text-base font-semibold truncate">
            {[...customers].sort((a, b) => b.totalPurchased - a.totalPurchased)[0]?.name || "—"}
          </p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search customers..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
        <div className="grid grid-cols-1 gap-3 p-3 sm:p-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 h-8 w-8 opacity-50" />
              No customers found
            </p>
          ) : pageItems.map((c) => (
            <div key={c.id} className="contact-card flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-brand-400 hover:shadow-sm">
              <Avatar className="h-11 w-11" style={{ backgroundColor: generateAvatarColor(c.name) }}>
                <AvatarFallback className="bg-transparent text-white">{getInitials(c.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</p>
                <p className="text-xs text-muted-foreground">{c.address || "No address"}</p>
              </div>
              <div className="text-right">
                {c.totalDue > 0 ? (
                  <Badge variant="destructive">Due {formatCurrency(c.totalDue)}</Badge>
                ) : (
                  <Badge variant="success">Paid up</Badge>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(c.totalPurchased)} bought</p>
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
            itemLabel="customers"
          />
        </CardContent>
      </Card>
    </div>
  )
}
