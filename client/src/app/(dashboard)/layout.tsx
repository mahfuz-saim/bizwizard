"use client"

import * as React from "react"
import { Suspense } from "react"
import { Sidebar } from "@/components/sidebar"
import { Topbar, MobileNavSheet } from "@/components/topbar"
import { Loader2, WifiOff, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const { source, error, refresh } = useStore()

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
        <Topbar onOpenMobileNav={() => setMobileOpen(true)} />

        {/* Main area scrolls independently; sidebar + topbar stay put */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {source === "loading" || source === "auth" ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
              <p className="text-sm">
                {source === "auth" ? "Authenticating…" : "Connecting to backend…"}
              </p>
            </div>
          ) : source === "mock" ? (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              <WifiOff className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                Running in demo mode. {error || "Start the backend and set NEXT_PUBLIC_DEMO_EMAIL/NEXT_PUBLIC_DEMO_PASSWORD to see live data."}
              </span>
              <Button size="sm" variant="outline" className="gap-1" onClick={refresh}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          ) : null}
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
