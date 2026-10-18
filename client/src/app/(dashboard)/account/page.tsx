"use client"

import { useStore } from "@/lib/store"
import { useTheme } from "@/components/theme-provider"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AccountPage() {
  const { session, source } = useStore()
  const { theme, setTheme } = useTheme()
  return <div className="space-y-6">
    <h2 className="text-2xl font-bold tracking-tight">Profile &amp; settings</h2>
    <Card><CardHeader><CardTitle>Account details</CardTitle></CardHeader><CardContent className="space-y-2 text-sm wrap-break-word">
      <p>Name: {session?.user?.name || (source === "mock" ? "Demo User" : "Not provided")}</p>
      <p>Email: {session?.user?.email || "Not provided"}</p>
      <p>Phone: {session?.user?.number || "Not provided"}</p>
      <p>Role: {session?.role || "Local demo"}</p>
      <p className="text-muted-foreground">Account details are read-only here. Ask your shop owner or administrator to arrange account changes.</p>
    </CardContent></Card>
    <Card id="appearance"><CardHeader><CardTitle>Appearance</CardTitle></CardHeader><CardContent>
      <div className="flex flex-wrap gap-2">{(["light", "dark", "system"] as const).map(value => <Button key={value} aria-pressed={theme === value} variant={theme === value ? "default" : "outline"} onClick={() => setTheme(value)}>{value.charAt(0).toUpperCase() + value.slice(1)}</Button>)}</div>
      <p className="mt-3 text-sm text-muted-foreground">Saved on this browser. This does not change other users’ settings.</p>
    </CardContent></Card>
  </div>
}
