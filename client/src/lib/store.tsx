"use client"

import * as React from "react"
import {
  api,
  clearSession,
  getAccessToken,
  getShopId,
  getTenantId,
  isBackendReachable,
  loginWithCredentials,
  normalizeShopVariant,
  setShopId,
  setTenantId,
  silentDemoLogin,
  type AuthSession,
  type RawShopVariant,
} from "./api"
import {
  initialCustomers,
  initialExpenses,
  initialProducts,
  initialSuppliers,
  initialTransactions,
  dashboardStats as defaultStats,
} from "./mock-data"
import type {
  Product,
  Customer,
  Supplier,
  Transaction,
  DashboardStats,
  Expense,
} from "./types"

type Source = "backend" | "mock" | "loading" | "auth"

interface DataContextValue {
  source: Source
  error: string | null
  session: AuthSession | null
  refresh: () => Promise<void>

  products: Product[]
  customers: Customer[]
  suppliers: Supplier[]
  transactions: Transaction[]
  expenses: Expense[]
  stats: DashboardStats

  addProduct: (product: Omit<Product, "id" | "createdAt" | "updatedAt">) => Promise<void>
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  addBuy: (payload: {
    supplierId?: string
    supplierName: string
    items: { productId: string; quantity: number; buyPrice: number }[]
    paid: number
    note?: string
  }) => Promise<void>
  addSell: (payload: {
    customerId?: string
    customerName: string
    items: { productId: string; quantity: number; sellPrice: number }[]
    discount: number
    paid: number
    paymentMethod: Transaction["paymentMethod"]
    note?: string
  }) => Promise<Transaction | null>
}

