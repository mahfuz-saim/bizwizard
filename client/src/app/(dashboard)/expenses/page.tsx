"use client"

import * as React from "react"
import { Plus, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { useStore } from "@/lib/store"
import { formatCurrency, formatDate } from "@/lib/utils"
import { usePagination } from "@/lib/use-pagination"
import { PaginationBar } from "@/components/ui/pagination-bar"
import { useShopQuery } from "@/lib/use-shop-query"
import { pageRange, type ExpensePage } from "@/lib/navigation-data"
import { PageLoadState, PageRefreshState } from "@/components/page-load-state"

export default function ExpensesPage() {
  const { expenses, session } = useStore()
  const [remotePage, setRemotePage] = React.useState(1)
  const query = useShopQuery<ExpensePage>('expenses', { page: remotePage })
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthTotal = query.data?.monthTotal ?? expenses.filter(e => e.date.slice(0, 7) === currentMonth).reduce((n, e) => n + e.amount, 0)
  const totalAmount = query.data?.totalAmount ?? expenses.reduce((s, e) => s + e.amount, 0)
  const local = usePagination(expenses, 10)
  const { page, pageCount, rangeStart, rangeEnd, total: totalCount } = query.remote && query.data ? pageRange(query.data.page, query.data.total) : local
  const pageItems = query.remote && query.data ? query.data.rows : local.pageItems
  const setPage = query.remote ? setRemotePage : local.setPage
  if (session?.role === "EMPLOYEE") return <p>Expense records are available to the shop owner only.</p>
  if (query.remote && !query.data) return <PageLoadState error={query.error} retry={query.retry} />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Expenses</h2>
          <p className="text-sm text-muted-foreground">Track shop expenses: rent, utilities, salaries, and more.</p>
        </div>
        <Button disabled title="Expense creation is not connected"><Plus className="mr-2 h-4 w-4" /> Add Expense</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Total Expenses</p><p className="mt-1 text-2xl font-bold text-destructive">{formatCurrency(totalAmount)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">This Month</p><p className="mt-1 text-2xl font-bold">{formatCurrency(monthTotal)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Categories</p><p className="mt-1 text-2xl font-bold">{query.data?.categories ?? new Set(expenses.map(e => e.category)).size}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Expenses</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            {query.remote && <PageRefreshState loading={query.loading} error={query.error} retry={query.retry} />}
            <Table aria-busy={query.remote && query.loading}>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No expenses recorded yet.</TableCell></TableRow>
                ) : pageItems.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{formatDate(e.date)}</TableCell>
                    <TableCell><Badge variant="secondary">{e.category}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.note || "—"}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">{formatCurrency(e.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              total={totalCount}
              itemLabel="expenses"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
