import assert from "node:assert/strict"
import { test, type TestContext } from "node:test"
import { api, clearSession, setAccessToken, setShopId } from "./api"
import { simulatorApi } from "./simulator-api"

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
  setAccessToken("expired")
  setShopId("demo")
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  })
}

const encoder = new TextEncoder()
function stream(lines: unknown[]) {
  return new Response(lines.map(line => JSON.stringify(line)).join("\n"), { headers: { "Content-Type": "application/x-ndjson" } })
}

test("progress arrives before the confirmed result, including split UTF-8 and network chunks", async t => {
  browser(t)
  let controller!: ReadableStreamDefaultController<Uint8Array>
  globalThis.fetch = async () => new Response(new ReadableStream({ start(c) { controller = c } }), { headers: { "Content-Type": "application/x-ndjson" } })
  let sawProgress!: () => void
  const progress = new Promise<void>(resolve => { sawProgress = resolve })
  let finished = false
  const running = simulatorApi.fastForwardWithProgress("LESS", day => { assert.equal(day, 8); sawProgress() }).then(result => { finished = true; return result })
  controller.enqueue(encoder.encode('{"type":"pro'))
  controller.enqueue(encoder.encode('gress","day":8}\r\n'))
  await progress
  assert.equal(finished, false)
  const result = { dailyEvents: [], shopName: "চাল" }
  const bytes = encoder.encode(JSON.stringify({ type: "result", result }))
  const split = bytes.indexOf(0xe0) + 1
  controller.enqueue(bytes.slice(0, split))
  controller.enqueue(bytes.slice(split))
  controller.close()
  assert.deepEqual(await running, result)
})

test("progress transport shares authentication refresh and preserves the write body", async t => {
  browser(t)
  let calls = 0
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/auth/refresh-token")) return new Response(JSON.stringify({ success: true, data: { accessToken: "fresh" } }))
    calls++
    assert.deepEqual(JSON.parse(String(init?.body)), { shopId: "demo", template: "MORE" })
    assert.equal(new Headers(init?.headers).get("Accept"), "application/x-ndjson")
    if (calls === 1) return new Response("{}", { status: 401 })
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fresh")
    return stream([{ type: "result", result: { dailyEvents: [] } }])
  }
  await simulatorApi.fastForwardWithProgress("MORE", () => {})
  assert.equal(calls, 2)
})

test("backend stream errors and callback errors are not swallowed", async t => {
  browser(t)
  globalThis.fetch = async () => stream([{ type: "error", message: "This demo workspace is busy." }])
  await assert.rejects(simulatorApi.fastForwardWithProgress("LESS", () => {}), /workspace is busy/)
  globalThis.fetch = async () => stream([{ type: "progress", day: 1 }])
  await assert.rejects(simulatorApi.fastForwardWithProgress("LESS", () => { throw new Error("Account changed") }), /Account changed/)
})

test("missing results, malformed JSON and invalid day counts fail instead of starting playback", async t => {
  browser(t)
  globalThis.fetch = async () => stream([{ type: "progress", day: 30 }])
  await assert.rejects(simulatorApi.fastForwardWithProgress("LESS", () => {}), /without confirming saved results/)
  globalThis.fetch = async () => new Response('{"type":', { headers: { "Content-Type": "application/x-ndjson" } })
  await assert.rejects(simulatorApi.fastForwardWithProgress("LESS", () => {}), /invalid progress data/)
  globalThis.fetch = async () => stream([{ type: "progress", day: 31 }])
  await assert.rejects(simulatorApi.fastForwardWithProgress("LESS", () => {}), /Invalid simulation progress/)
})

test("a changed session cancels remaining stream callbacks", async t => {
  browser(t)
  globalThis.fetch = async () => stream([{ type: "progress", day: 1 }, { type: "progress", day: 2 }])
  const days: number[] = []
  await assert.rejects(simulatorApi.fastForwardWithProgress("LESS", day => { days.push(day); clearSession() }), /session has changed/)
  assert.deepEqual(days, [1])
})

test("a disconnected stream cannot confirm playback", async t => {
  browser(t)
  let controller!: ReadableStreamDefaultController<Uint8Array>
  globalThis.fetch = async () => new Response(new ReadableStream({ start(c) {
    controller = c
    c.enqueue(encoder.encode('{"type":"progress","day":1}\n'))
  } }), { headers: { "Content-Type": "application/x-ndjson" } })
  await assert.rejects(simulatorApi.fastForwardWithProgress("LESS", () => {
    controller.error(new Error("Connection lost"))
  }), /Connection lost/)
})

test("HTTP errors and wrong content types are not accepted as progress", async t => {
  browser(t)
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, message: "Forbidden" }), { status: 403 })
  await assert.rejects(api.stream("/finance/simulator/fast-forward", {}, () => {}), /Forbidden/)
  globalThis.fetch = async () => new Response("{}", { headers: { "Content-Type": "application/json" } })
  await assert.rejects(api.stream("/finance/simulator/fast-forward", {}, () => {}), /invalid progress response/)
})
