"use client"

import * as React from "react"
import {
  api,
  ApiError,
  clearSession,
  getAccessToken,
  getShopId,
  loginWithCredentials,
  normalizeShopVariant,
  setShopId,
  setTenantId,
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
  login: (identifier: string, password: string) => Promise<void>
  runDemo: () => void
  logout: () => void
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

const emptyStats: DashboardStats = { todaySell: 0, todayProfit: 0, todayDebt: 0, todayDiscount: 0, yesterdayProfit: 0, totalProducts: 0, lowStockCount: 0, totalCustomers: 0, totalSuppliers: 0 }

const DataContext = React.createContext<DataContextValue | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [source, setSource] = React.useState<Source>("loading")
  const [error, setError] = React.useState<string | null>(null)
  const [session, setSession] = React.useState<AuthSession | null>(null)

  const [products, setProducts] = React.useState<Product[]>([])
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [transactions, setTransactions] = React.useState<Transaction[]>([])
  const [expenses, setExpenses] = React.useState<Expense[]>([])
  const [stats, setStats] = React.useState<DashboardStats>(emptyStats)

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

  const demoMode = React.useRef(false)

  const resetData = React.useCallback(() => {
    setProducts([])
    setCustomers([])
    setSuppliers([])
    setTransactions([])
    setExpenses([])
    setStats(emptyStats)
  }, [])

  const logout = React.useCallback(() => {
    demoMode.current = false
    clearSession()
    setSession(null)
    resetData()
    setError(null)
    setSource("auth")
    void api.post("/auth/logout").catch(() => {})
  }, [resetData])

  const runDemo = React.useCallback(() => {
    clearSession()
    setSession(null)
    demoMode.current = true
    setProducts(initialProducts)
    setCustomers(initialCustomers)
    setSuppliers(initialSuppliers)
    setTransactions(initialTransactions)
    setExpenses(initialExpenses)
    setStats(defaultStats)
    setError(null)
    setSource("mock")
  }, [])

  const refresh = React.useCallback(async () => {
    if (demoMode.current) return
    if (!getAccessToken()) {
      resetData()
      setSource("auth")
      return
    }
    setSource("loading")
    setError(null)
    try {
      // Validate every restored session, not just sessions missing shop metadata.
      const res = await api.get<Record<string, unknown>>("/auth/me")
      const me = res.data
      setTenantId(typeof me?.defaultTenantId === "string" ? me.defaultTenantId : null)
      setShopId(typeof me?.defaultShopId === "string" ? me.defaultShopId : null)
      setSession({ accessToken: getAccessToken()!, user: me?.user })
      setProducts(await loadProducts())
      setSource("backend")
    } catch (e) {
      resetData()
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        clearSession()
        setSession(null)
      }
      setError(e instanceof Error ? e.message : "Could not connect to the backend. Please try again.")
      setSource("auth")
    }
  }, [loadProducts, resetData])

  const login = React.useCallback(async (identifier: string, password: string) => {
    demoMode.current = false
    clearSession()
    resetData()
    try {
      const authenticated = await loginWithCredentials(identifier, password)
      setSession(authenticated)
      await refresh()
    } catch (e) {
      clearSession()
      setSession(null)
      throw e
    }
  }, [refresh, resetData])

  React.useEffect(() => { void refresh() }, [refresh])

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
    source, error, session, refresh, login, runDemo, logout,
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
