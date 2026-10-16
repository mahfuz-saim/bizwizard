"use client"

import * as React from "react"
import { Suspense } from "react"
import { AuthScreen } from "@/components/auth-screen"
import { Sidebar } from "@/components/sidebar"
import { Topbar, MobileNavSheet } from "@/components/topbar"
import { Loader2 } from "lucide-react"
import { useStore } from "@/lib/store"

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const { source } = useStore()

  if (source === "auth") return <AuthScreen />
  if (source === "loading") return <div className="flex min-h-screen items-center justify-center" role="status"><Loader2 className="mr-2 h-6 w-6 animate-spin" />Loading your account…</div>

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
          {source === "mock" && <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">Running in demo mode. Changes are temporary and are not saved to an account. Use the profile menu to exit demo and log in.</div>}
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
