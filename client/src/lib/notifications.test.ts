import assert from "node:assert/strict"
import { test } from "node:test"
import { isUnread, newNotifications, notificationTime, NOTIFICATION_TOAST_MS, readNotificationStream } from "./notifications"
import type { ShopNotification } from "./types"

const item = (id: string): ShopNotification => ({ id, title: `Title ${id}`, body: "বাংলা notification", createdAt: "2026-10-17T00:00:00Z" })

test("simulator notifications display the event clock without changing their audit timestamp", () => {
  const notification = { ...item("simulation"), data: { simulationRunID: "run-1", simulationOccurredAt: "2026-10-11T12:00:00.000Z" } }
  assert.deepEqual(notificationTime(notification), { dateTime: "2026-10-11T12:00:00.000Z", isSimulated: true })
  assert.equal(notification.createdAt, "2026-10-17T00:00:00Z")
})

test("real, legacy and invalid simulator notifications keep their original timestamp", () => {
  for (const data of [undefined, null, {}, { simulationOccurredAt: "2026-10-11T12:00:00Z" }, { simulationRunID: "run-1", simulationOccurredAt: "invalid" }]) {
    assert.deepEqual(notificationTime({ ...item("real"), data }), { dateTime: item("real").createdAt, isSimulated: false })
  }
})

test("only unseen unread notifications produce toasts, each for two seconds", () => {
  assert.equal(NOTIFICATION_TOAST_MS, 2000)
  const seen = new Set(["old"])
  const read = { ...item("read"), ReadStatus: [{ isRead: true }] }
  assert.equal(isUnread(read), false)
  assert.equal(isUnread(item("new")), true)
  assert.deepEqual(newNotifications([item("newer"), item("new"), read, item("old")], seen).map(n => n.id), ["new", "newer"])
  assert.deepEqual(newNotifications([item("newer"), item("new"), read], seen), [])
  assert.ok(seen.has("read"))
})

test("SSE handles split UTF-8, chunk boundaries, CRLF and heartbeats", async () => {
  const bytes = new TextEncoder().encode(`: heartbeat\r\n\r\ndata: ${JSON.stringify([item("first")])}\r\n\r\ndata: ${JSON.stringify([item("second")])}\n\n`)
  const body = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close() } })
  const snapshots: ShopNotification[][] = []
  await readNotificationStream(new Response(body), items => snapshots.push(items))
  assert.deepEqual(snapshots, [[item("first")], [item("second")]])
})

test("invalid responses fail rather than silently clearing notifications", async () => {
  await assert.rejects(() => readNotificationStream(new Response("denied", { status: 401 }), () => {}), /401/)
  await assert.rejects(() => readNotificationStream(new Response('data: [{"id":"bad"}]\n\n'), () => {}), /Invalid notification response/)
})
