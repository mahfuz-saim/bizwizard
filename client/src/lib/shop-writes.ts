import { api } from "./api"
import type { Product, Transaction, Supplier } from "./types"

export function purchaseBody(
  shopID: string,
  product: Product,
  quantity: number,
  buyPrice: number,
  supplier?: Supplier,
  note?: string
) {
  return {
    shopID,
    variantId: product.id,
    category: product.category,
    supplierId: supplier?.userID,
    lot: {
      stock: quantity,
      mrp: product.sellPrice,
      isMRPDefault: true,
      retail: product.sellPrice,
      includeVAT: true,
      buyPrice,
      sellPrice: product.sellPrice,
      note
    }
  }
}
export function checkoutBody(
  shopID: string,
  products: Product[],
  payload: {
    customerId?: string
    items: { productId: string; quantity: number; sellPrice: number }[]
    discount: number
    paid: number
  }
) {
  const { items, discount, paid, customerId } = payload
  const total =
    items.reduce((n, i) => n + i.quantity * i.sellPrice, 0) - discount
  if (!items.length || ![total, paid, discount].every(Number.isFinite) || total < 0 || paid < 0 || paid > total || discount < 0)
    throw new Error("Invalid sale totals")
  if (paid < total && !customerId)
    throw new Error("Select an existing customer for a credit sale")
  const requested = new Map<string, number>()
  const lines = items.flatMap((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0)
      throw new Error("Quantity must be a positive integer")
    const p = products.find((p) => p.id === item.productId)
    if (!p) throw new Error("Product not found")
    const used = requested.get(p.id) || 0
    requested.set(p.id, used + item.quantity)
    if (used + item.quantity > p.stock)
      throw new Error(`Insufficient stock for ${p.name}`)
    // Allocate a single product across its actual FIFO lots. The checkout API
    // accepts lotId, not variantId/price. Never substitute custom, untracked stock.
    let skip = used
    let remaining = item.quantity
    const result: {
      lotId: string
      quantity: number
      discountAmount: number
      discountPercentage: number
      discountType: "AMOUNT"
    }[] = []
    for (const lot of p.lots || []) {
      const available = Math.max(0, lot.stock - skip)
      skip = Math.max(0, skip - lot.stock)
      const quantity = Math.min(available, remaining)
      if (!quantity) continue
      const price = Number(lot.sellPrice)
      if (
        !Number.isFinite(price) ||
        item.sellPrice < 0 ||
        item.sellPrice > price
      )
        throw new Error(
          `Update lot pricing before selling ${p.name} above its stored price`
        )
      result.push({
        lotId: lot.id,
        quantity,
        discountAmount: price - item.sellPrice,
        discountPercentage: 0,
        discountType: "AMOUNT"
      })
      remaining -= quantity
      if (!remaining) break
    }
    if (remaining)
      throw new Error(`Reload inventory: missing sellable lots for ${p.name}`)
    return result
  })
  return {
    shopID,
    buyerID: customerId,
    status: paid >= total ? "PAID" : "UNPAID",
    paidAmount: paid,
    items: lines,
    discountAmount: discount,
    discountPercentage: 0,
    discountType: "AMOUNT",
    isDraft: false
  }
}

export async function createStockProduct(
  shopID: string,
  p: Omit<Product, "id" | "createdAt" | "updatedAt">
) {
  return api.post("/product", {
    shopID,
    name: p.name,
    category: p.category,
    barcode: p.barcode,
    measuringUnit: p.measuringUnit,
    variantName: p.variantName || "Default",
    variantCode: p.variantCode,
    packOf: 1,
    lowStock: p.lowStockThreshold,
    lot: {
      stock: p.stock,
      buyPrice: p.buyPrice,
      sellPrice: p.sellPrice,
      mrp: p.sellPrice,
      retail: p.sellPrice,
      isMRPDefault: true,
      includeVAT: true,
      expDate: p.expiryDate || undefined
    }
  })
}
export function makeLocalSale(
  products: Product[],
  payload: {
    customerId?: string
    customerName: string
    items: { productId: string; quantity: number; sellPrice: number }[]
    discount: number
    paid: number
    paymentMethod: Transaction["paymentMethod"]
    note?: string
  }
): Transaction {
  const subtotal = payload.items.reduce(
    (n, i) => n + i.quantity * i.sellPrice,
    0
  )
  return {
    id: crypto.randomUUID(),
    type: "SALE",
    customerId: payload.customerId,
    customerName: payload.customerName,
    items: payload.items.map((i) => ({
      productId: i.productId,
      productName:
        products.find((p) => p.id === i.productId)?.name || "Product",
      quantity: i.quantity,
      unitPrice: i.sellPrice,
      total: i.quantity * i.sellPrice
    })),
    subtotal,
    discount: payload.discount,
    total: subtotal - payload.discount,
    paid: payload.paid,
    due: subtotal - payload.discount - payload.paid,
    paymentMethod: payload.paymentMethod,
    note: payload.note,
    createdAt: new Date().toISOString(),
    soldBy: "You"
  }
}
