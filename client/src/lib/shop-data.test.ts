import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import {
  api,
  ApiError,
  normalizeShopVariant,
  setAccessToken,
  setTenantId
} from "./api"
import {
  fetchAllPages,
  loadShopData,
  normalizeCheckout,
  type RawCheckout
} from "./shop-data"
import { checkoutBody, purchaseBody } from "./shop-writes"
import type { Product } from "./types"

const originalFetch = globalThis.fetch
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
const originalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage"
)
const calls: { url: URL; init?: RequestInit }[] = []
const date = new Date().toISOString()
const checkout: RawCheckout = {
  id: "sale-1",
  buyerID: "customer-user",
  buyer: { name: "Real Customer" },
  totalPrice: 175,
  totalDiscount: 5,
  status: "UNPAID",
  isDraft: false,
  createdAt: date,
  Debt: { paidAmount: 75, status: "PARTIALLY_PAID" },
  soldByEmployee: { name: "Real Cashier" },
  items: [
    {
      productName: "Rice",
      variantId: "legacy-code",
      quantity: 2,
      unitPrice: 100,
      discountedPrice: 90,
      Lot: { buyPrice: 60, shopVariantId: "variant-1" }
    }
  ]
}
const product: Product = {
  id: "variant-1",
  name: "Rice",
  category: "PANTRY_STAPLES",
  measuringUnit: "Piece (pc)",
  stock: 5,
  lowStockThreshold: 2,
  buyPrice: 60,
  sellPrice: 100,
  createdAt: date,
  updatedAt: date,
  lots: [
    { id: "lot-old", stock: 2, buyPrice: 60, sellPrice: 100 },
    { id: "lot-new", stock: 3, buyPrice: 65, sellPrice: 100 }
  ]
}
const envelope = (data: unknown) => Response.json({ success: true, data })
function paged(data: unknown[]) {
  return { data, meta: { total: data.length, page: 1, limit: 500 } }
}

beforeEach(() => {
  calls.length = 0
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => storage.get(k) || null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k)
    }
  })
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { origin: "https://preview.example" } }
  })
  setAccessToken("real-token")
  setTenantId("real-tenant")
})
afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow)
  else Reflect.deleteProperty(globalThis, "window")
  if (originalStorage)
    Object.defineProperty(globalThis, "localStorage", originalStorage)
  else Reflect.deleteProperty(globalThis, "localStorage")
})

test("same-origin transport sends credentials, token, tenant and bypasses caching", async () => {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    calls.push({ url, init })
    return envelope({ ok: true })
  }
  await api.get("/checkout", { shopId: "shop-1" })
  assert.equal(calls[0].url.origin, "https://preview.example")
  assert.equal(calls[0].url.pathname, "/api/proxy/v1/checkout")
  assert.equal(calls[0].url.searchParams.get("shopId"), "shop-1")
  const headers = new Headers(calls[0].init?.headers)
  assert.equal(headers.get("Authorization"), "Bearer real-token")
  assert.equal(headers.get("x-tenant-id"), "real-tenant")
  assert.equal(calls[0].init?.cache, "no-store")
  assert.equal(calls[0].init?.credentials, "include")
})

test("loads every nested pagination page using the server's actual page size", async () => {
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    calls.push({ url })
    const page = Number(url.searchParams.get("page"))
    return envelope({
      data: [{ id: String(page) }],
      meta: { total: 6, page, limit: 1 }
    })
  }
  const rows = await fetchAllPages<{ id: string }>("/checkout", {
    shopId: "shop-1"
  })
  assert.deepEqual(
    rows.map((r) => r.id),
    ["1", "2", "3", "4", "5", "6"]
  )
  assert.equal(calls.length, 6)
  assert(calls.every((c) => c.url.searchParams.get("shopId") === "shop-1"))
})

