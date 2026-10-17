"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Bell, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import * as Popover from "@radix-ui/react-popover"
import { api, getApiBaseUrl } from "@/lib/api"
import { useStore } from "@/lib/store"
import type { ShopNotification } from "@/lib/types"
import { isUnread, newNotifications, NOTIFICATION_TOAST_MS, readNotificationStream } from "@/lib/notifications"
import { cn } from "@/lib/utils"

function NotificationToast({ item, onDismiss }: { item: ShopNotification; onDismiss: (id: string) => void }) {
  React.useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), NOTIFICATION_TOAST_MS)
    return () => clearTimeout(timer)
  }, [item.id, onDismiss])
  return <div role="status" className="pointer-events-auto flex gap-3 rounded-lg border bg-background p-4 text-foreground shadow-lg">
    <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
    <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{item.title}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.body}</p></div>
    <button aria-label="Dismiss notification toast" className="self-start rounded p-1 hover:bg-muted" onClick={() => onDismiss(item.id)}><X className="h-4 w-4" /></button>
  </div>
}

export function NotificationBell() {
  const { notifications: items, updateNotifications: setItems, session, source } = useStore()
  const baseline = React.useRef(items)
  const [toasts, setToasts] = React.useState<ShopNotification[]>([])
  const [connectionError, setConnectionError] = React.useState("")
  const [readError, setReadError] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const dismiss = React.useCallback((id: string) => setToasts(current => current.filter(item => item.id !== id)), [])

  React.useEffect(() => {
    if (source !== "backend" || !session?.shopId || !session.tenantId) return
    const controller = new AbortController()
    const seen = new Set(baseline.current.map(item => item.id))
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let retries = 0
    const connect = async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/notifications/stream/${encodeURIComponent(session.shopId!)}`, {
          headers: { Authorization: `Bearer ${session.accessToken}`, "x-tenant-id": session.tenantId!, Accept: "text/event-stream" },
          credentials: "include", cache: "no-store", signal: controller.signal,
        })
        if (response.status === 401 || response.status === 403) {
          setConnectionError("Notification access expired. Refresh your account or log in again.")
          return
        }
        await readNotificationStream(response, snapshot => {
          if (controller.signal.aborted) return
          retries = 0
          setConnectionError("")
          const fresh = newNotifications(snapshot, seen)
          setItems(snapshot)
          if (fresh.length) setToasts(current => [...current, ...fresh])
        })
        if (!controller.signal.aborted) throw new Error("Notification stream disconnected")
      } catch {
        if (controller.signal.aborted) return
        setConnectionError("Live notifications disconnected. Reconnecting…")
        retryTimer = setTimeout(() => void connect(), Math.min(30000, 1000 * 2 ** retries++))
      }
    }
    void connect()
    return () => { controller.abort(); clearTimeout(retryTimer) }
  }, [setItems, source, session?.shopId, session?.tenantId, session?.accessToken])

  const unread = items.filter(isUnread)
  const markRead = async (targets: ShopNotification[]) => {
    if (!session?.shopId || saving) return
    setSaving(true)
    setReadError("")
    try {
      await Promise.all(targets.map(async item => {
        await api.post(`/notifications/mark-read/${encodeURIComponent(item.id)}`, { shopId: session.shopId })
        setItems(current => current.map(n => n.id === item.id ? { ...n, ReadStatus: [{ isRead: true }] } : n))
      }))
    } catch { setReadError("Could not mark notifications as read. Please try again.") }
    finally { setSaving(false) }
  }

  return <>
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`}>
          <Bell className="h-5 w-5" />
          {unread.length > 0 && <span aria-hidden="true" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />}
        </Button>
      </Popover.Trigger>
      <Popover.Portal><Popover.Content align="end" sideOffset={8} aria-label="Notifications" className="z-50 w-[min(24rem,calc(100vw-2rem))] rounded-md border bg-popover p-0 text-popover-foreground shadow-lg outline-none">
        <div className="flex items-center justify-between gap-3 p-3">
          <span>Notifications {unread.length > 0 && `(${unread.length})`}</span>
          <Button size="sm" variant="ghost" disabled={!unread.length || saving} onClick={() => void markRead(unread)}>Mark all read</Button>
        </div>
        <hr className="m-0" />
        {connectionError && <p role="status" className="p-3 text-xs text-muted-foreground">{connectionError}</p>}
        {readError && <p role="alert" className="p-3 text-xs text-destructive">{readError}</p>}
        <div className="max-h-96 overflow-y-auto" role="list" aria-label="Notification list">
          {items.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No notifications yet. You’re all caught up.</p>}
          {items.map(item => <div key={item.id} role="listitem" className={cn("border-b p-3 last:border-0", isUnread(item) && "bg-primary/5")}>
            <div className="flex items-start gap-2"><p className="min-w-0 flex-1 break-words text-sm font-semibold">{item.title}</p>{isUnread(item) && <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" aria-label={`Mark ${item.title} as read`} disabled={saving} onClick={() => void markRead([item])}><Check className="h-4 w-4" /></Button>}</div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.body}</p>
            <time dateTime={item.createdAt} className="mt-2 block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</time>
          </div>)}
        </div>
      </Popover.Content></Popover.Portal>
    </Popover.Root>
    {toasts.length > 0 && createPortal(<div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-label="New notifications">
      {toasts.map(item => <NotificationToast key={item.id} item={item} onDismiss={dismiss} />)}
    </div>, document.body)}
  </>
}
