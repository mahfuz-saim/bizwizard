import {
  api,
  type ApiResponse,
  type RawShopVariant,
  normalizeShopVariant
} from "./api"
import type {
  Customer,
  Supplier,
  Employee,
  Expense,
  Transaction,
  DashboardStats,
  ShopNotification
} from "./types"

type Params = Record<string, string | number | boolean>
type Page<T> = {
  data: T[]
  meta: { total: number; page: number; limit: number }
}

// Backend controllers wrap service pagination in response.data, not response.meta.
// Never quietly turn an invalid envelope into an empty, supposedly successful list.
export async function fetchAllPages<T>(
  path: string,
  params: Params = {}
): Promise<T[]> {
  async function page(number: number) {
    const res = await api.get<Page<T>>(path, {
      ...params,
      page: number,
      limit: 500,
      sortBy: "id",
      sortOrder: "asc"
    })
    if (
      !res.data ||
      !Array.isArray(res.data.data) ||
      !res.data.meta ||
      !Number.isInteger(res.data.meta.total) ||
      res.data.meta.total < 0 ||
      !Number.isInteger(res.data.meta.limit) ||
      res.data.meta.limit <= 0
    ) {
      throw new Error(`Invalid paginated response from ${path}`)
    }
    return res.data
  }
  const first = await page(1)
  const result = [...first.data]
  const pages = Math.ceil(first.meta.total / first.meta.limit)
  // Bound concurrency for the two-year history; don't do one request per sale.
  for (let start = 2; start <= pages; start += 4) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(4, pages - start + 1) }, (_, i) =>
        page(start + i)
      )
    )
    result.push(...batch.flatMap((p) => p.data))
  }
  if (result.length !== first.meta.total)
    throw new Error(`Incomplete data from ${path}; please refresh`)
  return result
}
function required<T>(response: ApiResponse<T>, path: string): T {
  if (response.data === undefined || response.data === null)
    throw new Error(`Missing data from ${path}`)
  return response.data
}
export interface RawCheckout {
  id: string
  buyerID?: string | null
  buyer?: { name: string } | null
  totalPrice: number
  totalDiscount: number
  status: string
  isDraft: boolean
  createdAt: string
  Debt?: { paidAmount: number | null; status: string } | null
  soldByOwner?: { name: string } | null
  soldByEmployee?: { name: string } | null
  items: {
    productName: string
    variantId?: string | null
    variantName?: string | null
    quantity: number
    unitPrice: number
    discountedPrice: number
    Lot?: { buyPrice: number; shopVariantId: string } | null
  }[]
}
interface RawBuyer {
  id: string
  buyerID: string
  name: string
  number: string
  address: string
  createdAt: string
}
interface RawSupplier {
  id: string
  supplierId: string
  supplierName?: string | null
  company?: string | null
  number: string
  supplier?: { name: string; createdAt: string }
}
interface RawEmployee {
  id: string
  userID: string
  name: string
  number: string
  createdAt: string
}
export interface RawExpenseItem {
  id: string
  amount: number
  name?: string | null
  description?: string | null
  expenseType: string
  createdAt: string
  shopVariantId?: string | null
  lotId?: string | null
  supplierId?: string | null
  quantity?: number | null
  unitPrice?: number | null
  supplier?: { supplierName: string | null } | null
}
interface RawExpense {
  id: string
  ExpenseItem: RawExpenseItem[]
}
interface Analytics {
  totalSell: number
  profit: number
  totalDebt: number
  totalDiscount: number
}
const round = (n: number) => Math.round(n * 100) / 100

