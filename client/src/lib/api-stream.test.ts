import assert from "node:assert/strict"
import { test, type TestContext } from "node:test"
import { api, clearSession, getAccessToken, setAccessToken, setTenantId } from "./api"

/** Minimal browser storage so the request helpers behave like the app. */
function browser(t: TestContext) {
  const values = new Map<string, string>()
  const originals = ["window", "localStorage", "fetch"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "http://localhost:3000" } } })
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } })
  clearSession()
  setAccessToken("token-1")
  setTenantId("tenant-1")
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  })
}

function ndjson(chunks: string[]): Response {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  }), { status: 200, headers: { "Content-Type": "application/x-ndjson" } })
}

test("a streaming request hands every NDJSON line to the caller, in order", async t => {
  browser(t)
  globalThis.fetch = (async () =>
    ndjson(['{"type":"day","day":1}\n{"type":"da', 'y","day":2}\n{"type":"result"}\n'])) as typeof fetch

  const lines: unknown[] = []
  await api.stream("/finance/simulator/fast-forward", { shopId: "demo-1" }, line => lines.push(line))

  // A line split across two network chunks must still arrive as one line.
  assert.deepEqual(lines, [
    { type: "day", day: 1 },
    { type: "day", day: 2 },
    { type: "result" },
  ])
})

test("a streaming request survives an access-token refresh", async t => {
  browser(t)
  const calls: string[] = []
  globalThis.fetch = (async (url: unknown) => {
    const href = String(url)
    calls.push(href)
    if (href.includes("/auth/refresh-token")) {
      return new Response(JSON.stringify({ success: true, data: { accessToken: "token-2" } }), {
        status: 200, headers: { "Content-Type": "application/json" },
      })
    }
    if (calls.length === 1) {
      return new Response(JSON.stringify({ success: false, message: "unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      })
    }
    return ndjson(['{"type":"result"}\n'])
  }) as typeof fetch

  const lines: unknown[] = []
  await api.stream("/finance/simulator/fast-forward", { shopId: "demo-1" }, line => lines.push(line))

  assert.equal(getAccessToken(), "token-2", "the rejected token is rotated before the retry")
  assert.deepEqual(lines, [{ type: "result" }])
})

test("a failed streaming request reports the backend error", async t => {
  browser(t)
  globalThis.fetch = (async () => new Response(JSON.stringify({ success: false, message: "This demo workspace is busy." }), {
    status: 409, headers: { "Content-Type": "application/json" },
  })) as typeof fetch

  await assert.rejects(
    () => api.stream("/finance/simulator/fast-forward", { shopId: "demo-1" }, () => {}),
    /This demo workspace is busy/,
  )
})
