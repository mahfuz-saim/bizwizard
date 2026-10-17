"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Truck,
  Receipt,
  Wallet,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Store,
  HelpCircle,
  Landmark,
  PiggyBank,
  TrendingUp,
  Bot,
  Zap,
  RadioTower,
  FastForward,
  RotateCcw,
  Check,
  Loader2,
  Pause,
  Play,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDurationMs, MAX_SPEED_MS, MIN_SPEED_MS, SPEED_PRESETS, TRANSACTION_TEMPLATES, useSimulator } from "@/lib/simulator-context"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const primaryNav: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Inventory", href: "/inventory", icon: Package },
  { label: "Sales", href: "/sales", icon: ShoppingCart },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Suppliers", href: "/suppliers", icon: Truck },
  { label: "Expenses", href: "/expenses", icon: Wallet },
  { label: "Debts", href: "/debts", icon: Receipt },
  { label: "Employees", href: "/employees", icon: UserCog },
  { label: "Cash Flow", href: "/finance/cashflow", icon: PiggyBank },
  { label: "Financing", href: "/finance/matching", icon: Landmark },
  { label: "Analysis & Reports", href: "/finance/analysis", icon: TrendingUp },
  { label: "AI Agents", href: "/finance/agent", icon: Bot },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onNavigate?: () => void
}

