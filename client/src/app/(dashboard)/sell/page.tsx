"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Barcode, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SellDialog } from "@/components/inventory/sell-dialog"

export default function SellPage() {
  const router = useRouter()
  const [open, setOpen] = React.useState(true)
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Point of Sale</h2>
          <p className="text-sm text-muted-foreground">Scan barcodes or search products to start a sale.</p>
        </div>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
            <Barcode className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold">Ready to sell?</h3>
          <p className="mt-1 text-sm text-muted-foreground">Click the button below to open the sale dialog.</p>
          <Button className="mt-4" onClick={() => setOpen(true)}>
            <ShoppingCart className="mr-2 h-4 w-4" /> Open Sale Terminal
          </Button>
        </CardContent>
      </Card>
      <SellDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) router.push("/sales")
        }}
      />
    </div>
  )
}
