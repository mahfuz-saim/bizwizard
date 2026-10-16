"use client"

import * as React from "react"
import { Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useStore } from "@/lib/store"
import type { MeasuringUnit, Product } from "@/lib/types"
import { categories, measuringUnits } from "@/lib/mock-data"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product | null
}

export function AddProductDialog({ open, onOpenChange, product }: Props) {
  const { addProduct, updateProduct } = useStore()
  const isEdit = !!product

  const [form, setForm] = React.useState({
    name: "",
    variantName: "",
    variantCode: "",
    barcode: "",
    category: "Grocery",
    measuringUnit: "Piece (pc)" as MeasuringUnit,
    stock: 0,
    lowStockThreshold: 10,
    buyPrice: 0,
    sellPrice: 0,
    expiryDate: "",
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      if (product) {
        setForm({
          name: product.name,
          variantName: product.variantName || "",
          variantCode: product.variantCode || "",
          barcode: product.barcode || "",
          category: product.category,
          measuringUnit: product.measuringUnit,
          stock: product.stock,
          lowStockThreshold: product.lowStockThreshold,
          buyPrice: product.buyPrice,
          sellPrice: product.sellPrice,
          expiryDate: product.expiryDate ? product.expiryDate.slice(0, 10) : "",
        })
      } else {
        setForm({
          name: "",
          variantName: "",
          variantCode: "",
          barcode: "",
          category: "Grocery",
          measuringUnit: "Piece (pc)",
          stock: 0,
          lowStockThreshold: 10,
          buyPrice: 0,
          sellPrice: 0,
          expiryDate: "",
        })
      }
      setErrors({})
    }
  }, [open, product])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = "Product name is required"
    if (form.sellPrice <= 0) errs.sellPrice = "Sell price must be greater than 0"
    if (form.buyPrice < 0) errs.buyPrice = "Buy price can't be negative"
    if (form.lowStockThreshold < 0) errs.lowStockThreshold = "Invalid threshold"
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    if (isEdit && product) {
      updateProduct(product.id, {
        name: form.name.trim(),
        variantName: form.variantName.trim() || undefined,
        variantCode: form.variantCode.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
        category: form.category,
        measuringUnit: form.measuringUnit,
        lowStockThreshold: Number(form.lowStockThreshold),
        buyPrice: Number(form.buyPrice),
        sellPrice: Number(form.sellPrice),
        expiryDate: form.expiryDate || undefined,
      })
    } else {
      addProduct({
        name: form.name.trim(),
        variantName: form.variantName.trim() || undefined,
        variantCode: form.variantCode.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
        category: form.category,
        measuringUnit: form.measuringUnit,
        stock: Number(form.stock) || 0,
        lowStockThreshold: Number(form.lowStockThreshold),
        buyPrice: Number(form.buyPrice),
        sellPrice: Number(form.sellPrice),
        expiryDate: form.expiryDate || undefined,
      })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-brand-600" />
            {isEdit ? "Edit Product" : "Add New Product"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update product details, pricing and stock thresholds."
              : "Fill in the details below to add a new product to your inventory."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Basmati Rice"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
            </div>

            <div>
              <Label htmlFor="variantName">Variant / Size</Label>
              <Input
                id="variantName"
                placeholder="e.g. 1kg, Premium, Large"
                value={form.variantName}
                onChange={(e) => setForm((f) => ({ ...f, variantName: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="variantCode">Variant Code / SKU</Label>
              <Input
                id="variantCode"
                placeholder="e.g. BR-PRM-1KG"
                value={form.variantCode}
                onChange={(e) => setForm((f) => ({ ...f, variantCode: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                placeholder="Scan or type barcode"
                value={form.barcode}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="unit">Measuring Unit</Label>
              <Select value={form.measuringUnit} onValueChange={(v) => setForm((f) => ({ ...f, measuringUnit: v as MeasuringUnit }))}>
                <SelectTrigger id="unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {measuringUnits.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isEdit && (
              <div>
                <Label htmlFor="stock">Opening Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  min={0}
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: Number(e.target.value) }))}
                />
              </div>
            )}

            <div>
              <Label htmlFor="lowStock">Low Stock Threshold</Label>
              <Input
                id="lowStock"
                type="number"
                min={0}
                value={form.lowStockThreshold}
                onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: Number(e.target.value) }))}
                className={errors.lowStockThreshold ? "border-destructive" : ""}
              />
              {errors.lowStockThreshold && (
                <p className="mt-1 text-xs text-destructive">{errors.lowStockThreshold}</p>
              )}
            </div>

            <div>
              <Label htmlFor="buyPrice">Buy Price (৳)</Label>
              <Input
                id="buyPrice"
                type="number"
                min={0}
                step="0.01"
                value={form.buyPrice}
                onChange={(e) => setForm((f) => ({ ...f, buyPrice: Number(e.target.value) }))}
                className={errors.buyPrice ? "border-destructive" : ""}
              />
              {errors.buyPrice && <p className="mt-1 text-xs text-destructive">{errors.buyPrice}</p>}
            </div>

            <div>
              <Label htmlFor="sellPrice">Sell Price (৳) *</Label>
              <Input
                id="sellPrice"
                type="number"
                min={0}
                step="0.01"
                value={form.sellPrice}
                onChange={(e) => setForm((f) => ({ ...f, sellPrice: Number(e.target.value) }))}
                className={errors.sellPrice ? "border-destructive" : ""}
              />
              {errors.sellPrice && <p className="mt-1 text-xs text-destructive">{errors.sellPrice}</p>}
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="expiry">Expiry Date (optional)</Label>
              <Input
                id="expiry"
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {isEdit ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