export function normalizeCheckout(c: RawCheckout): Transaction {
  if (!Array.isArray(c.items))
    throw new Error("Checkout API omitted line items")
  const total = Number(c.totalPrice)
  const paid = c.Debt
    ? Math.min(total, Number(c.Debt.paidAmount || 0))
    : c.status === "PAID"
      ? total
      : 0
  return {
    id: c.id,
    type: "SALE",
    customerId: c.buyerID || undefined,
    customerName: c.buyer?.name || "Walk-in Customer",
    items: c.items.map((i) => ({
      productId: i.Lot?.shopVariantId || i.variantId || "",
      productName: i.productName,
      variantName: i.variantName || undefined,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: round(i.discountedPrice * i.quantity)
    })),
    subtotal: round(c.items.reduce((n, i) => n + i.unitPrice * i.quantity, 0)),
    discount: round(
      Number(c.totalDiscount) +
        c.items.reduce(
          (n, i) => n + (i.unitPrice - i.discountedPrice) * i.quantity,
          0
        )
    ),
    total,
    paid,
    due: round(Math.max(0, total - paid)),
    paymentMethod: "UNKNOWN",
    paymentTracked: true,
    cost: round(
      c.items.reduce((n, i) => n + (i.Lot?.buyPrice || 0) * i.quantity, 0)
    ),
    createdAt: c.createdAt,
    soldBy: c.soldByEmployee?.name || c.soldByOwner?.name || "Not recorded"
  }
}

export function normalizePurchase(e: RawExpenseItem, supplierName = e.supplier?.supplierName || "Not recorded"): Transaction {
  return {
    id: e.id, type: "BUY", supplierId: e.supplierId || undefined, supplierName,
    items: [{ productId: e.shopVariantId || "", productName: e.name || "Stock purchase", quantity: e.quantity || 0, unitPrice: e.unitPrice || 0, total: e.amount }],
    subtotal: e.amount, discount: 0, total: e.amount, paid: 0, due: 0,
    paymentMethod: "UNKNOWN", paymentTracked: false, createdAt: e.createdAt
  }
}

export async function loadDashboardData(shopId: string) {
  const shop = encodeURIComponent(shopId)
  const [variants, response, notificationResponse, directoryResponse] = await Promise.all([
    fetchAllPages<RawShopVariant>(`/shop/${shop}`, { includeProduct: true }),
    api.get<{
      today: Analytics; yesterday: Analytics; outstandingDebt: number; todayDiscount: number
      totalCustomers: number; totalSuppliers: number
      recentCheckouts: RawCheckout[]; recentPurchases: RawExpenseItem[]
    }>("/analytics/dashboard", { shopId }),
    api.get<ShopNotification[]>(`/notifications/${shop}`),
    api.get<{ customers: Customer[]; suppliers: Supplier[]; employees: Employee[] }>("/analytics/navigation/directories", { shopId })
  ])
  const summary = required(response, "/analytics/dashboard")
  const products = variants.map(normalizeShopVariant)
  const stats: DashboardStats = {
    todaySell: summary.today.totalSell, todayProfit: summary.today.profit,
    todayDebt: summary.outstandingDebt, todayDiscount: summary.todayDiscount,
    yesterdayProfit: summary.yesterday.profit,
    totalProducts: products.length, lowStockCount: products.filter(p => p.stock <= p.lowStockThreshold).length,
    totalCustomers: summary.totalCustomers, totalSuppliers: summary.totalSuppliers
  }
  return {
    products, ...required(directoryResponse, "/analytics/navigation/directories"),
    expenses: [] as Expense[], stats,
    transactions: [...summary.recentCheckouts.map(normalizeCheckout), ...summary.recentPurchases.map(e => normalizePurchase(e))]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10),
    notifications: required(notificationResponse, "/notifications")
  }
}

