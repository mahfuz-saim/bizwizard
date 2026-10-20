/**
 * Thin API client for the BizWizard backend.
 *
 * - Reads base URL from NEXT_PUBLIC_API_BASE_URL (.env)
 * - Uses cookie + Bearer-token hybrid auth; access tokens are persisted in
 *   localStorage (via setAccessToken).
 * - Requires explicit authentication; demo mode is local and opt-in.
 * - Normalises backend responses into the frontend's Product shape.
 */

// All browser requests use the existing same-origin Next.js rewrite. The
// backend URL belongs to the Next server, never the user's localhost.
const API_BASE = "/api/proxy/v1"

const TOKEN_KEY = "bizwizard_access_token"
const TENANT_KEY = "bizwizard_tenant_id"
const SHOP_KEY = "bizwizard_shop_id"
const USER_KEY = "bizwizard_user"
const SIMULATION_KEY = "bizwizard_simulation_source"
export const SESSION_EXPIRED_EVENT = "bizwizard:session-expired"
const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again."
let sessionGeneration = 0
let refreshInFlight: { generation: number; promise: Promise<void> } | null = null

export function getSimulationSourceId(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(SIMULATION_KEY)
}
export function setSimulationSourceId(id: string | null) {
  if (typeof window === "undefined") return
  if (id) localStorage.setItem(SIMULATION_KEY, id)
  else localStorage.removeItem(SIMULATION_KEY)
}

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

export interface SessionIdentity {
  /** Tenant the signed-in account belongs to. */
  tenant: string
  /** User id of the signed-in account, when it is known. */
  userId: string
}

/**
 * Identity of the signed-in account, independent of the access token.
 *
 * The API client rotates the access token whenever a request comes back 401
 * (see request()), so the token is NOT a stable identity: a long-running
 * operation must survive a refresh. The account behind the token, on the
 * other hand, must not change underneath a running operation.
 */
export function getSessionIdentity(): SessionIdentity | null {
  if (!getAccessToken()) return null
  const user = getCurrentUser<{ id?: string | null }>()
  return {
    tenant: getTenantId() ?? "",
    userId: typeof user?.id === "string" ? user.id : "",
  }
}

/**
 * True when both identities describe the same account. An unknown user id on
 * either side is not treated as a change — only a known mismatch is.
 */
export function sameSessionIdentity(a: SessionIdentity | null, b: SessionIdentity | null): boolean {
  if (!a || !b) return false
  if (a.tenant !== b.tenant) return false
  if (a.userId && b.userId) return a.userId === b.userId
  return true
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
    path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
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

function expireSession(generation: number) {
  if (generation !== sessionGeneration) return
  clearSession()
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}

async function refreshAccessToken(generation: number) {
  if (refreshInFlight?.generation === generation) return refreshInFlight.promise
  const promise = (async () => {
    let res: Response
    try {
      res = await fetch(buildUrl("/auth/refresh-token"), {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { Accept: "application/json" },
      })
    } catch {
      throw new ApiError("Could not reconnect to your session. Please try again.", 503)
    }
    if (generation !== sessionGeneration) throw new ApiError("Your session has changed. Please try again.", 401)
    if ([400, 401, 403, 404].includes(res.status)) {
      expireSession(generation)
      throw new ApiError(SESSION_EXPIRED_MESSAGE, 401)
    }
    let payload: ApiResponse<{ accessToken: string }> | null = null
    try { payload = await res.json() } catch { /* Invalid responses are retryable, not a logout. */ }
    if (generation !== sessionGeneration) throw new ApiError("Your session has changed. Please try again.", 401)
    if (!res.ok || !payload?.success || typeof payload.data?.accessToken !== "string" || !payload.data.accessToken) {
      throw new ApiError("Could not reconnect to your session. Please try again.", 503)
    }
    setAccessToken(payload.data.accessToken)
  })()
  refreshInFlight = { generation, promise }
  try { await promise } finally {
    if (refreshInFlight?.promise === promise) refreshInFlight = null
  }
}

async function request<T>(path: string, options: FetchOptions = {}, retried = false): Promise<ApiResponse<T>> {
  const { params, json, headers, ...init } = options
  const generation = sessionGeneration
  const token = getAccessToken()
  const tenantId = getTenantId()
  const res = await fetch(buildUrl(path, params), {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { "x-tenant-id": tenantId } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : init.body,
  })

  const canRefresh = token && (!path.startsWith("/auth/") || path === "/auth/me") && !new Headers(headers).has("Authorization")
  if (res.status === 401 && canRefresh) {
    if (generation !== sessionGeneration) throw new ApiError("Your session has changed. Please try again.", 401)
    if (retried) {
      expireSession(generation)
      throw new ApiError(SESSION_EXPIRED_MESSAGE, 401)
    }
    // A parallel request may already have replaced the rejected token.
    if (getAccessToken() === token) await refreshAccessToken(generation)
    if (generation !== sessionGeneration) throw new ApiError(SESSION_EXPIRED_MESSAGE, 401)
    return request<T>(path, options, true)
  }

  let payload: ApiResponse<T> | null = null
  try { payload = (await res.json()) as ApiResponse<T> } catch { /* noop */ }

  if (!res.ok || !payload || payload.success === false) {
    const details = (payload as { errorMessages?: { path?: string; message?: string }[] } | null)?.errorMessages
      ?.filter(e => e.path && e.message)
      .map(e => `${e.path}: ${e.message}`).join("; ")
    const msg = details || payload?.message || `Request failed (${res.status})`
    throw new ApiError(msg, res.status, payload)
  }
  return payload
}

/**
 * Streaming request (NDJSON).
 *
 * The backend can push one line per simulated unit of work while it is still
 * running, so the UI can start showing results immediately instead of waiting
 * for the whole response. Auth handling mirrors request(): a 401 triggers a
 * token refresh and a single retry (safe — the backend rejects the request
 * before it starts any work).
 */
async function streamRequest(
  path: string,
  options: FetchOptions & { onLine?: (line: unknown) => void } = {},
  retried = false,
): Promise<void> {
  const { params, json, headers, onLine, ...init } = options
  const generation = sessionGeneration
  const token = getAccessToken()
  const tenantId = getTenantId()
  const res = await fetch(buildUrl(path, params), {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson, application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { "x-tenant-id": tenantId } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : init.body,
  })

  const canRefresh = token && (!path.startsWith("/auth/") || path === "/auth/me") && !new Headers(headers).has("Authorization")
  if (res.status === 401 && canRefresh) {
    if (generation !== sessionGeneration) throw new ApiError("Your session has changed. Please try again.", 401)
    if (retried) {
      expireSession(generation)
      throw new ApiError(SESSION_EXPIRED_MESSAGE, 401)
    }
    if (getAccessToken() === token) await refreshAccessToken(generation)
    if (generation !== sessionGeneration) throw new ApiError(SESSION_EXPIRED_MESSAGE, 401)
    return streamRequest(path, options, true)
  }

  if (!res.ok) {
    let payload: ApiResponse<unknown> | null = null
    try { payload = (await res.json()) as ApiResponse<unknown> } catch { /* noop */ }
    throw new ApiError(payload?.message || `Request failed (${res.status})`, res.status, payload)
  }

  if (!res.body || !onLine) return
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newline = buffer.indexOf("\n")
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (line) {
          try { onLine(JSON.parse(line)) } catch { /* ignore a malformed line */ }
        }
        newline = buffer.indexOf("\n")
      }
    }
    const tail = buffer.trim()
    if (tail) {
      try { onLine(JSON.parse(tail)) } catch { /* ignore a malformed tail */ }
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  }
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
  postWithAuthorization: <T>(path: string, body: unknown, token: string) =>
    request<T>(path, { method: "POST", json: body, headers: { Authorization: token } }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** POST a request whose NDJSON response is consumed line by line. */
  stream: (path: string, body: unknown, onLine: (line: unknown) => void, params?: FetchOptions["params"]) =>
    streamRequest(path, { method: "POST", json: body, params, onLine }),
}

