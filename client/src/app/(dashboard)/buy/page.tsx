"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BuyStockDialog } from "@/components/inventory/buy-stock-dialog"

export default function BuyPage() {
  const router = useRouter()
  const [open, setOpen] = React.useState(true)
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Record Purchase</h2>
          <p className="text-sm text-muted-foreground">Record new stock bought from a supplier.</p>
        </div>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 text-warning">
            <Truck className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold">Add stock to your inventory</h3>
          <p className="mt-1 text-sm text-muted-foreground">Supplier, products and quantities go here.</p>
          <Button className="mt-4" variant="warning" onClick={() => setOpen(true)}>
            <Truck className="mr-2 h-4 w-4" /> New Purchase Entry
          </Button>
        </CardContent>
      </Card>
      <BuyStockDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) router.push("/sales")
        }}
      />
    </div>
  )
}
