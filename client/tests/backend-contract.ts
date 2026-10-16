// Optional cross-project checks: run npm ci in server before this suite.
import assert from "node:assert/strict"
import { test } from "node:test"
import { checkoutZodSchema } from "../../server/src/app/modules/checkout/checkout.validation"
import { productZodSchema } from "../../server/src/app/modules/product/product.validation"
import {
  checkoutBody,
  purchaseBody,
  createStockProduct
} from "../src/lib/shop-writes"
import type { Product } from "../src/lib/types"

const product: Product = {
  id: "variant-id",
  name: "Rice",
  category: "PANTRY_STAPLES",
  measuringUnit: "Piece (pc)",
  stock: 10,
  lowStockThreshold: 2,
  sellPrice: 100,
  buyPrice: 60,
  createdAt: "2026-10-16",
  updatedAt: "2026-10-16",
  lots: [{ id: "lot-id", stock: 10, sellPrice: 100 }]
}

test("sale and purchase payloads pass the actual backend validation schemas", () => {
  const sale = checkoutBody("shop-id", [product], {
    customerId: "buyer-user-id",
    items: [{ productId: product.id, quantity: 2, sellPrice: 90 }],
    discount: 5,
    paid: 100
  })
  const parsedSale = checkoutZodSchema.createCheckoutValidation.safeParse({
    body: sale
  })
  assert(parsedSale.success, JSON.stringify(parsedSale))
  const purchase = purchaseBody("shop-id", product, 20, 60)
  const parsedPurchase = productZodSchema.createProductValidation.safeParse({
    body: purchase
  })
  assert(parsedPurchase.success, JSON.stringify(parsedPurchase))
})

test("add product includes stock/lot fields and passes actual backend validation", async () => {
  const fetch = globalThis.fetch
  let body: unknown
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body))
    return Response.json({ success: true, data: { id: "created" } })
  }
  try {
    await createStockProduct("shop-id", product)
    const parsed = productZodSchema.createProductValidation.safeParse({ body })
    assert(parsed.success, JSON.stringify(parsed))
  } finally {
    globalThis.fetch = fetch
  }
})