const DataContext = React.createContext<DataContextValue | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [source, setSource] = React.useState<Source>("loading")
  const [error, setError] = React.useState<string | null>(null)
  const [session, setSession] = React.useState<AuthSession | null>(null)

  const [products, setProducts] = React.useState<Product[]>(initialProducts)
  const [customers] = React.useState<Customer[]>(initialCustomers)
  const [suppliers] = React.useState<Supplier[]>(initialSuppliers)
  const [transactions, setTransactions] = React.useState<Transaction[]>(initialTransactions)
  const [expenses] = React.useState<Expense[]>(initialExpenses)
  const [stats, setStats] = React.useState<DashboardStats>(defaultStats)

  React.useEffect(() => {
    const lowStockCount = products.filter((p) => p.stock <= p.lowStockThreshold).length
    setStats((s) => ({ ...s, totalProducts: products.length, lowStockCount }))
  }, [products])

  const loadProducts = React.useCallback(async () => {
    const shopId = getShopId()
    if (!shopId) return []
    const res = await api.get<any>(`/shop/${shopId}`, {
      page: 1,
      limit: 200,
      sortOrder: "asc",
    })
    const payload: any = res.data
    const rawList: RawShopVariant[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.shopVariants)
          ? payload.shopVariants
          : []
    return rawList.map(normalizeShopVariant)
  }, [])

  const refresh = React.useCallback(async () => {
    setSource("loading")
    setError(null)
    try {
      const reachable = await isBackendReachable()
      if (!reachable) {
        setProducts(initialProducts)
        setSource("mock")
        setError("Backend unreachable. Showing demo data.")
        return
      }

      // Try existing token first
      if (!getAccessToken()) {
        setSource("auth")
        const s = await silentDemoLogin()
        if (!s) {
          setProducts(initialProducts)
          setSource("mock")
          setError("Not authenticated. Showing demo data.")
          return
        }
        setSession(s)
      }

      // If we have a token but no tenant, fetch /auth/me to populate it
      if (!getTenantId() || !getShopId()) {
        const meRes = await api.get<any>("/auth/me")
        const me = meRes.data as any
        if (me?.defaultTenantId) setTenantId(me.defaultTenantId)
        if (me?.defaultShopId) setShopId(me.defaultShopId)
        setSession((s) => s ? { ...s, ...me } : null)
      }

      try {
        const list = await loadProducts()
        setProducts(list.length ? list : [])
        setSource("backend")
        setError(null)
      } catch (e: any) {
        // Token might be invalid -> try demo login once then retry
        if (e?.status === 401 || e?.status === 403) {
          clearSession()
          const s = await silentDemoLogin()
          if (s) {
            setSession(s)
            const list = await loadProducts()
            setProducts(list.length ? list : [])
            setSource("backend")
            setError(null)
            return
          }
        }
        setProducts(initialProducts)
        setSource("mock")
        setError(e?.message || "Could not load data. Showing demo data.")
      }
    } catch (e: any) {
      setProducts(initialProducts)
      setSource("mock")
      setError(e?.message || "Failed to load data.")
    }
  }, [loadProducts])

  React.useEffect(() => { refresh() }, [refresh])

  const addProduct: DataContextValue["addProduct"] = React.useCallback(
    async (p) => {
      const id = `p${Date.now()}`
      const now = new Date().toISOString()
      const optimistic: Product = { ...p, id, createdAt: now, updatedAt: now, stock: p.stock ?? 0 }
      setProducts((prev) => [optimistic, ...prev])
      if (source !== "backend") return

      try {
        const shopId = getShopId()
        await api.post("/product/catalog", {
          shopID: shopId,
          product: {
            productName: p.name,
            barcode: p.barcode,
            measuringUnit: p.measuringUnit,
            genericName: (p as any).genericName || "",
            category: p.category,
            image: (p as any).image,
          },
          variants: [
            {
              variantName: p.variantName || "Default",
              variantCode: p.variantCode || "",
              packOf: 1,
              lowStock: p.lowStockThreshold,
              lowStockSMS: false,
            },
          ],
        })
        await refresh()
      } catch (e: any) {
        setError(e?.message || "Failed to add product")
      }
    },
    [source, refresh]
  )

  const updateProduct: DataContextValue["updateProduct"] = React.useCallback(
    async (id, patch) => {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p))
      )
      if (source !== "backend") return
      try {
        await api.put(`/product/${id}`, { shopID: getShopId(), ...patch })
      } catch (e: any) { setError(e?.message || "Failed to update product") }
    },
    [source]
  )

  const deleteProduct: DataContextValue["deleteProduct"] = React.useCallback(
    async (id) => {
      setProducts((prev) => prev.filter((p) => p.id !== id))
      if (source !== "backend") return
      try { await api.delete(`/product/${id}`) } catch (e: any) { setError(e?.message || "Failed to delete product") }
    },
    [source]
  )

  const addBuy: DataContextValue["addBuy"] = React.useCallback(
    async ({ supplierId, supplierName, items, paid, note }) => {
      let subtotal = 0
      const txnItems: Transaction["items"] = []
      setProducts((prev) => {
        const copy = [...prev]
        for (const it of items) {
          const idx = copy.findIndex((p) => p.id === it.productId)
          if (idx < 0) continue
          const total = it.quantity * it.buyPrice
          subtotal += total
          txnItems.push({
            productId: it.productId,
            productName: copy[idx].name,
            variantName: copy[idx].variantName,
            quantity: it.quantity,
            unitPrice: it.buyPrice,
            total,
          })
          copy[idx] = { ...copy[idx], stock: copy[idx].stock + it.quantity, buyPrice: it.buyPrice, updatedAt: new Date().toISOString() }
        }
        return copy
      })
      const total = subtotal
      setTransactions((prev) => [{
        id: `t${Date.now()}`, type: "BUY", supplierId, supplierName, items: txnItems,
        subtotal, discount: 0, total, paid, due: total - paid, paymentMethod: "CASH", note,
        createdAt: new Date().toISOString(),
      }, ...prev])
      // NOTE: backend purchase flow happens via lot creation; optimistic update is shown until a refresh.
      if (source === "backend") refresh().catch(() => {})
    },
    [source, refresh]
  )

  const addSell: DataContextValue["addSell"] = React.useCallback<DataContextValue["addSell"]>(
    async ({ customerId, customerName, items, discount, paid, paymentMethod, note }) => {
      let subtotal = 0
      const txnItems: Transaction["items"] = []
      let success = true
      setProducts((prev) => {
        const copy = [...prev]
        for (const it of items) {
          const idx = copy.findIndex((p) => p.id === it.productId)
          if (idx < 0) { success = false; continue }
          if (copy[idx].stock < it.quantity) { success = false; continue }
          const total = it.quantity * it.sellPrice
          subtotal += total
          txnItems.push({
            productId: it.productId, productName: copy[idx].name, variantName: copy[idx].variantName,
            quantity: it.quantity, unitPrice: it.sellPrice, total,
          })
          copy[idx] = { ...copy[idx], stock: copy[idx].stock - it.quantity, sellPrice: it.sellPrice, lastSoldDate: new Date().toISOString(), updatedAt: new Date().toISOString() }
        }
        return copy
      })
      if (!success || txnItems.length === 0) return null
      const total = Math.max(0, subtotal - discount)
      const due = total - paid
      const txn: Transaction = {
        id: `t${Date.now()}`, type: "SALE", customerId, customerName, items: txnItems,
        subtotal, discount, total, paid, due, paymentMethod, note,
        createdAt: new Date().toISOString(), soldBy: "You",
      }
      setTransactions((prev) => [txn, ...prev])
      setStats((s) => ({ ...s, todaySell: s.todaySell + total, todayProfit: s.todayProfit + txnItems.reduce((a, ti) => { const prod = products.find(p => p.id === ti.productId); return a + (ti.unitPrice - (prod?.buyPrice ?? 0))*ti.quantity; }, 0), todayDebt: s.todayDebt + Math.max(0, due), todayDiscount: s.todayDiscount + discount }))

      if (source === "backend") {
        try {
          await api.post("/checkout/quick", {
            shopID: getShopId(),
            buyerName: customerName,
            buyerPhone: "",
            items: txnItems.map((it) => ({ variantId: it.productId, quantity: it.quantity, price: it.unitPrice })),
            discount, paid, paymentMethod, note,
          })
          await refresh()
        } catch (e: any) { setError(e?.message || "Checkout failed (saved locally)") }
      }
      return txn
    },
    [products, source, refresh]
  )

  const value: DataContextValue = {
    source, error, session, refresh,
    products, customers, suppliers, transactions, expenses, stats,
    addProduct, updateProduct, deleteProduct, addBuy, addSell,
  }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useStore() {
  const ctx = React.useContext(DataContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}
