"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Barcode,
  Calendar,
  Edit,
  Hash,
  Package,
  Tag,
  Truck,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useStore } from "@/lib/store"
import { formatCurrency, formatDate, generateAvatarColor, getInitials } from "@/lib/utils"
import { AddProductDialog } from "@/components/inventory/add-product-dialog"
import { BuyStockDialog } from "@/components/inventory/buy-stock-dialog"
import { SellDialog } from "@/components/inventory/sell-dialog"
import { useShopQuery } from "@/lib/use-shop-query"
import { pageTransactions, type TransactionPage } from "@/lib/navigation-data"
import { PageLoadState, PageRefreshState } from "@/components/page-load-state"

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { products, transactions } = useStore()
  const product = products.find((p) => p.id === params.id)
  const query = useShopQuery<TransactionPage>('transactions', { variantId: params.id })

  const [editOpen, setEditOpen] = React.useState(false)
  const [buyOpen, setBuyOpen] = React.useState(false)
  const [sellOpen, setSellOpen] = React.useState(false)

  if (!product) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Package className="mx-auto mb-2 h-10 w-10 opacity-50" />Product not found.
        </CardContent></Card>
      </div>
    )
  }

  const relatedTx = (query.remote ? query.data ? pageTransactions(query.data) : [] : transactions)
    .filter((t) => t.items.some((i) => i.productId === product.id))
    .slice(0, 8)
  const totalSold = query.data?.unitsSold ?? relatedTx
    .filter((t) => t.type === "SALE")
    .reduce((s, t) => s + t.items.filter(i=>i.productId===product.id).reduce((a,i)=>a+i.quantity,0), 0)
  const profitPerUnit = product.sellPrice - product.buyPrice

  const low = product.stock <= product.lowStockThreshold
  const out = product.stock === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">{product.name}</h2>
          <p className="text-sm text-muted-foreground">
            {product.variantName ? `${product.variantName} · ` : ""}
            {product.category}
          </p>
        </div>
        <Button variant="outline" onClick={() => setBuyOpen(true)}>
          <Truck className="mr-2 h-4 w-4" /> Buy
        </Button>
        <Button variant="success" onClick={() => setSellOpen(true)}>
          <Barcode className="mr-2 h-4 w-4" /> Sell
        </Button>
        <Button onClick={() => setEditOpen(true)}>
          <Edit className="mr-2 h-4 w-4" /> Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="p-6 text-center">
            <Avatar className="mx-auto h-24 w-24 text-2xl" style={{ backgroundColor: generateAvatarColor(product.name) }}>
              <AvatarFallback className="bg-transparent text-white">{getInitials(product.name)}</AvatarFallback>
            </Avatar>
            <h3 className="mt-4 text-lg font-semibold">{product.name}</h3>
            {product.variantName && <p className="text-sm text-muted-foreground">{product.variantName}</p>}
            <div className="mt-4 flex justify-center gap-2">
              {out ? <Badge variant="destructive">Out of Stock</Badge> : low ? <Badge variant="warning">Low Stock</Badge> : <Badge variant="success">In Stock</Badge>}
              <Badge variant="outline">{product.measuringUnit}</Badge>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 text-left">
              <div><p className="text-xs text-muted-foreground">Stock</p><p className="text-lg font-bold">{product.stock}</p></div>
              <div><p className="text-xs text-muted-foreground">Sell Price</p><p className="text-lg font-bold text-success">{formatCurrency(product.sellPrice)}</p></div>
              <div><p className="text-xs text-muted-foreground">Buy Price</p><p className="text-lg font-semibold">{formatCurrency(product.buyPrice)}</p></div>
              <div><p className="text-xs text-muted-foreground">Profit/Unit</p><p className="text-lg font-semibold text-brand-600">{formatCurrency(profitPerUnit)}</p></div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground"><Hash className="h-4 w-4"/><p className="text-xs font-medium">SKU / Code</p></div><p className="mt-1 font-mono text-sm">{product.variantCode || "—"}</p></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground"><Barcode className="h-4 w-4"/><p className="text-xs font-medium">Barcode</p></div><p className="mt-1 font-mono text-sm">{product.barcode || "—"}</p></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground"><TrendingUp className="h-4 w-4"/><p className="text-xs font-medium">Total Sold</p></div><p className="mt-1 font-semibold">{query.remote && !query.data ? '—' : `${totalSold} units`}</p></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground"><Tag className="h-4 w-4"/><p className="text-xs font-medium">Low Threshold</p></div><p className="mt-1 font-semibold">{product.lowStockThreshold} units</p></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4"/><p className="text-xs font-medium">Last Sold</p></div><p className="mt-1 font-semibold text-sm">{product.lastSoldDate ? formatDate(product.lastSoldDate) : "Never"}</p></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4"/><p className="text-xs font-medium">Added</p></div><p className="mt-1 font-semibold text-sm">{formatDate(product.createdAt)}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
            <CardContent>
              {query.remote && query.data && <PageRefreshState loading={query.loading} error={query.error} retry={query.retry} />}
              {query.remote && !query.data ? <PageLoadState error={query.error} retry={query.retry} /> : relatedTx.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No transactions for this product yet.</p>
              ) : (
                <div className="space-y-2">
                  {relatedTx.map((t) => {
                    const qty = t.items.find(i=>i.productId===product.id)?.quantity ?? 0
                    return (
                      <div key={t.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                        <div>
                          <p className="font-medium">
                            {t.type === "SALE" ? `Sold to ${t.customerName}` : `Bought from ${t.supplierName}`}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDate(t.createdAt)} · {t.paymentMethod}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={t.type === "SALE" ? "success" : "warning"}>{qty} units</Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AddProductDialog open={editOpen} onOpenChange={setEditOpen} product={product} />
      <BuyStockDialog open={buyOpen} onOpenChange={setBuyOpen} prefillProduct={product} />
      <SellDialog open={sellOpen} onOpenChange={setSellOpen} prefillProduct={product} />
    </div>
  )
}
