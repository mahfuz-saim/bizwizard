"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Package } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { formatCurrency } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { useShopQuery } from "@/lib/use-shop-query"
import type { ReportSummary } from "@/lib/navigation-data"
import { PageLoadState, PageRefreshState } from "@/components/page-load-state"

export function ReportsPanel() {
  const { transactions, products, stats } = useStore()
  const query = useShopQuery<ReportSummary>('reports')
  const sales = transactions.filter(t => t.type === "SALE")
  const totalRevenue = query.data?.totalRevenue ?? sales.reduce((s,t)=>s+t.total,0)
  const totalCost = query.data?.totalCost ?? sales.reduce((s,t)=> s + (t.cost ?? t.items.reduce((a,it)=>{const p = products.find(x=>x.id===it.productId); return a + (p?.buyPrice||0)*it.quantity;},0)),0)
  const profit = totalRevenue - totalCost
  const now = new Date()
  const weekStart = new Date(now); weekStart.setUTCHours(0,0,0,0); weekStart.setUTCDate(weekStart.getUTCDate() - 6)
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const revenueSince = (date: Date) => sales.filter(s => new Date(s.createdAt) >= date).reduce((n, s) => n + s.total, 0)
  const months = Array.from({length:12}, (_, i) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1))
    const key = date.toISOString().slice(0,7)
    return { key, label: date.toLocaleDateString(undefined, {month:"short",year:"2-digit",timeZone:"UTC"}), total: query.data ? query.data.months.find(m => m.key === key)?.total ?? 0 : sales.filter(s => s.createdAt.slice(0,7) === key).reduce((n,s) => n+s.total,0) }
  })
  const maxMonth = Math.max(1, ...months.map(m => m.total))
  if (query.remote && !query.data) return <PageLoadState error={query.error} retry={query.retry} />

  return (
    <div className="space-y-6">
      {query.remote && <PageRefreshState loading={query.loading} error={query.error} retry={query.retry} />}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports & Analytics</h2>
          <p className="text-sm text-muted-foreground">Understand your sales, profits, and inventory performance.</p>
        </div>
        <Button variant="outline" disabled title="Export is not yet connected"><Download className="mr-2 h-4 w-4"/> Export Report</Button>
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales Report</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="profit">Profit & Loss</TabsTrigger>
        </TabsList>
        <TabsContent value="sales" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Today</p><p className="mt-1 text-2xl font-bold">{formatCurrency(stats.todaySell)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Last 7 Days</p><p className="mt-1 text-2xl font-bold">{formatCurrency(query.data?.weekRevenue ?? revenueSince(weekStart))}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">This Month</p><p className="mt-1 text-2xl font-bold">{formatCurrency(query.data?.monthRevenue ?? revenueSince(monthStart))}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Sales Over Time (last 12 months, UTC)</CardTitle></CardHeader>
            <CardContent>
              <div className="flex h-56 items-end gap-2">
                {months.map((m)=>(
                  <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <div className="w-full rounded-t bg-gradient-to-t from-brand-600 to-brand-400" title={formatCurrency(m.total)} style={{height:`${m.total / maxMonth * 85}%`}}/>
                    <span className="text-[10px] text-muted-foreground">{m.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="inventory" className="mt-4">
          <Card><CardContent className="p-6 text-center text-muted-foreground"><Package className="mx-auto mb-2 h-10 w-10"/>Detailed inventory analytics coming soon.</CardContent></Card>
        </TabsContent>
        <TabsContent value="profit" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Revenue</p><p className="mt-1 text-2xl font-bold">{formatCurrency(totalRevenue)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cost</p><p className="mt-1 text-2xl font-bold">{formatCurrency(totalCost)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Gross Profit (before operating expenses)</p><p className="mt-1 text-2xl font-bold text-success">{formatCurrency(profit)}</p></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
