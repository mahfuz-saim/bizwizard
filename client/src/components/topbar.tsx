"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Menu,
  Moon,
  Search,
  Sun,
  Store,
  Plus,
  Barcode,
  RefreshCw,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useTheme } from "@/components/theme-provider"
import { cn, getInitials } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useStore } from "@/lib/store"
import { NotificationBell } from "@/components/notification-bell"
import { getApiBaseUrl } from "@/lib/api"

interface TopbarProps {
  onOpenMobileNav: () => void
  shopName?: string
}

export function Topbar({ onOpenMobileNav, shopName = "My Store" }: TopbarProps) {
  const { setTheme, resolvedTheme } = useTheme()
  const pathname = usePathname()
  const { source, error, refresh, logout, session } = useStore()
  const [refreshing, setRefreshing] = React.useState(false)
  const user = session?.user
  const profileName = source === "mock"
    ? "Demo User"
    : user?.name?.trim() || user?.email || user?.number || "My account"
  const profileContact = source === "mock"
    ? "Local demo · No account connected"
    : user?.email || user?.number || ""


  const pageTitle = React.useMemo(() => {
    if (pathname === "/") return "Dashboard"
    if (pathname === "/finance/analysis") return "Analysis & Reports"
    const segment = pathname.split("/").filter(Boolean)[0]
    return segment.charAt(0).toUpperCase() + segment.slice(1)
  }, [pathname])

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark")

  const handleRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setTimeout(() => setRefreshing(false), 400)
  }

  const apiBase = getApiBaseUrl()
  const host = (() => {
    try { return new URL(apiBase).host } catch { return apiBase }
  })()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onOpenMobileNav}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open menu</span>
      </Button>

      <div className="flex flex-1 items-center gap-3">
        <div className="md:hidden flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Store className="h-4 w-4" />
          </div>
          <span className="font-semibold">BizWizard</span>
        </div>

        <div className="hidden md:flex flex-col">
          <span className="text-xs text-muted-foreground">{shopName}</span>
          <h1 className="text-lg font-semibold leading-tight">{pageTitle}</h1>
        </div>

        <div className="relative ml-auto w-full max-w-sm md:ml-6 md:mx-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products, customers..." className="pl-9 pr-4" />
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="hidden sm:inline-flex gap-2"
            >
              {source === "loading" || refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : source === "backend" ? (
                <Wifi className="h-4 w-4 text-success" />
              ) : (
                <WifiOff className="h-4 w-4 text-warning" />
              )}
              <span className="hidden lg:inline text-xs">
                {source === "loading"
                  ? "Connecting…"
                  : source === "backend"
                    ? "Live"
                    : "Demo data"}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            {source === "backend" && (
              <>
                <p className="font-medium text-foreground">Connected to backend</p>
                <p className="text-muted-foreground">{host}</p>
              </>
            )}
            {source === "mock" && (
              <>
                <p className="font-medium text-foreground">Using demo data</p>
                <p className="text-muted-foreground">
                  {error || "Local sample data. No backend requests are made."}
                </p>
              </>
            )}
            {source === "loading" && <p>Connecting to {host}…</p>}
            <p className="mt-1 text-[10px] text-muted-foreground">Refresh live data</p>
          </TooltipContent>
        </Tooltip>

        <Button asChild variant="default" size="sm" className="hidden sm:inline-flex">
          <Link href="/sell">
            <Barcode className="mr-2 h-4 w-4" />
            Sell
          </Link>
        </Button>
        <Button asChild variant="outline" size="icon" className="hidden md:inline-flex">
          <Link href="/inventory?action=add">
            <Plus className="h-4 w-4" />
            <span className="sr-only">Add product</span>
          </Link>
        </Button>

        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span className="sr-only">Toggle theme</span>
        </Button>

        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label={`Open profile menu for ${profileName}`}>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {getInitials(profileName)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{profileName}</span>
                {profileContact && <span className="text-xs text-muted-foreground break-all">{profileContact}</span>}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleRefresh() }}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {source === "backend" ? "Refresh data" : "Demo data (local)"}
            </DropdownMenuItem>
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Help & Support</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout} className="text-destructive focus:text-destructive">
              {source === "mock" ? "Exit demo" : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

interface MobileNavSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function MobileNavSheet({ open, onOpenChange }: MobileNavSheetProps) {
  const pathname = usePathname()
  const navItems = [
    { label: "Dashboard", href: "/" },
    { label: "Inventory", href: "/inventory" },
    { label: "Sales", href: "/sales" },
    { label: "Customers", href: "/customers" },
    { label: "Suppliers", href: "/suppliers" },
    { label: "Expenses", href: "/expenses" },
    { label: "Debts", href: "/debts" },
    { label: "Employees", href: "/employees" },
    { label: "Cash Flow", href: "/finance/cashflow" },
    { label: "Financing", href: "/finance/matching" },
    { label: "Analysis & Reports", href: "/finance/analysis" },
    { label: "AI Agents", href: "/finance/agent" },
  ]
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold leading-tight">BizWizard</div>
            <div className="text-xs text-brand-200/90">Inventory · Sales</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onOpenChange(false)}
              className={cn(
                "rounded-md px-3 py-2.5 text-sm font-medium",
                (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-sidebar-accent"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