export async function loadShopData(shopId: string, role: string) {
  const owner = role !== "EMPLOYEE"
  const shop = encodeURIComponent(shopId)
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const [
    variants,
    buyers,
    rawSuppliers,
    checkouts,
    monthlyExpenses,
    rawEmployees,
    todayResponse,
    yesterdayResponse,
    notificationResponse
  ] = await Promise.all([
    fetchAllPages<RawShopVariant>(`/shop/${shop}`, { includeProduct: true }),
    fetchAllPages<RawBuyer>(`/buyer/shop-buyer/${shop}`),
    fetchAllPages<RawSupplier>(`/supplier/${shop}`),
    fetchAllPages<RawCheckout>("/checkout", { shopId }),
    owner
      ? fetchAllPages<RawExpense>(`/expense/shop/${shop}`)
      : Promise.resolve([]),
    owner
      ? fetchAllPages<RawEmployee>("/employee", { shopID: shopId })
      : Promise.resolve([]),
    api.get<Analytics>("/analytics", {
      shopId,
      startDate: today,
      endDate: today
    }),
    api.get<Analytics>("/analytics", {
      shopId,
      startDate: yesterday,
      endDate: yesterday
    }),
    api.get<ShopNotification[]>(`/notifications/${shop}`)
  ])
  const products = variants.map(normalizeShopVariant)
  const sales = checkouts
    .filter(
      (c) => !c.isDraft && ["PAID", "UNPAID", "PENDING"].includes(c.status)
    )
    .map(normalizeCheckout)
  const totals = new Map<string, { total: number; due: number }>()
  for (const sale of sales)
    if (sale.customerId) {
      const prev = totals.get(sale.customerId) || { total: 0, due: 0 }
      totals.set(sale.customerId, {
        total: round(prev.total + sale.total),
        due: round(prev.due + sale.due)
      })
    }
  const customers: Customer[] = buyers.map((b) => ({
    id: b.buyerID,
    name: b.name,
    phone: b.number,
    address: b.address,
    totalPurchased: totals.get(b.buyerID)?.total || 0,
    totalDue: totals.get(b.buyerID)?.due || 0,
    createdAt: b.createdAt
  }))
  const expenseItems = monthlyExpenses.flatMap((e) => e.ExpenseItem)
  const expenses: Expense[] = expenseItems
    .filter((e) => e.expenseType !== "PRODUCT")
    .map((e) => ({
      id: e.id,
      category: e.expenseType,
      amount: e.amount,
      note: e.name || e.description || undefined,
      date: e.createdAt
    }))
  const purchases: Transaction[] = expenseItems
    .filter((e) => e.expenseType === "PRODUCT")
    .map((e) => normalizePurchase(e, rawSuppliers.find((s) => s.id === e.supplierId)?.supplierName || "Not recorded"))
  const purchaseTotals = new Map<string, number>()
  for (const p of purchases)
    if (p.supplierId)
      purchaseTotals.set(
        p.supplierId,
        (purchaseTotals.get(p.supplierId) || 0) + p.total
      )
  const suppliers: Supplier[] = rawSuppliers.map((s) => ({
    id: s.id,
    userID: s.supplierId,
    name: s.supplierName || s.supplier?.name || s.company || "Supplier",
    phone: s.number,
    address: s.company || undefined,
    totalPurchased: round(purchaseTotals.get(s.id) || 0),
    totalPaid: 0,
    totalDue: 0,
    paymentTracked: false,
    createdAt: s.supplier?.createdAt || ""
  }))
  const employees: Employee[] = rawEmployees.map((e) => ({
    id: e.id,
    name: e.name,
    phone: e.number,
    role: "EMPLOYEE",
    joinedAt: e.createdAt
  }))
  const todayStats = required(todayResponse, "/analytics")
  const yesterdayStats = required(yesterdayResponse, "/analytics")
  const stats: DashboardStats = {
    todaySell: todayStats.totalSell,
    todayProfit: todayStats.profit,
    todayDebt: round(customers.reduce((n, c) => n + c.totalDue, 0)),
    todayDiscount: round(
      sales
        .filter((s) => s.createdAt.slice(0, 10) === today)
        .reduce((n, s) => n + s.discount, 0)
    ),
    yesterdayProfit: yesterdayStats.profit,
    totalProducts: products.length,
    lowStockCount: products.filter((p) => p.stock <= p.lowStockThreshold)
      .length,
    totalCustomers: customers.length,
    totalSuppliers: suppliers.length
  }
  return {
    products,
    customers,
    suppliers,
    transactions: [...sales, ...purchases].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    ),
    expenses,
    employees,
    stats,
    notifications: required(notificationResponse, "/notifications")
  }
}
