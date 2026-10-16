"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageSquare, Send, Bell } from "lucide-react"

export default function MessagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Messages & Notifications</h2>
        <p className="text-sm text-muted-foreground">Send SMS notifications and announcements to customers.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Quick SMS</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Recipients</label>
              <Input placeholder="All customers with due balance" className="mt-1.5" />
            </div>
            <div>
              <label className="text-sm font-medium">Message Template</label>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                <Button variant="outline" className="justify-start">Payment Reminder</Button>
                <Button variant="outline" className="justify-start">Promotional Offer</Button>
                <Button variant="outline" className="justify-start">New Arrival</Button>
                <Button variant="outline" className="justify-start">Custom Message</Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Message</label>
              <textarea className="mt-1.5 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Write your message..."/>
            </div>
            <Button className="gap-2"><Send className="h-4 w-4"/> Send Message</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4"/> Recent Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">Low stock alert</p>
              <p className="text-xs text-muted-foreground">Milk Powder is running low.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">Payment received</p>
              <p className="text-xs text-muted-foreground">Karim Ahmed paid ৳450 via bKash.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">New sale</p>
              <p className="text-xs text-muted-foreground">Rahim Uddin purchased 7 items.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
