"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Trash2, Barcode, Plus, Search, CheckCircle2 } from "lucide-react"
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
import { useStore } from "@/lib/store"
import { formatCurrency } from "@/lib/utils"
import type { Product } from "@/lib/types"

interface LineItem {
  productId: string
  quantity: number
  sellPrice: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefillProduct?: Product | null
}

export function SellDialog({ open, onOpenChange, prefillProduct }: Props) {
  const router = useRouter()
  const { products, customers, addSell, source } = useStore()
  const [customerId, setCustomerId] = React.useState<string>("")
  const [customerName, setCustomerName] = React.useState<string>("")
  const [paymentMethod, setPaymentMethod] = React.useState<
    "CASH" | "BKASH" | "NAGAD" | "CARD" | "BANK"
  >("CASH")
  const [note, setNote] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [discount, setDiscount] = React.useState<number>(0)
  const [paid, setPaid] = React.useState<number>(0)
  const [items, setItems] = React.useState<LineItem[]>([])
  const [success, setSuccess] = React.useState<{
    total: number
    due: number
    id: string
  } | null>(null)

  const reset = React.useCallback(() => {
    setCustomerId("")
    setCustomerName("")
    setPaymentMethod("CASH")
    setNote("")
    setSearch("")
    setDiscount(0)
    setPaid(0)
    setItems([])
    setSuccess(null)
  }, [])

  React.useEffect(() => {
    if (!open) return
    reset()
    if (prefillProduct) {
      setItems([
        {
          productId: prefillProduct.id,
          quantity: 1,
          sellPrice: prefillProduct.sellPrice || 0
        }
      ])
    }
  }, [open, prefillProduct, reset])

  const addItem = (p: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === p.id)
      if (existing) {
        return prev.map((i) =>
          i.productId === p.id
            ? { ...i, quantity: Math.min(i.quantity + 1, p.stock) }
            : i
        )
      }
      return [
        ...prev,
        { productId: p.id, quantity: 1, sellPrice: p.sellPrice || 0 }
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
      (isNaN(it.quantity) || isNaN(it.sellPrice)
        ? 0
        : it.quantity * it.sellPrice),
    0
  )
  const total = Math.max(0, subtotal - (Number(discount) || 0))
  const due = Math.max(0, total - (Number(paid) || 0))

  const filteredProducts = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return products
      .filter(
        (p) =>
          p.stock > 0 &&
          (p.name.toLowerCase().includes(q) ||
            (p.variantName || "").toLowerCase().includes(q) ||
            (p.barcode || "").includes(q))
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
      const finalCustomerName =
        customers.find((c) => c.id === customerId)?.name ||
        customerName.trim() ||
        "Walk-in Customer"
      const txn = await addSell({
        customerId: customerId || undefined,
        customerName: finalCustomerName,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          sellPrice: Number(i.sellPrice)
        })),
        discount: Number(discount) || 0,
        paid: Number(paid) || 0,
        paymentMethod,
        note: note || undefined
      })
      if (txn) {
        setSuccess({ total: txn.total, due: txn.due, id: txn.id })
      }
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

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <DialogTitle className="text-xl">Sale Recorded!</DialogTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Transaction has been saved successfully.
            </p>
            <div className="mt-6 w-full space-y-2 rounded-lg bg-muted/40 p-4 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">
                  {formatCurrency(success.total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-semibold">
                  {formatCurrency(success.total - success.due)}
                </span>
              </div>
              {success.due > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Due</span>
                  <span className="font-semibold">
                    {formatCurrency(success.due)}
                  </span>
                </div>
              )}
            </div>
            <DialogFooter className="mt-6 w-full gap-2 sm:flex-col-reverse">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  reset()
                  onOpenChange(false)
                }}
              >
                Close
              </Button>
              <Button
                className="w-full"
                onClick={() => {
                  reset()
                  if (prefillProduct) {
                    setItems([
                      {
                        productId: prefillProduct.id,
                        quantity: 1,
                        sellPrice: prefillProduct.sellPrice
                      }
                    ])
                  }
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> New Sale
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5 text-success" />
            New Sale
          </DialogTitle>
          <DialogDescription>
            Record a sale to a customer. Stock will be decremented
            automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Customer</Label>
              <Select
                value={customerId}
                onValueChange={(v) => {
                  setCustomerId(v)
                  setCustomerName("")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Walk-in customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Or Customer Name</Label>
              <Input
                placeholder="Customer name"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value)
                  setCustomerId("")
                }}
              />
            </div>
            <div>
              <Label>Payment Method</Label>
              {source !== "mock" && (
                <p className="text-xs text-muted-foreground">
                  The backend records paid amounts, not payment channels.
                </p>
              )}
              <Select
                disabled={source !== "mock"}
                value={source === "mock" ? paymentMethod : "UNKNOWN"}
                onValueChange={(v) =>
                  setPaymentMethod(v as typeof paymentMethod)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {source !== "mock" && (
                    <SelectItem value="UNKNOWN">Not recorded</SelectItem>
                  )}
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BKASH">bKash</SelectItem>
                  <SelectItem value="NAGAD">Nagad</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="BANK">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Product search */}
          <div className="relative">
            <Label>Add Products</Label>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Scan barcode or search product..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
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
                      <span className="ml-2 shrink-0 text-xs">
                        <span className="text-muted-foreground">
                          Stock {p.stock} ·{" "}
                        </span>
                        <span className="font-semibold text-success">
                          {formatCurrency(p.sellPrice)}
                        </span>
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
              <div className="md:col-span-2 text-right">Qty</div>
              <div className="md:col-span-2 text-right">Price</div>
              <div className="md:col-span-2 text-right">Total</div>
              <div className="md:col-span-1"></div>
            </div>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Barcode className="mb-2 h-8 w-8" />
                <p className="text-sm">No items in cart.</p>
                <p className="text-xs">
                  Start typing or scan a barcode to add products.
                </p>
              </div>
            ) : (
              items.map((it, idx) => {
                const p = productMap[it.productId]
                if (!p) return null
                const overStock = it.quantity > p.stock
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-2 gap-2 border-b p-3 md:grid-cols-12 md:items-center md:gap-2 last:border-0"
                  >
                    <div className="col-span-2 min-w-0 md:col-span-5">
                      <p className="text-sm font-medium">{p.name}</p>
                      {p.variantName && (
                        <p className="text-xs text-muted-foreground">
                          {p.variantName} · Stock: {p.stock}
                        </p>
                      )}
                    </div>
                    <label className="min-w-0 text-xs md:col-span-2">
                      <span className="mb-1 block text-muted-foreground md:sr-only">Quantity</span>
                      <Input
                        type="number"
                        min={1}
                        max={p.stock}
                        value={it.quantity}
                        onChange={(e) =>
                          updateItem(idx, { quantity: Number(e.target.value) })
                        }
                        className={`text-right ${overStock ? "border-destructive" : ""}`}
                      />
                      {overStock && (
                        <p className="mt-1 text-xs text-destructive">
                          Exceeds stock
                        </p>
                      )}
                    </label>
                    <label className="min-w-0 text-xs md:col-span-2">
                      <span className="mb-1 block text-muted-foreground md:sr-only">Unit price</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={it.sellPrice}
                        onChange={(e) =>
                          updateItem(idx, { sellPrice: Number(e.target.value) })
                        }
                        className="text-right"
                      />
                    </label>
                    <div className="md:col-span-2 text-right text-sm font-semibold">
                      {formatCurrency(it.quantity * it.sellPrice)}
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
                placeholder="Any additional info..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="space-y-2 rounded-lg bg-muted/40 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="discount" className="text-sm">
                  Discount
                </Label>
                <Input
                  id="discount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-32 text-right"
                />
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="font-medium">Total</span>
                <span className="text-lg font-bold">
                  {formatCurrency(total)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
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
                  className={`font-semibold ${due > 0 ? "text-destructive" : "text-success"}`}
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
              variant="success"
              disabled={
                saving ||
                items.length === 0 ||
                items.some(
                  (it) => it.quantity > (productMap[it.productId]?.stock ?? 0)
                )
              }
            >
              <Barcode className="mr-2 h-4 w-4" /> Complete Sale
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