// ---------- Auth helpers ----------
export interface AuthUser {
  id: string
  name?: string | null
  email?: string | null
  number?: string | null
  role?: string
}

export interface AuthSession {
  accessToken: string
  tenantId?: string | null
  shopId?: string | null
  user?: AuthUser | null
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
  const res = await api.post<{ accessToken: string }>("/auth/login", body)
  if (!res.data?.accessToken) throw new ApiError("No access token returned", 401)
  setAccessToken(res.data.accessToken)
  // Store.refresh validates /auth/me and loads shop metadata in one place.
  return { accessToken: res.data.accessToken }
}

export function clearSession() {
  sessionGeneration++
  setSimulationSourceId(null)
  setAccessToken(null)
  setTenantId(null)
  setShopId(null)
  setCurrentUser(null)
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
  notifyAfterNotSold?: number | null
  notifyBeforeExp?: number | null
  lastSoldDate?: string | null
  createdAt?: string
  updatedAt?: string
  mrp?: number | null
  sellPrice?: number | null
  buyPrice?: number | null
  Lot?: { id: string; buyPrice?: number | null; sellPrice?: number | null; stock: number; expDate?: string | null }[]
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
  const lots = v.Lot || v.lots
  const firstLot = lots?.find(l => l.stock > 0) || lots?.[lots.length - 1]
  const sellPrice = Number(v.sellPrice ?? firstLot?.sellPrice ?? 0)
  const buyPrice = Number(v.buyPrice ?? firstLot?.buyPrice ?? 0)
  return {
    id: v.id,
    productID: v.productID,
    name: v.name || product.productName || "Unnamed product",
    productName: product.productName || v.name || "",
    variantName: v.variantName || undefined,
    variantCode: v.variantCode || undefined,
    barcode: product.barcode || undefined,
    genericName: product.genericName || undefined,
    category: product.category || "OTHER",
    image: product.image || undefined,
    measuringUnit: (product.measuringUnit || "Piece (pc)") as import("./types").MeasuringUnit,
    stock: v.Lot ? v.Lot.reduce((n, lot) => n + lot.stock, 0) : Number(v.totalProducts ?? 0),
    lots: v.Lot,
    expiryDate: v.Lot?.find(l => l.stock > 0 && l.expDate)?.expDate || undefined,
    lowStockThreshold: Number(v.lowStock ?? 0),
    buyPrice,
    sellPrice,
    lastSoldDate: v.lastSoldDate || undefined,
    createdAt: v.createdAt || new Date().toISOString(),
    updatedAt: v.updatedAt || new Date().toISOString(),
  }
}
