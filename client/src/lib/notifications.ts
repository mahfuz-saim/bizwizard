import type { ShopNotification } from "./types"

export const NOTIFICATION_TOAST_MS = 2000
export const isUnread = (notification: ShopNotification) =>
  !notification.ReadStatus?.some(status => status.isRead)

export function notificationTime(notification: ShopNotification) {
  const simulatedAt = notification.data?.simulationOccurredAt
  const isSimulated = typeof notification.data?.simulationRunID === "string"
    && typeof simulatedAt === "string" && Number.isFinite(Date.parse(simulatedAt))
  return { dateTime: isSimulated ? simulatedAt : notification.createdAt, isSimulated }
}

export function notificationsThrough(items: ShopNotification[], through: string | null | undefined) {
  if (through === undefined) return items
  return items.filter(item => {
    const time = notificationTime(item)
    return !time.isSimulated || (through !== null && Date.parse(time.dateTime) <= Date.parse(through))
  })
}

export function newNotifications(items: ShopNotification[], seen: Set<string>) {
  // Simulator milestones already have their own playback toasts.
  const fresh = items.filter(item => !seen.has(item.id) && isUnread(item) && item.data?.source !== "finance-simulator")
  items.forEach(item => seen.add(item.id))
  return fresh.reverse() // oldest first when several arrived while disconnected
}

/** Fetch streaming keeps credentials in headers, never in a URL or access log. */
export async function readNotificationStream(
  response: Response,
  onSnapshot: (items: ShopNotification[]) => void,
) {
  if (!response.ok || !response.body) throw new Error(`Notification connection failed (${response.status})`)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary: RegExpExecArray | null
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index)
        buffer = buffer.slice(boundary.index + boundary[0].length)
        const data = frame.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n")
        if (!data) continue // heartbeat
        const items: unknown = JSON.parse(data)
        if (!Array.isArray(items) || !items.every(item => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.body === "string" && typeof item.createdAt === "string")) {
          throw new Error("Invalid notification response")
        }
        onSnapshot(items)
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
