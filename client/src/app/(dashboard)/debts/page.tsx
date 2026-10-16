"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Plus, Receipt } from "lucide-react"
import { useStore } from "@/lib/store"
import { formatCurrency } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { generateAvatarColor, getInitials } from "@/lib/utils"

export default function DebtsPage() {
  const { customers, suppliers, source } = useStore()

  const receivable = customers.filter(c => c.totalDue > 0)
  const payable = suppliers.filter(s => s.totalDue > 0)
  const totalReceivable = receivable.reduce((s, c) => s + c.totalDue, 0)
  const totalPayable = payable.reduce((s, x) => s + x.totalDue, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Debts & Ledgers</h2>
          <p className="text-sm text-muted-foreground">Track receivables from customers and payables to suppliers.</p>
        </div>
        <Button disabled title="Payment recording is not yet connected"><Plus className="mr-2 h-4 w-4" /> Record Payment</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card><CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground">You will receive</p>
          <p className="mt-1 text-2xl font-bold text-success">{formatCurrency(totalReceivable)}</p>
          <p className="text-xs text-muted-foreground">From {receivable.length} customers</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground">You will pay</p>
          <p className="mt-1 text-2xl font-bold text-destructive">{source === "mock" ? formatCurrency(totalPayable) : "Not tracked"}</p>
          <p className="text-xs text-muted-foreground">To {payable.length} suppliers</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Debt Overview</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="receivable">
            <TabsList>
              <TabsTrigger value="receivable">Receivable ({receivable.length})</TabsTrigger>
              <TabsTrigger value="payable">Payable ({payable.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="receivable" className="mt-4 space-y-2">
              {receivable.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground"><Receipt className="mx-auto mb-2 h-8 w-8 opacity-50"/>No pending dues. 🎉</p> :
                receivable.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <Avatar className="h-10 w-10" style={{ backgroundColor: generateAvatarColor(c.name) }}>
                      <AvatarFallback className="bg-transparent text-white">{getInitials(c.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1"><p className="font-medium text-sm">{c.name}</p><p className="text-xs text-muted-foreground">{c.phone}</p></div>
                    <div className="text-right">
                      <Badge variant="destructive">{formatCurrency(c.totalDue)}</Badge>
                    </div>
                  </div>
                ))}
            </TabsContent>
            <TabsContent value="payable" className="mt-4 space-y-2">
              {payable.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{source === "mock" ? "No pending payables." : "Supplier payment balances are not tracked by the backend."}</p> :
                payable.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <Avatar className="h-10 w-10" style={{ backgroundColor: generateAvatarColor(s.name) }}>
                      <AvatarFallback className="bg-transparent text-white">{getInitials(s.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1"><p className="font-medium text-sm">{s.name}</p><p className="text-xs text-muted-foreground">{s.phone}</p></div>
                    <Badge variant="warning">{formatCurrency(s.totalDue)}</Badge>
                  </div>
                ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
