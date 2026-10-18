"use client"

import * as React from "react"
import { Trash2, Truck, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useStore } from "@/lib/store"
import { formatCurrency } from "@/lib/utils"
import type { Product } from "@/lib/types"

interface LineItem {
  productId: string
  quantity: number
  buyPrice: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefillProduct?: Product | null
}

export function BuyStockDialog({ open, onOpenChange, prefillProduct }: Props) {
  const { products, suppliers, addBuy, source } = useStore()
  const [supplierId, setSupplierId] = React.useState<string>("")
  const [supplierName, setSupplierName] = React.useState<string>("")
  const [note, setNote] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [paid, setPaid] = React.useState<number>(0)
  const [items, setItems] = React.useState<LineItem[]>([])

  const reset = React.useCallback(() => {
    setSupplierId("")
    setSupplierName("")
    setNote("")
    setSearch("")
    setPaid(0)
    setItems([])
  }, [])

  React.useEffect(() => {
    if (!open) return
    reset()
    if (prefillProduct) {
      setItems([
        {
          productId: prefillProduct.id,
          quantity: 1,
          buyPrice: prefillProduct.buyPrice || 0
        }
      ])
    }
  }, [open, prefillProduct, reset])

  const addItem = (p: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === p.id)
      if (existing) {
        return prev.map((i) =>
          i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...prev,
        { productId: p.id, quantity: 1, buyPrice: p.buyPrice || 0 }
      ]
    })
    setSearch("")
  }

  const updateItem = (idx: number, patch: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    )
  }

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const productMap = React.useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p])),
    [products]
  )

  const subtotal = items.reduce(
    (s, it) =>
      s +
      (isNaN(it.quantity) || isNaN(it.buyPrice)
        ? 0
        : it.quantity * it.buyPrice),
    0
  )
  const due = Math.max(0, subtotal - paid)

  const filteredProducts = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.variantName || "").toLowerCase().includes(q) ||
          (p.barcode || "").includes(q)
      )
      .slice(0, 8)
  }, [products, search])

  const [saving, setSaving] = React.useState(false)
  const [submitError, setSubmitError] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setSubmitError("")
    try {
      if (items.length === 0) return
      await addBuy({
        supplierId: supplierId || undefined,
        supplierName:
          suppliers.find((s) => s.id === supplierId)?.name ||
          supplierName ||
          "Walk-in Supplier",
        items: items.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          buyPrice: Number(i.buyPrice)
        })),
        paid: Number(paid) || 0,
        note: note || undefined
      })
      onOpenChange(false)
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to save. Please try again."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-warning" />
            Buy Stock (Purchase)
          </DialogTitle>
          <DialogDescription>
            Record a purchase from a supplier. This will increase your stock
            levels.{" "}
            {source !== "mock" &&
              "Only fully paid purchases are supported; supplier payment balances are not recorded by the backend."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Supplier</Label>
              <Select
                value={supplierId}
                onValueChange={(v) => {
                  setSupplierId(v)
                  setSupplierName("")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="newSupplier">Or enter new supplier name</Label>
              <Input
                id="newSupplier"
                placeholder="Supplier name"
                value={supplierName}
                onChange={(e) => {
                  setSupplierName(e.target.value)
                  setSupplierId("")
                }}
              />
            </div>
          </div>

          {/* Product search */}
          <div className="relative">
            <Label>Add Products</Label>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products by name or barcode..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {search && filteredProducts.length > 0 && (
              <Card className="absolute z-20 mt-1 w-full shadow-lg">
                <CardContent className="p-1">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addItem(p)}
                      className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="truncate">
                        <span className="font-medium">{p.name}</span>
                        {p.variantName && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {p.variantName}
                          </span>
                        )}
                      </span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                        Stock: {p.stock}
                      </span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Line items */}
          <div className="rounded-lg border">
            <div className="hidden border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-12 md:gap-2">
              <div className="md:col-span-5">Product</div>
              <div className="md:col-span-2 text-right">Quantity</div>
              <div className="md:col-span-2 text-right">Unit Price</div>
              <div className="md:col-span-2 text-right">Total</div>
              <div className="md:col-span-1"></div>
            </div>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Plus className="mb-2 h-8 w-8" />
                <p className="text-sm">No products added yet.</p>
                <p className="text-xs">
                  Search above to add products to this purchase.
                </p>
              </div>
            ) : (
              items.map((it, idx) => {
                const p = productMap[it.productId]
                if (!p) return null
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-2 gap-2 border-b p-3 md:grid-cols-12 md:items-center md:gap-2 last:border-0"
                  >
                    <div className="col-span-2 min-w-0 md:col-span-5">
                      <p className="text-sm font-medium">{p.name}</p>
                      {p.variantName && (
                        <p className="text-xs text-muted-foreground">
                          {p.variantName}
                        </p>
                      )}
                    </div>
                    <label className="min-w-0 text-xs md:col-span-2">
                      <span className="mb-1 block text-muted-foreground md:sr-only">Quantity</span>
                      <Input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) =>
                          updateItem(idx, { quantity: Number(e.target.value) })
                        }
                        className="text-right"
                      />
                    </label>
                    <label className="min-w-0 text-xs md:col-span-2">
                      <span className="mb-1 block text-muted-foreground md:sr-only">Unit price</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={it.buyPrice}
                        onChange={(e) =>
                          updateItem(idx, { buyPrice: Number(e.target.value) })
                        }
                        className="text-right"
                      />
                    </label>
                    <div className="md:col-span-2 text-right text-sm font-semibold">
                      {formatCurrency(it.quantity * it.buyPrice)}
                    </div>
                    <div className="md:col-span-1 flex md:justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${p.name}`}
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                placeholder="Invoice number, remarks..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="space-y-2 rounded-lg bg-muted/40 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="paid" className="text-sm">
                  Amount Paid
                </Label>
                <Input
                  id="paid"
                  type="number"
                  min={0}
                  step="0.01"
                  value={paid}
                  onChange={(e) => setPaid(Number(e.target.value))}
                  className="w-32 text-right"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Due</span>
                <span
                  className={`font-semibold ${due > 0 ? "text-destructive" : ""}`}
                >
                  {formatCurrency(due)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 border-t bg-popover py-3 sm:static sm:border-0 sm:py-0">
            {submitError && (
              <p role="alert" className="text-sm text-destructive">
                {submitError}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              aria-busy={saving}
              disabled={saving || items.length === 0}
              variant="warning"
            >
              <Truck className="mr-2 h-4 w-4" /> Record Purchase
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