export function Sidebar({ collapsed, onToggle, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const sim = useSimulator()
  const [simOpen, setSimOpen] = React.useState(false)
  // Uncontrolled-by-design: keyed on sim.speedMs so picking a preset (or
  // Apply succeeding) refreshes the shown default without needing an effect,
  // while free typing in between stays local until Apply/Enter is pressed.
  const [customMs, setCustomMs] = React.useState(String(sim.speedMs))
  const simPlaying = sim.status === "playing"
  const simPaused = sim.status === "paused"
  const simActive = simPlaying || simPaused
  const simLoading = sim.status === "loading"
  const simCanReset = sim.result != null && !simActive && sim.status !== "loading"

  const applyCustomSpeed = () => {
    const parsed = Number(customMs)
    if (Number.isFinite(parsed) && parsed > 0) sim.setSpeedMs(parsed)
  }

  const estimatedRowsForTemplate = TRANSACTION_TEMPLATES.find((t) => t.id === sim.template)?.estimatedRows ?? 90
  const totalForEstimate = sim.totalEvents || estimatedRowsForTemplate
  const remainingForEstimate = simActive ? Math.max(0, totalForEstimate - sim.revealedEvents) : totalForEstimate
  const estimateMs = remainingForEstimate * sim.speedMs
  const estimateLabel = simActive ? "Time remaining" : sim.result ? "Total time (last run)" : "Estimated total time"

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        "hidden md:flex h-screen shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Brand */}
      <div className="shrink-0 flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Store className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-base font-semibold leading-tight">BizWizard</span>
            <span className="text-xs text-brand-200/90">Inventory · Sales</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4 scrollbar-thin">
        {primaryNav.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          const link = (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
          return collapsed ? (
            <Tooltip key={item.href} delayDuration={100}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ) : (
            link
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-2 space-y-1">
        <Popover open={simOpen} onOpenChange={setSimOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/90 hover:bg-sidebar-accent",
                collapsed && "justify-center px-2"
              )}
            >
              <Zap className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <span className="flex flex-1 items-center justify-between">
                  Finance Simulator
                  {simActive && (
                    <span className="text-xs font-normal text-sidebar-foreground/60">
                      {simPaused ? "Paused" : `Day ${sim.dayIndex}/30`}
                    </span>
                  )}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" sideOffset={10} className="w-80 text-foreground">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-300">
              <Zap className="h-4 w-4" /> Finance Simulator
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Runs 30 days of real, tagged transactions against your shop and streams them in one at a time — nothing here is staged.
            </p>

            <div className="space-y-1">
              <button
                onClick={() => sim.setDrawerOpen(!sim.drawerOpen)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <RadioTower className="h-4 w-4" />
                Live business stream
              </button>

              {!simActive && !simLoading && (
                <button
                  onClick={() => void sim.runFastForward()}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <Zap className="h-4 w-4" />
                  Fast-forward 30 days
                </button>
              )}

              {simLoading && (
                <div className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Writing 30 days…
                </div>
              )}

              {simActive && (
                <>
                  <div className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground">
                    {simPlaying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
                    {simPaused ? "Paused" : "Playing"} — day {sim.dayIndex}/30 · {sim.revealedEvents}/{sim.totalEvents} transactions
                  </div>
                  <button
                    onClick={() => (simPlaying ? sim.pauseSimulation() : sim.resumeSimulation())}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    {simPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {simPlaying ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => sim.skipToEnd()}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <FastForward className="h-4 w-4" />
                    Instant (skip to end)
                  </button>
                </>
              )}

              {simCanReset && (
                <button
                  onClick={() => void sim.resetSimulation()}
                  disabled={sim.status === "resetting"}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                >
                  {sim.status === "resetting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Reset simulation
                </button>
              )}
            </div>

            <div className="mt-3 border-t pt-2">
              <p className="mb-1 px-2 text-[11px] font-medium text-muted-foreground">
                Transaction template {simActive || simLoading ? "(applies to next run)" : ""}
              </p>
              <div className="grid grid-cols-2 gap-1 px-1">
                {TRANSACTION_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => sim.setTemplate(t.id)}
                    disabled={simActive || simLoading}
                    className={cn(
                      "rounded-md border px-2 py-1.5 text-left transition-colors disabled:pointer-events-none disabled:opacity-50",
                      sim.template === t.id ? "border-brand-500 bg-brand-50 dark:bg-brand-950/40" : "border-border hover:bg-accent"
                    )}
                  >
                    <span className="flex items-center gap-1 text-xs font-medium">
                      {sim.template === t.id && <Check className="h-3 w-3" />}
                      {t.label}
                    </span>
                    <span className="text-[10px] leading-snug text-muted-foreground">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>


            <div className="mt-3 border-t pt-2">
              <p className="mb-1 px-2 text-[11px] font-medium text-muted-foreground">Playback speed (delay per transaction)</p>
              <div className="space-y-1">
                {SPEED_PRESETS.map((p) => (
                  <button
                    key={p.ms}
                    onClick={() => sim.setSpeedMs(p.ms)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="flex h-4 w-4 items-center justify-center">{sim.speedMs === p.ms ? <Check className="h-4 w-4" /> : null}</span>
                    {p.label}
                    <span className="ml-auto text-xs text-muted-foreground">{p.ms}ms/txn · {p.hint}</span>
                  </button>
                ))}
              </div>

              <div className="mt-2 flex items-center gap-1.5 px-2">
                <Input
                  key={sim.speedMs}
                  type="number"
                  min={MIN_SPEED_MS}
                  max={MAX_SPEED_MS}
                  defaultValue={sim.speedMs}
                  onChange={(e) => setCustomMs(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyCustomSpeed() }}
                  className="h-7 w-20 text-xs"
                  aria-label="Custom delay in milliseconds per transaction"
                />
                <span className="text-xs text-muted-foreground">ms/txn</span>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={applyCustomSpeed}>
                  Apply
                </Button>
              </div>

              <p className="mt-1.5 px-2 text-[11px] text-muted-foreground">
                {sim.speedMs}ms/transaction · {estimateLabel.toLowerCase()}: ~{formatDurationMs(estimateMs)}
                {!sim.result && " (estimate)"}
              </p>
            </div>

            {sim.error && <p role="alert" className="mt-2 text-xs text-destructive">{sim.error}</p>}
          </PopoverContent>
        </Popover>

        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/90 hover:bg-sidebar-accent",
            collapsed && "justify-center px-2"
          )}
        >
          <HelpCircle className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Help & Support</span>}
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "w-full mt-1 justify-center text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "px-0"
          )}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          {!collapsed && <span className="ml-2">Collapse</span>}
        </Button>
      </div>
    </aside>
  )
}
