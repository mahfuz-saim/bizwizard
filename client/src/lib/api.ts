/**
 * Thin API client for the BizWizard backend.
 *
 * - Reads base URL from NEXT_PUBLIC_API_BASE_URL (.env)
 * - Uses cookie + Bearer-token hybrid auth; access tokens are persisted in
 *   localStorage (via setAccessToken).
 * - Provides silent login against the demo email+password so the web UI
 *   doesn't need to expose a login/signup screen during development.
 * - Normalises backend responses into the frontend's Product shape.
 */

const API_BASE = (() => {
  const v = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!v) return "http://localhost:5000/api/v1"
  return v.replace(/\/$/, "")
})()

const TOKEN_KEY = "bizwizard_access_token"
const TENANT_KEY = "bizwizard_tenant_id"
const SHOP_KEY = "bizwizard_shop_id"
const USER_KEY = "bizwizard_user"

export function getApiBaseUrl() {
  return API_BASE
}

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}
export function setTenantId(id: string | null) {
  if (typeof window === "undefined") return
  if (id) localStorage.setItem(TENANT_KEY, id)
  else localStorage.removeItem(TENANT_KEY)
}
export function getTenantId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TENANT_KEY)
}
export function setShopId(id: string | null) {
  if (typeof window === "undefined") return
  if (id) localStorage.setItem(SHOP_KEY, id)
  else localStorage.removeItem(SHOP_KEY)
}
export function getShopId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(SHOP_KEY)
}
export function setCurrentUser(u: unknown | null) {
  if (typeof window === "undefined") return
  if (u) localStorage.setItem(USER_KEY, JSON.stringify(u))
  else localStorage.removeItem(USER_KEY)
}
export function getCurrentUser<T = unknown>(): T | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

export interface ApiResponse<T = unknown> {
  success: boolean
  statusCode?: number
  message?: string
  data?: T
  meta?: { page: number; limit: number; total: number }
}

export class ApiError extends Error {
  status: number
  data?: unknown
  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>
  json?: unknown
}

function buildUrl(path: string, params?: FetchOptions["params"]) {
  const url = new URL(
    path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`
  )
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v))
      }
    })
  }
  return url.toString()
}

async function request<T>(
  path: string,
  { params, json, headers, ...init }: FetchOptions = {}
): Promise<ApiResponse<T>> {
  const token = getAccessToken()
  const tenantId = getTenantId()
  const res = await fetch(buildUrl(path, params), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { "x-tenant-id": tenantId } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : init.body,
  })

  let payload: ApiResponse<T> | null = null
  try { payload = (await res.json()) as ApiResponse<T> } catch { /* noop */ }

  if (!res.ok || !payload || payload.success === false) {
    const msg = payload?.message || `Request failed (${res.status})`
    throw new ApiError(msg, res.status, payload)
  }
  return payload
}

export const api = {
  baseUrl: API_BASE,
  get: <T>(path: string, params?: FetchOptions["params"]) =>
    request<T>(path, { method: "GET", params }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", json: body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", json: body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", json: body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
}

// ---------- Auth helpers ----------
export interface AuthSession {
  accessToken: string
  tenantId?: string | null
  shopId?: string | null
  user?: unknown
  profile?: unknown
  role?: string
  tenants?: { id: string; name: string; shops: { id: string; shopName: string }[] }[]
}

export async function loginWithCredentials(
  identifier: string,
  password: string
): Promise<AuthSession> {
  const isEmail = /\S+@\S+\.\S+/.test(identifier)
  const body = isEmail
    ? { email: identifier, password }
    : { number: identifier, password }
  const res = await api.post<any>("/auth/login", body)
  const data = res.data as any
  if (!data?.accessToken) throw new ApiError("No access token returned", 401)
  setAccessToken(data.accessToken)
  if (data.defaultTenantId) setTenantId(data.defaultTenantId)
  if (data.defaultShopId) setShopId(data.defaultShopId)
  if (data.user) setCurrentUser(data.user)
  // Follow up with /auth/me if login didn't include profile
  let me = data
  if (!data.defaultTenantId) {
    const meRes = await api.get<any>("/auth/me")
    me = meRes.data as any
    if (me?.defaultTenantId) setTenantId(me.defaultTenantId)
    if (me?.defaultShopId) setShopId(me.defaultShopId)
    if (me?.user) setCurrentUser(me.user)
  }
  return {
    accessToken: data.accessToken,
    tenantId: me?.defaultTenantId || null,
    shopId: me?.defaultShopId || null,
    user: me?.user,
    profile: me?.profile,
    role: me?.role,
    tenants: me?.tenants || [],
  }
}

/** Silent demo login, using env vars. Returns null on failure. */
export async function silentDemoLogin(): Promise<AuthSession | null> {
  const email = process.env.NEXT_PUBLIC_DEMO_EMAIL
  const password = process.env.NEXT_PUBLIC_DEMO_PASSWORD
  if (!email || !password) return null
  try {
    return await loginWithCredentials(email, password)
  } catch {
    return null
  }
}

export function clearSession() {
  setAccessToken(null)
  setTenantId(null)
  setShopId(null)
  setCurrentUser(null)
}

export async function isBackendReachable(): Promise<boolean> {
  try {
    const base = API_BASE.replace(/\/api\/v1$/, "")
    const res = await fetch(`${base}/test`, { method: "GET", cache: "no-store" })
    return res.ok
  } catch { return false }
}

// ---------- Response normalisation ----------
export interface RawShopVariant {
  id: string
  productID: string
  name?: string | null
  variantName?: string | null
  variantCode?: string | null
  packOf?: number | null
  totalProducts: number
  lowStock: number
  lowStockSMS?: boolean
  notifyAfterNotSold?: number | null
  notifyBeforeExp?: number | null
  notSoldSMS?: boolean
  lastSoldDate?: string | null
  createdAt?: string
  updatedAt?: string
  mrp?: number | null
  sellPrice?: number | null
  buyPrice?: number | null
  lots?: { buyPrice?: number | null; sellPrice?: number | null; stock: number }[]
  product?: {
    id?: string
    productName: string
    barcode?: string | null
    genericName?: string | null
    category?: string | null
    measuringUnit?: string | null
    image?: string | null
  } | null
}

export function normalizeShopVariant(v: RawShopVariant) {
  const product = v.product || ({} as NonNullable<RawShopVariant["product"]>)
  // Prefer sell/buy price from lot level if available (BE stores them on lots)
  const firstLot = v.lots?.[0]
  const sellPrice = Number(v.sellPrice ?? firstLot?.sellPrice ?? 0)
  const buyPrice = Number(v.buyPrice ?? firstLot?.buyPrice ?? 0)
  return {
    id: v.id,
    productID: v.productID,
    name: product.productName || v.name || "Unnamed product",
    productName: product.productName || v.name || "",
    variantName: v.variantName || undefined,
    variantCode: v.variantCode || undefined,
    barcode: product.barcode || undefined,
    genericName: product.genericName || undefined,
    category: product.category || "OTHER",
    image: product.image || undefined,
    measuringUnit: (product.measuringUnit || "Piece (pc)") as any,
    stock: Number(v.totalProducts ?? 0),
    lowStockThreshold: Number(v.lowStock ?? 0),
    buyPrice,
    sellPrice,
    lastSoldDate: v.lastSoldDate || undefined,
    createdAt: v.createdAt || new Date().toISOString(),
    updatedAt: v.updatedAt || new Date().toISOString(),
  }
}
