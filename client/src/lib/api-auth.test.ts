import assert from "node:assert/strict"
import { test, type TestContext } from "node:test"
import { api, ApiError, clearSession, getAccessToken, getShopId, SESSION_EXPIRED_EVENT, setAccessToken, setShopId, setTenantId } from "./api"

function browser(t: TestContext) {
  const values = new Map<string, string>()
  const events = new EventTarget()
  const originals = ["window", "localStorage", "fetch"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  Object.defineProperty(globalThis, "window", { configurable: true, value: Object.assign(events, { location: { origin: "http://localhost:3000" } }) })
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } })
  clearSession()
  setAccessToken("expired")
  setTenantId("tenant")
  setShopId("shop")
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  })
  return events
}
const reply = (status: number, data?: unknown) => new Response(JSON.stringify({ success: status === 200, data }), { status })

test("expired requests share one cookie refresh and retry with the new token", async t => {
  browser(t)
  let refreshes = 0
  let successes = 0
  globalThis.fetch = async (url, init) => {
    assert.equal(init?.credentials, "include")
    if (String(url).endsWith("/auth/refresh-token")) {
      refreshes++
      assert.equal(new Headers(init?.headers).get("Authorization"), null)
      return reply(200, { accessToken: "fresh" })
    }
    const headers = new Headers(init?.headers)
    assert.equal(headers.get("x-tenant-id"), "tenant")
    if (headers.get("Authorization") === "Bearer expired") return reply(401)
    assert.equal(headers.get("Authorization"), "Bearer fresh")
    successes++
    return reply(200, { loaded: true })
  }
  await Promise.all([api.get("/auth/me"), api.get("/finance/matching/results"), api.get("/navigation/directories")])
  assert.equal(refreshes, 1)
  assert.equal(successes, 3)
  assert.equal(getAccessToken(), "fresh")
})

test("retry preserves the original write body and runs only once", async t => {
  browser(t)
  const bodies: unknown[] = []
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/auth/refresh-token")) return reply(200, { accessToken: "fresh" })
    assert.equal(init?.method, "POST")
    bodies.push(init?.body)
    return reply(bodies.length === 1 ? 401 : 200, { saved: true })
  }
  await api.post("/finance/matching/run", { shopId: "shop", requestedAmount: 100 })
  assert.deepEqual(bodies, [JSON.stringify({ shopId: "shop", requestedAmount: 100 }), JSON.stringify({ shopId: "shop", requestedAmount: 100 })])
})

test("a late 401 reuses a token already refreshed by a parallel request", async t => {
  browser(t)
  let refreshes = 0
  let release!: (res: Response) => void
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/auth/refresh-token")) {
      refreshes++
      return reply(200, { accessToken: "fresh" })
    }
    if (new Headers(init?.headers).get("Authorization") === "Bearer fresh") return reply(200)
    if (String(url).endsWith("/slow")) return new Promise<Response>(resolve => { release = resolve })
    return reply(401)
  }
  const slow = api.get("/slow")
  await api.get("/fast")
  release(reply(401))
  await slow
  assert.equal(refreshes, 1)
})

for (const status of [400, 401, 403, 404]) {
  test(`refresh rejection ${status} clears the session and emits one sign-in event`, async t => {
    const events = browser(t)
    let expired = 0
    let calls = 0
    events.addEventListener(SESSION_EXPIRED_EVENT, () => expired++)
    globalThis.fetch = async url => {
      calls++
      return reply(String(url).endsWith("/auth/refresh-token") ? status : 401)
    }
    await assert.rejects(api.get("/auth/me"), error => error instanceof ApiError && error.status === 401 && error.message.includes("Please sign in again"))
    assert.equal(calls, 2)
    assert.equal(expired, 1)
    assert.equal(getAccessToken(), null)
    assert.equal(getShopId(), null)
  })
}

test("a second 401 stops retries and requires sign-in", async t => {
  browser(t)
  let calls = 0
  globalThis.fetch = async url => {
    calls++
    return String(url).endsWith("/auth/refresh-token") ? reply(200, { accessToken: "fresh" }) : reply(401)
  }
  await assert.rejects(api.get("/finance/cashflow/alerts"), { status: 401 })
  assert.equal(calls, 3)
  assert.equal(getAccessToken(), null)
})

for (const failure of ["network", "server", "invalid-json"]) {
  test(`a temporary refresh ${failure} failure preserves the session`, async t => {
    const events = browser(t)
    let expired = 0
    events.addEventListener(SESSION_EXPIRED_EVENT, () => expired++)
    globalThis.fetch = async url => {
      if (!String(url).endsWith("/auth/refresh-token")) return reply(401)
      if (failure === "network") throw new TypeError("Network unavailable")
      return failure === "server" ? reply(503) : new Response("Not JSON")
    }
    await assert.rejects(api.get("/auth/me"), { status: 503 })
    assert.equal(getAccessToken(), "expired")
    assert.equal(expired, 0)
  })
}

test("permission denial and failed login never trigger token refresh", async t => {
  browser(t)
  const paths: string[] = []
  globalThis.fetch = async url => {
    paths.push(String(url))
    return reply(String(url).endsWith("/auth/login") ? 401 : 403)
  }
  await assert.rejects(api.get("/finance/matching/results"), { status: 403 })
  await assert.rejects(api.post("/auth/login", {}), { status: 401 })
  assert.equal(paths.length, 2)
  assert.equal(getAccessToken(), "expired")
})

test("logout and a subsequent login invalidate an in-flight refresh", async t => {
  const events = browser(t)
  let expired = 0
  events.addEventListener(SESSION_EXPIRED_EVENT, () => expired++)
  let release!: (res: Response) => void
  let started!: () => void
  const waiting = new Promise<void>(resolve => { started = resolve })
  globalThis.fetch = async url => {
    if (!String(url).endsWith("/auth/refresh-token")) return reply(401)
    started()
    return new Promise<Response>(resolve => { release = resolve })
  }
  const request = api.get("/auth/me")
  await waiting
  clearSession()
  setAccessToken("other-login")
  release(reply(200, { accessToken: "stale-refreshed-token" }))
  await assert.rejects(request, { status: 401 })
  assert.equal(getAccessToken(), "other-login")
  assert.equal(expired, 0)
})
