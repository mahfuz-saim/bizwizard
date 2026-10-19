"use client"

import * as React from "react"
import {
  api,
  ApiError,
  clearSession,
  SESSION_EXPIRED_EVENT,
  getAccessToken,
  getShopId,
  getSimulationSourceId,
  setSimulationSourceId,
  loginWithCredentials,
  setShopId,
  setTenantId,
  type AuthSession,
  type AuthUser
} from "./api"
import {
  initialCustomers,
  initialExpenses,
  initialProducts,
  initialSuppliers,
  initialTransactions,
  dashboardStats as defaultStats
} from "./mock-data"
import type {
  Product,
  Customer,
  Supplier,
  Transaction,
  DashboardStats,
  Expense,
  Employee,
  ShopNotification
} from "./types"
import { loadDashboardData } from "./shop-data"
import {
  checkoutBody,
  purchaseBody,
  createStockProduct,
  makeLocalSale
} from "./shop-writes"
type Source = "backend" | "mock" | "loading" | "auth" | "error"

interface DataContextValue {
  source: Source
  error: string | null
  session: AuthSession | null
  login: (identifier: string, password: string) => Promise<void>
  runDemo: () => void
  logout: () => void
  refresh: (showLoading?: boolean) => Promise<void>
  dataVersion: number
  simulationSourceId: string | null
  switchSimulation: (shopId: string | null, sourceId: string | null) => Promise<void>

  products: Product[]
  customers: Customer[]
  suppliers: Supplier[]
  transactions: Transaction[]
  expenses: Expense[]
  employees: Employee[]
  notifications: ShopNotification[]
  updateNotifications: React.Dispatch<React.SetStateAction<ShopNotification[]>>
  stats: DashboardStats

