"use client"

import * as React from "react"
import { Suspense } from "react"
import { AuthScreen } from "@/components/auth-screen"
import { Sidebar } from "@/components/sidebar"
import { Topbar, MobileNavSheet } from "@/components/topbar"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import { usePathname, useSearchParams } from "next/navigation"

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const { source, error, refresh, logout, session, historyLoaded, loadHistory } = useStore()
  const pathname = usePathname()
  const params = useSearchParams()
  const needsHistory = pathname !== "/" && (!pathname.startsWith("/finance/") || (pathname === "/finance/analysis" && params.get("tab") === "reports"))
  React.useEffect(() => {
    if (source === "backend" && needsHistory && !historyLoaded) void loadHistory()
  }, [source, needsHistory, historyLoaded, loadHistory])

  if (source === "auth") return <AuthScreen />
  if (source === "error") return <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"><h1 className="text-xl font-semibold">Unable to load your shop</h1><p role="alert" className="max-w-xl text-sm text-destructive">{error}</p><p className="text-sm text-muted-foreground">No zero balances or demo records are being substituted.</p><Button onClick={() => void refresh()}>Retry</Button><Button variant="outline" onClick={logout}>Log out</Button></main>
  if (source === "loading" || (source === "backend" && needsHistory && !historyLoaded)) return <div className="flex min-h-screen items-center justify-center" role="status"><Loader2 className="mr-2 h-6 w-6 animate-spin" />{needsHistory ? "Loading complete shop history…" : "Loading your account…"}</div>

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar: fixed (flex-shrink-0) and never scrolls with the page */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        onNavigate={() => setMobileOpen(false)}
      />
      <MobileNavSheet open={mobileOpen} onOpenChange={setMobileOpen} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onOpenMobileNav={() => setMobileOpen(true)} shopName={session?.tenants?.flatMap(t => t.shops).find(s => s.id === session.shopId)?.shopName || (source === "mock" ? "Demo Store" : "My Store")} />

        {/* Main area scrolls independently; sidebar + topbar stay put */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {source === "mock" && <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">Running in demo mode. Changes are temporary and are not saved to an account. Use the profile menu to exit demo and log in.</div>}
          {error && <p role="alert" className="mb-4 rounded-lg border border-destructive p-3 text-sm text-destructive">{error}</p>}
          {children}
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      }
    >
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  )
}
