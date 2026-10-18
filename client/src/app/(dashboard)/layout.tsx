"use client"

import * as React from "react"
import { Suspense } from "react"
import { AuthScreen } from "@/components/auth-screen"
import { Sidebar } from "@/components/sidebar"
import { Topbar, MobileNavSheet } from "@/components/topbar"
import { DashboardSkeleton } from "@/components/dashboard-skeleton"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import { FinanceSimulatorProvider, useSimulator } from "@/lib/simulator-context"
import { SimulatorDrawer } from "@/components/finance/simulator-drawer"
import { SimulatorToastHost } from "@/components/finance/simulator-toasts"
import { PageRefreshState } from "@/components/page-load-state"

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const { source, error, refresh, logout, session, simulationSourceId } = useStore()
  const sim = useSimulator()

  if (source === "auth") return <AuthScreen />
  if (source === "error") return <main className="flex h-screen flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center"><h1 className="text-xl font-semibold">Unable to load your shop</h1><p role="alert" className="max-w-xl text-sm text-destructive">{error}</p><p className="text-sm text-muted-foreground">No zero balances or demo records are being substituted.</p><Button onClick={() => void refresh()}>Retry</Button><Button variant="outline" onClick={logout}>Log out</Button></main>
  if (source === "loading") return <DashboardSkeleton />

  return (
    <>
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
            {simulationSourceId && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"><p><strong>Simulation demo workspace</strong> — copied ledger; your source shop is unchanged. {sim.result && `Simulation date: ${sim.result.dailyEvents[Math.max(0, sim.dayIndex - 1)]?.date ?? sim.result.startedAt.slice(0, 10)}`}</p><Button size="sm" variant="outline" disabled={["loading", "resetting", "playing", "paused"].includes(sim.status)} onClick={() => void sim.resetSimulation()}>Reset demo from source</Button><Button size="sm" variant="outline" disabled={sim.status === "loading" || sim.status === "resetting"} onClick={() => void sim.exitSimulation()}>Return to source shop</Button></div>}
            {source === "mock" && <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">Running in demo mode. Changes are temporary and are not saved to an account. Use the profile menu to exit demo and log in.</div>}
            {error && <div className="mb-4"><PageRefreshState loading={false} error={error} retry={() => void refresh(false)} /></div>}
            {children}
          </main>
        </div>
      </div>
      <SimulatorDrawer />
      <SimulatorToastHost />
    </>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session } = useStore()
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <FinanceSimulatorProvider key={session?.user?.id ?? "anonymous"}><DashboardShell>{children}</DashboardShell></FinanceSimulatorProvider>
    </Suspense>
  )
}