  addProduct: (
    product: Omit<Product, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>
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

const emptyStats: DashboardStats = {
  todaySell: 0,
  todayProfit: 0,
  todayDebt: 0,
  todayDiscount: 0,
  yesterdayProfit: 0,
  totalProducts: 0,
  lowStockCount: 0,
  totalCustomers: 0,
  totalSuppliers: 0
}
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
  const [employees, setEmployees] = React.useState<Employee[]>([])
  const [notifications, setNotifications] = React.useState<ShopNotification[]>(
    []
  )
  const [stats, setStats] = React.useState<DashboardStats>(emptyStats)
  const demoMode = React.useRef(false)
  const generation = React.useRef(0)
  const [dataVersion, setDataVersion] = React.useState(0)
  const [simulationSourceId, setSimulationSource] = React.useState<string | null>(null)

  const resetData = React.useCallback(() => {
    setProducts([])
    setCustomers([])
    setSuppliers([])
    setTransactions([])
    setExpenses([])
    setEmployees([])
    setNotifications([])
    setStats(emptyStats)
  }, [])
  React.useEffect(() => {
    const onSessionExpired = () => {
      generation.current++
      demoMode.current = false
      setSimulationSource(null)
      setSession(null)
      resetData()
      setError("Your session has expired. Please sign in again.")
      setSource("auth")
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
  }, [resetData])
  const logout = React.useCallback(() => {
    setSimulationSource(null)
    generation.current++
    demoMode.current = false
    clearSession()
    setSession(null)
    resetData()
    setError(null)
    setSource("auth")
    void api.post("/auth/logout").catch(() => {})
  }, [resetData])
  const runDemo = React.useCallback(() => {
    setSimulationSource(null)
    generation.current++
    clearSession()
    setSession(null)
    demoMode.current = true
    setProducts(initialProducts)
    setCustomers(initialCustomers)
    setSuppliers(initialSuppliers)
    setTransactions(initialTransactions)
    setExpenses(initialExpenses)
    setStats(defaultStats)
    setEmployees([])
    setNotifications([])
    setError(null)
    setSource("mock")
  }, [])
  const refresh = React.useCallback(
    async (showLoading = true, propagateError = false) => {
      if (demoMode.current) return
      const request = ++generation.current
      if (!getAccessToken()) {
        resetData()
        setSource("auth")
        return
      }
      if (showLoading) setSource("loading")
      setError(null)
      try {
        const res = await api.get<{
          user: AuthUser
          role: string
          defaultTenantId: string | null
          defaultShopId: string | null
          tenants: AuthSession["tenants"]
        }>("/auth/me")
        if (request !== generation.current) return
        const me = res.data
        if (!me?.user || !me.defaultShopId || !me.defaultTenantId)
          throw new Error(
            "This account has no accessible shop. Ask the owner to assign a shop."
          )
        setTenantId(me.defaultTenantId)
        let selectedShopId = me.defaultShopId
        if (getSimulationSourceId() === me.defaultShopId && (me.role === "OWNER" || me.role === "ADMIN")) {
          const workspace = await api.get<{ id: string } | null>("/finance/simulator/workspace", { shopId: me.defaultShopId })
          if (request !== generation.current) return
          if (workspace.data) selectedShopId = workspace.data.id
          else setSimulationSourceId(null)
        } else setSimulationSourceId(null)
        setSimulationSource(getSimulationSourceId())
        setShopId(selectedShopId)
        setSession({
          accessToken: getAccessToken()!,
          user: me.user,
          role: me.role,
          tenantId: me.defaultTenantId,
          shopId: selectedShopId,
          tenants: me.tenants
        })
        const data = await loadDashboardData(selectedShopId)
        if (request !== generation.current) return
        setProducts(data.products)
        setCustomers(data.customers)
        setSuppliers(data.suppliers)
        setTransactions(data.transactions)
        setExpenses(data.expenses)
        setEmployees(data.employees)
        setNotifications(data.notifications)
        setStats(data.stats)
        setDataVersion(v => v + 1)
        setSource("backend")
      } catch (e) {
        if (request !== generation.current) return
        setError(e instanceof Error ? e.message : "Unable to load shop data")
        if (e instanceof ApiError && e.status === 401) {
          clearSession()
          setSession(null)
          resetData()
          setSource("auth")
        } else if (showLoading) setSource("error") // Keep existing data visible when a background refresh fails.
        if (propagateError) throw e
      }
    },
    [resetData]
  )
  const login = React.useCallback(
    async (identifier: string, password: string) => {
      generation.current++
      demoMode.current = false
      clearSession()
      resetData()
      try {
        setSession(await loginWithCredentials(identifier, password))
        await refresh()
      } catch (e) {
        clearSession()
        setSession(null)
        throw e
      }
    },
    [refresh, resetData]
  )
  const invalidateRequests = React.useCallback(() => {
    generation.current++
  }, [])
  React.useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void refresh()
    })
    return () => {
      active = false
      invalidateRequests()
    }
  }, [refresh, invalidateRequests])

  function shopId() {
    if (getSimulationSourceId()) throw new Error("Demo baseline is read-only. Return to your source shop to make business changes.")
    const id = getShopId()
    if (!id || source !== "backend")
      throw new Error("Connect to your shop before making changes")
    return id
  }
  async function save(operation: () => Promise<void>) {
    setError(null)
    try {
      await operation()
      await refresh(false)
    } catch (e) {
      await refresh(false)
      setError(e instanceof Error ? e.message : "Save failed")
      throw e
    }
  }
  const addProduct: DataContextValue["addProduct"] = async (p) => {
    if (demoMode.current) {
      const now = new Date().toISOString()
      setProducts((prev) => [
        { ...p, id: crypto.randomUUID(), createdAt: now, updatedAt: now },
        ...prev
      ])
      return
    }
    await save(async () => {
      await createStockProduct(shopId(), p)
    })
  }
  const updateProduct: DataContextValue["updateProduct"] = async (
    id,
    patch
  ) => {
    if (demoMode.current) {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
      )
      return
    }
    const product = products.find((p) => p.id === id)
    if (!product) throw new Error("Product not found")
    // Purchase cost is historical, not an editable current price. Catalog fields
    // aren't supported by the variant update endpoint either; don't fake success.
    for (const field of [
      "buyPrice",
      "barcode",
      "category",
      "measuringUnit"
    ] as const) {
      if (patch[field] !== undefined && patch[field] !== product[field])
        throw new Error(`${field} cannot be changed through the variant API`)
    }
    await save(async () => {
      shopId()
      await api.put(`/product/${encodeURIComponent(id)}`, {
        name: patch.name,
        variantName: patch.variantName,
        variantCode: patch.variantCode,
        lowStock: patch.lowStockThreshold,
        sellPrice: patch.sellPrice !== product.sellPrice ? patch.sellPrice : undefined,
        expDate: patch.expiryDate !== undefined && patch.expiryDate !== (product.expiryDate?.slice(0, 10) ?? "")
          ? patch.expiryDate || null : undefined,
      })
    })
  }
  const deleteProduct: DataContextValue["deleteProduct"] = async (id) => {
    if (demoMode.current) {
      setProducts((prev) => prev.filter((p) => p.id !== id))
      return
    }
    await save(async () => {
      shopId()
      await api.delete(`/product/${encodeURIComponent(id)}`)
    })
  }
  const addBuy: DataContextValue["addBuy"] = async (payload) => {
    const { items, supplierId, supplierName, paid, note } = payload
    const total = items.reduce((n, i) => n + i.quantity * i.buyPrice, 0)
    if (demoMode.current) {
      setProducts((prev) =>
        prev.map((p) => ({
          ...p,
          stock:
            p.stock +
            items
              .filter((i) => i.productId === p.id)
              .reduce((n, i) => n + i.quantity, 0)
        }))
      )
      setTransactions((prev) => [
        {
          id: crypto.randomUUID(),
          type: "BUY",
          supplierId,
          supplierName,
          items: items.map((i) => ({
            productId: i.productId,
            productName:
              products.find((p) => p.id === i.productId)?.name || "Product",
            quantity: i.quantity,
            unitPrice: i.buyPrice,
            total: i.quantity * i.buyPrice
          })),
          subtotal: total,
          discount: 0,
          total,
          paid,
          due: total - paid,
          paymentMethod: "CASH",
          note,
          createdAt: new Date().toISOString()
        },
        ...prev
      ])
      return
    }
    const id = shopId()
    // Validate all items before the first persisted purchase.
    const bodies = items.map((i) => {
      const product = products.find((p) => p.id === i.productId)
      if (
        !product ||
        !Number.isInteger(i.quantity) ||
        i.quantity <= 0 ||
        !Number.isFinite(i.buyPrice) || i.buyPrice < 0
      )
        throw new Error("Invalid purchase item")
      return purchaseBody(
        id,
        product,
        i.quantity,
        i.buyPrice,
        suppliers.find((s) => s.id === supplierId),
        note
      )
    })
    if (Math.round(paid * 100) !== Math.round(total * 100))
      throw new Error(
        "The backend tracks purchase costs, not supplier payment balances. Record a fully paid purchase; partial supplier payments are not supported."
      )
    await save(async () => {
      await api.post("/product/purchase", { lines: bodies })
    })
  }
  const addSell: DataContextValue["addSell"] = async (payload) => {
    const txn = makeLocalSale(products, payload)
    if (demoMode.current) {
      for (const item of payload.items)
        if (
          item.quantity >
          (products.find((p) => p.id === item.productId)?.stock || 0)
        )
          throw new Error("Insufficient stock")
      setProducts((prev) =>
        prev.map((p) => ({
          ...p,
          stock:
            p.stock -
            payload.items
              .filter((i) => i.productId === p.id)
              .reduce((n, i) => n + i.quantity, 0)
        }))
      )
      setStats((prev) => ({
        ...prev,
        todaySell: prev.todaySell + txn.total,
        todayProfit:
          prev.todayProfit +
          txn.total -
          txn.items.reduce(
            (n, i) =>
              n +
              (products.find((p) => p.id === i.productId)?.buyPrice || 0) *
                i.quantity,
            0
          ),
        todayDiscount: prev.todayDiscount + txn.discount,
        todayDebt: prev.todayDebt + txn.due
      }))
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === txn.customerId
            ? {
                ...c,
                totalPurchased: c.totalPurchased + txn.total,
                totalDue: c.totalDue + txn.due
              }
            : c
        )
      )
      setTransactions((prev) => [txn, ...prev])
      return txn
    }
    const body = checkoutBody(shopId(), products, payload)
    const result = await api.post<{
      id: string
      totalPrice: number
      createdAt: string
    }>("/checkout", body)
    if (!result.data?.id)
      throw new Error("Checkout response did not include a receipt ID")
    await refresh(false)
    return {
      ...txn,
      id: result.data.id,
      total: result.data.totalPrice,
      createdAt: result.data.createdAt,
      paymentMethod: "UNKNOWN"
    }
  }
  const value: DataContextValue = {
    simulationSourceId,
    switchSimulation: async (id, sourceId) => {
      generation.current++
      resetData()
      setSimulationSourceId(sourceId)
      setShopId(id)
      await refresh(true, true)
    },
    dataVersion,
    source,
    error,
    session,
    login,
    runDemo,
    logout,
    refresh,
    products,
    customers,
    suppliers,
    transactions,
    expenses,
    employees,
    notifications,
    updateNotifications: setNotifications,
    stats: {
      ...stats,
      totalProducts: products.length,
      lowStockCount: products.filter((p) => p.stock <= p.lowStockThreshold)
        .length
    },
    addProduct,
    updateProduct,
    deleteProduct,
    addBuy,
    addSell
  }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
export function useStore() {
  const ctx = React.useContext(DataContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}
