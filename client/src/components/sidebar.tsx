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
  FileBarChart,
  Wallet,
  MessageSquare,
  UserCog,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Store,
  HelpCircle,
  Landmark,
  PiggyBank,
  TrendingUp,
  Bot,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

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
  { label: "Messages", href: "/messages", icon: MessageSquare },
  { label: "Employees", href: "/employees", icon: UserCog },
  { label: "Reports", href: "/reports", icon: FileBarChart },
  { label: "Cash Flow", href: "/finance/cashflow", icon: PiggyBank },
  { label: "Financing", href: "/finance/matching", icon: Landmark },
  { label: "Analysis", href: "/finance/analysis", icon: TrendingUp },
  { label: "AI Agents", href: "/finance/agent", icon: Bot },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onNavigate?: () => void
}

export function Sidebar({ collapsed, onToggle, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const { logout, source } = useStore()

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
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/90 hover:bg-sidebar-accent",
            collapsed && "justify-center px-2"
          )}
        >
          <HelpCircle className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Help & Support</span>}
        </button>
        <button onClick={logout}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/90 hover:bg-sidebar-accent",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{source === "mock" ? "Exit demo" : "Log out"}</span>}
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
