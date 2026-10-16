"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useStore } from "@/lib/store"
import { formatDate } from "@/lib/utils"

export default function MessagesPage() {
  const { messages, notifications } = useStore()
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold">Messages & Notifications</h2><p className="text-sm text-muted-foreground">Recorded messages and notifications for this shop. Message composition is not yet connected.</p></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Message History</CardTitle></CardHeader><CardContent className="space-y-3">
        {!messages.length && <p className="text-sm text-muted-foreground">No messages recorded.</p>}
        {messages.map(m => <div key={m.id} className="rounded-lg border p-3"><p className="text-sm">{m.message}</p><p className="my-2 text-xs text-muted-foreground">{formatDate(m.createdAt)}</p><Badge variant="outline">{m.sentStatus || m.approvalStatus || "Recorded"}</Badge></div>)}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Notifications</CardTitle></CardHeader><CardContent className="space-y-3">
        {!notifications.length && <p className="text-sm text-muted-foreground">No notifications recorded.</p>}
        {notifications.map(n => <div key={n.id} className="rounded-lg border p-3"><p className="text-sm font-medium">{n.title}</p><p className="text-sm text-muted-foreground">{n.body}</p><p className="mt-2 text-xs text-muted-foreground">{formatDate(n.createdAt)}</p></div>)}
      </CardContent></Card>
    </div>
  </div>
}