test("malformed responses and HTTP errors are not turned into empty lists", async () => {
  globalThis.fetch = async () => envelope({ items: [], meta: { total: 0 } })
  await assert.rejects(fetchAllPages("/checkout"), /Invalid paginated/)
  globalThis.fetch = async () =>
    Response.json(
      { success: false, message: "Tenant access denied" },
      { status: 403 }
    )
  await assert.rejects(
    fetchAllPages("/checkout"),
    (error: unknown) => error instanceof ApiError && error.status === 403
  )
})

test("normalizes capital-Lot prices and real checkout cost, debt and line discounts", () => {
  const p = normalizeShopVariant({
    id: "v",
    productID: "p",
    totalProducts: 0,
    lowStock: 2,
    Lot: [{ id: "l", stock: 5, buyPrice: 60, sellPrice: 100 }],
    product: { productName: "Rice" }
  })
  assert.equal(p.stock, 5)
  assert.equal(p.buyPrice, 60)
  assert.equal(p.sellPrice, 100)
  const sale = normalizeCheckout(checkout)
  assert.equal(sale.customerId, "customer-user")
  assert.equal(sale.items[0].productId, "variant-1")
  assert.equal(sale.total, 175)
  assert.equal(sale.subtotal, 200)
  assert.equal(sale.discount, 25)
  assert.equal(sale.paid, 75)
  assert.equal(sale.due, 100)
  assert.equal(sale.cost, 120)
  assert.equal(sale.soldBy, "Real Cashier")
  assert.equal(sale.paymentMethod, "UNKNOWN")
})

function installShopResponses() {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    calls.push({ url, init })
    const path = url.pathname.replace("/api/proxy/v1", "")
    switch (path) {
      case "/shop/shop-1":
        return envelope(
          paged([
            {
              id: "variant-1",
              productID: "p",
              lowStock: 2,
              totalProducts: 5,
              Lot: [{ id: "lot-old", stock: 5, buyPrice: 60, sellPrice: 100 }],
              product: { productName: "Rice" }
            }
          ])
        )
      case "/buyer/shop-buyer/shop-1":
        return envelope(
          paged([
            {
              id: "shop-buyer",
              buyerID: "customer-user",
              name: "Real Customer",
              number: "01000000000",
              address: "Dhaka",
              createdAt: date
            }
          ])
        )
      case "/supplier/shop-1":
        return envelope(
          paged([
            {
              id: "shop-supplier",
              supplierId: "supplier-user",
              supplierName: "Real Supplier",
              number: "01000000001"
            }
          ])
        )
      case "/checkout":
        return envelope(
          paged([
            checkout,
            { ...checkout, id: "draft", isDraft: true },
            { ...checkout, id: "canceled", status: "CANCELED" }
          ])
        )
      case "/expense/shop/shop-1":
        return envelope(
          paged([
            {
              id: "expense",
              ExpenseItem: [
                {
                  id: "rent",
                  amount: 500,
                  expenseType: "GENERAL",
                  name: "Rent",
                  createdAt: date
                },
                {
                  id: "purchase",
                  amount: 300,
                  quantity: 5,
                  unitPrice: 60,
                  shopVariantId: "variant-1",
                  supplierId: "shop-supplier",
                  expenseType: "PRODUCT",
                  name: "Rice",
                  createdAt: date
                }
              ]
            }
          ])
        )
      case "/employee":
        return envelope(
          paged([
            {
              id: "e",
              name: "Real Cashier",
              number: "01000000002",
              createdAt: date
            }
          ])
        )
      case "/analytics":
        return envelope({
          totalSell: 175,
          profit: 55,
          totalDebt: 999,
          totalDiscount: 5
        })
      case "/message":
        return envelope([])
      case "/notifications/shop-1":
        return envelope([])
      default:
        throw new Error(`Unexpected endpoint ${path}`)
    }
  }
}

