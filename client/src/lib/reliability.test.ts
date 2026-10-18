import assert from "node:assert/strict"
import { test } from "node:test"
import { financingOrder } from "./financing-order"
import { productCategories, categoryLabel } from "./product-options"
import { api, normalizeShopVariant } from "./api"
import { purchaseBody, checkoutBody, makeLocalSale } from "./shop-writes"

test("restocking preserves the catalog link and real unit, name and variant", () => {
  const product = normalizeShopVariant({ id: "variant", productID: "catalog", totalProducts: 2, lowStock: 0,
    product: { productName: "Soap", category: "PERSONAL_CARE_PRODUCTS", measuringUnit: "Piece (pc)" },
    Lot: [{ id: "lot", stock: 2, buyPrice: 53.35, sellPrice: 60, expDate: "2027-01-05T00:00:00.000Z" }],
  })
  const body = purchaseBody("shop", product, 2, 53.35)
  assert.equal(body.productID, "catalog")
  assert.equal(body.variantId, "variant")
  assert.equal(body.name, "Soap")
  assert.equal(body.measuringUnit, "Piece (pc)")
  assert.equal(body.lot.buyPrice, 53.35)
  assert.equal(product.expiryDate?.slice(0, 10), "2027-01-05")
  assert(productCategories.includes("PERSONAL_CARE_PRODUCTS"))
  assert.equal(categoryLabel("PERSONAL_CARE_PRODUCTS"), "Personal Care Products")
})

test("eligible options precede near misses and ineligible options regardless of score", () => {
  const sorted = [
    { eligibilityStatus: "INELIGIBLE", finalScore: 99 },
    { eligibilityStatus: "ELIGIBLE", finalScore: 20 },
    { eligibilityStatus: "NEAR_MISS", finalScore: 90 },
    { eligibilityStatus: "ELIGIBLE", finalScore: 80 },
  ].sort(financingOrder)
  assert.deepEqual(sorted.map(m => m.finalScore), [80, 20, 90, 99])
})

test("a fully paid decimal-priced sale does not become an overpayment or phantom debt", () => {
  const product = normalizeShopVariant({ id: "variant", productID: "catalog", totalProducts: 20, lowStock: 0,
    Lot: [{ id: "lot", stock: 20, buyPrice: 100, sellPrice: 123.74 }],
  })
  const payload = { customerName: "Walk-in", items: [{ productId: "variant", quantity: 11, sellPrice: 123.74 }], discount: 0, paid: 1361.14, paymentMethod: "CASH" as const }
  assert.equal(checkoutBody("shop", [product], payload).status, "PAID")
  assert.equal(makeLocalSale([product], payload).due, 0)
})

test("API validation surfaces safe field messages, not raw Prisma diagnostics", async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, message: "Validation Error", errorMessages: [{ path: "category", message: "Choose a supported category" }] }), { status: 400 })
    await assert.rejects(api.post("/product", {}), /category: Choose a supported category/)
    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, message: "Validation Error", errorMessages: [{ path: "", message: "Internal Prisma query and diagnostic" }] }), { status: 400 })
    await assert.rejects(api.post("/product", {}), error => error instanceof Error && error.message === "Validation Error")
  } finally { globalThis.fetch = original }
})
