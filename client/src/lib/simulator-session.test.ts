import assert from "node:assert/strict"
import { test, type TestContext } from "node:test"
import {
  clearSession,
  getSessionIdentity,
  sameSessionIdentity,
  setAccessToken,
  setCurrentUser,
  setTenantId
} from "./api"
import { assertSessionUnchanged } from "./simulator-context"

/** Minimal browser storage so the session helpers behave like the app. */
function browser(t: TestContext) {
  const values = new Map<string, string>()
  const originals = ["window", "localStorage"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "http://localhost:3000" } } })
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } })
  clearSession()
  setAccessToken("token-1")
  setTenantId("tenant-1")
  setCurrentUser({ id: "user-1", email: "owner@example.com", role: "OWNER" })
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  })
}

test("a refreshed access token is the same account, not a new one", t => {
  browser(t)
  const before = getSessionIdentity()
  assert.deepEqual(before, { tenant: "tenant-1", userId: "user-1" })
  // The API client rotates the token whenever a request comes back 401.
  setAccessToken("token-2")
  assert.deepEqual(getSessionIdentity(), before)
  assert.equal(sameSessionIdentity(before, getSessionIdentity()), true)
})

test("a simulator run survives an access-token refresh mid-run", t => {
  browser(t)
  const identity = getSessionIdentity()
  assertSessionUnchanged(identity)
  setAccessToken("token-2") // refreshed while the run was in flight
  assert.doesNotThrow(() => assertSessionUnchanged(identity))
})

test("a simulator run stops when the session ends", t => {
  browser(t)
  const identity = getSessionIdentity()
  clearSession() // logout / expired session
  assert.throws(() => assertSessionUnchanged(identity), /session ended/i)
})

test("a simulator run stops when a different account signs in", t => {
  browser(t)
  const identity = getSessionIdentity()
  setAccessToken("token-2")
  setCurrentUser({ id: "user-2", email: "other@example.com", role: "OWNER" })
  assert.throws(() => assertSessionUnchanged(identity), /Account changed/i)
})

test("a simulator run stops when the tenant changes", t => {
  browser(t)
  const identity = getSessionIdentity()
  setTenantId("tenant-2")
  assert.throws(() => assertSessionUnchanged(identity), /Account changed/i)
})
