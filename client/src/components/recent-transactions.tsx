"use client"

import Link from "next/link"
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { Transaction } from "@/lib/types"

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Recent Transactions</CardTitle>
        <Link
          href="/sales"
          className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="divide-y">
        {transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No transactions yet
          </p>
        ) : (
          transactions.map((t) => {
            const isSale = t.type === "SALE"
            return (
              <div key={t.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    isSale ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                  }`}
                >
                  {isSale ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {isSale ? t.customerName : t.supplierName}
                    </p>
                    <Badge variant={isSale ? "success" : "warning"} className="text-[10px]">
                      {isSale ? "SALE" : "BUY"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(t.createdAt)} · {t.items.length} item{t.items.length > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${isSale ? "text-success" : "text-foreground"}`}>
                    {isSale ? "+" : "-"}
                    {formatCurrency(t.total)}
                  </p>
                  {t.due > 0 && (
                    <p className="text-xs text-destructive">Due {formatCurrency(t.due)}</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
