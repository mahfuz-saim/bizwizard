"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileBarChart, Download, TrendingUp, TrendingDown, Package } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { formatCurrency } from "@/lib/utils"
import { useStore } from "@/lib/store"

export default function ReportsPage() {
  const { transactions, products, stats } = useStore()
  const sales = transactions.filter(t => t.type === "SALE")
  const totalRevenue = sales.reduce((s,t)=>s+t.total,0)
  const totalCost = sales.reduce((s,t)=> s + t.items.reduce((a,it)=>{const p = products.find(x=>x.id===it.productId); return a + (p?.buyPrice||0)*it.quantity;},0),0)
  const profit = totalRevenue - totalCost

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports & Analytics</h2>
          <p className="text-sm text-muted-foreground">Understand your sales, profits, and inventory performance.</p>
        </div>
        <Button variant="outline"><Download className="mr-2 h-4 w-4"/> Export Report</Button>
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales Report</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="profit">Profit & Loss</TabsTrigger>
        </TabsList>
        <TabsContent value="sales" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Today</p><p className="mt-1 text-2xl font-bold">{formatCurrency(stats.todaySell)}</p><p className="text-xs text-success flex items-center gap-1"><TrendingUp className="h-3 w-3"/> +12.3%</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">This Week</p><p className="mt-1 text-2xl font-bold">{formatCurrency(totalRevenue*1.8)}</p><p className="text-xs text-success flex items-center gap-1"><TrendingUp className="h-3 w-3"/> +8.1%</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">This Month</p><p className="mt-1 text-2xl font-bold">{formatCurrency(totalRevenue*6)}</p><p className="text-xs text-destructive flex items-center gap-1"><TrendingDown className="h-3 w-3"/> -2.4%</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Sales Over Time (placeholder chart)</CardTitle></CardHeader>
            <CardContent>
              <div className="flex h-56 items-end gap-2">
                {[40, 65, 50, 78, 90, 72, 95, 60, 88, 100, 82, 92].map((h,i)=>(
                  <div key={i} className="flex flex-1 flex-col items-center gap-2">
                    <div className="w-full rounded-t bg-gradient-to-t from-brand-600 to-brand-400" style={{height:`${h}%`}}/>
                    <span className="text-[10px] text-muted-foreground">M{i+1}</span>
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
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Profit</p><p className="mt-1 text-2xl font-bold text-success">{formatCurrency(profit)}</p></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