test("owner loads products, customers, sales, purchases, expenses, employees, analytics and messages", async () => {
  installShopResponses()
  const data = await loadShopData("shop-1", "OWNER")
  assert.equal(calls.length, 10)
  assert.equal(data.products[0].sellPrice, 100)
  assert.equal(data.customers[0].id, "customer-user")
  assert.equal(data.customers[0].totalPurchased, 175)
  assert.equal(data.customers[0].totalDue, 100)
  assert.equal(data.transactions.length, 2)
  assert.equal(data.expenses.length, 1) // Purchases aren't double-counted as operating expenses.
  assert.equal(data.suppliers[0].totalPurchased, 300)
  assert.equal(data.suppliers[0].userID, "supplier-user")
  assert.equal(data.suppliers[0].paymentTracked, false)
  assert.equal(data.employees[0].name, "Real Cashier")
  assert.equal(data.stats.todaySell, 175)
  assert.equal(data.stats.todayDebt, 100)
  assert.equal(data.stats.todayDiscount, 25)
  assert.equal(data.stats.totalCustomers, 1)
  assert(
    calls.some(
      (c) =>
        c.url.pathname.endsWith("/employee") &&
        c.url.searchParams.get("shopID") === "shop-1"
    )
  )
  assert(
    calls.some(
      (c) =>
        c.url.pathname.endsWith("/checkout") &&
        c.url.searchParams.get("shopId") === "shop-1"
    )
  )
})

test("employee does not call owner-only employee/expense endpoints", async () => {
  installShopResponses()
  await loadShopData("shop-1", "EMPLOYEE")
  assert.equal(calls.length, 8)
  assert(
    !calls.some(
      (c) =>
        c.url.pathname.includes("/expense/") ||
        c.url.pathname.endsWith("/employee")
    )
  )
})

test("checkout uses FIFO lot IDs, valid backend fields and existing customer IDs", () => {
  const body = checkoutBody("shop-1", [product], {
    customerId: "customer-user",
    items: [{ productId: product.id, quantity: 4, sellPrice: 90 }],
    discount: 5,
    paid: 75
  })
  assert.equal(body.status, "UNPAID")
  assert.equal(body.buyerID, "customer-user")
  assert.equal(body.paidAmount, 75)
  assert.deepEqual(
    body.items.map((i) => [i.lotId, i.quantity, i.discountAmount]),
    [
      ["lot-old", 2, 10],
      ["lot-new", 2, 10]
    ]
  )
  assert.equal(body.discountAmount, 5)
  assert.equal(body.isDraft, false)
  assert.throws(
    () =>
      checkoutBody("shop-1", [product], {
        items: [{ productId: product.id, quantity: 1, sellPrice: 100 }],
        discount: 0,
        paid: 0
      }),
    /existing customer/
  )
  assert.throws(
    () =>
      checkoutBody("shop-1", [product], {
        customerId: "c",
        items: [{ productId: product.id, quantity: 9, sellPrice: 100 }],
        discount: 0,
        paid: 0
      }),
    /Insufficient stock/
  )
  const purchase = purchaseBody("shop-1", product, 10, 60, {
    id: "shop-supplier",
    userID: "supplier-user",
    name: "Supplier",
    phone: "0",
    totalDue: 0,
    totalPaid: 0,
    createdAt: date
  })
  assert.equal(purchase.supplierId, "supplier-user")
  assert.equal(purchase.variantId, product.id)
  assert.equal(purchase.lot.stock, 10)
})

test("exhausted inventory keeps its last-known price without creating phantom stock", () => {
  const p = normalizeShopVariant({
    id: "v",
    productID: "p",
    totalProducts: 0,
    lowStock: 2,
    Lot: [
      { id: "old", stock: 0, buyPrice: 40, sellPrice: 70 },
      { id: "last", stock: 0, buyPrice: 60, sellPrice: 100 }
    ],
    product: { productName: "Rice" }
  })
  assert.equal(p.stock, 0)
  assert.equal(p.buyPrice, 60)
  assert.equal(p.sellPrice, 100)
})
