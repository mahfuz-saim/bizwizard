"use client"

import Link from "next/link"
import * as React from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Barcode,
  Calculator,
  CreditCard,
  Package,
  PackagePlus,
  Receipt,
  TrendingUp,
  Truck,
  Users,
  UserCog,
  Wallet,
  FileBarChart,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn, formatCurrency } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { RecentTransactions } from "@/components/recent-transactions"
import { LowStockAlert } from "@/components/low-stock-alert"

interface StatCardProps {
  label: string
  value: string
  subLabel?: string
  subValue?: string
  trend?: "up" | "down"
  icon: React.ComponentType<{ className?: string }>
  accent?: string
}

function StatCard({ label, value, subLabel, subValue, trend, icon: Icon, accent = "text-brand-500" }: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
            {subLabel && subValue && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                {trend && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 font-medium",
                      trend === "up" ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
                    )}
                  >
                    {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  </span>
                )}
                <span className="font-medium text-foreground">{subValue}</span>
                <span>{subLabel}</span>
              </div>
            )}
          </div>
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/30", accent)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const quickActions = [
  { label: "Add Product", href: "/inventory?action=add", icon: PackagePlus, color: "bg-brand-100 text-brand-700 dark:bg-brand-800/40 dark:text-brand-200" },
  { label: "New Sale", href: "/sell", icon: Barcode, color: "bg-success/15 text-success" },
  { label: "New Buy", href: "/buy", icon: Truck, color: "bg-warning/15 text-warning" },
  { label: "Customer", href: "/customers", icon: Users, color: "bg-brand-100 text-brand-700 dark:bg-brand-800/40 dark:text-brand-200" },
  { label: "Expense", href: "/expenses", icon: Wallet, color: "bg-destructive/10 text-destructive" },
  { label: "Reports", href: "/reports", icon: FileBarChart, color: "bg-brand-100 text-brand-700 dark:bg-brand-800/40 dark:text-brand-200" },
]

const modules = [
  { label: "Inventory", href: "/inventory", icon: Package },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Suppliers", href: "/suppliers", icon: Truck },
  { label: "Employees", href: "/employees", icon: UserCog },
  { label: "Debts", href: "/debts", icon: CreditCard },
  { label: "Expense", href: "/expenses", icon: Wallet },
  { label: "Reports", href: "/reports", icon: FileBarChart },
]

export default function DashboardPage() {
  const { stats, transactions, products } = useStore()

  const profitChange = stats.yesterdayProfit
    ? ((stats.todayProfit - stats.yesterdayProfit) / stats.yesterdayProfit) * 100
    : 0

  return (
    <div className="space-y-6">
      {/* Greeting + Sell Banner */}
      <div className="flex flex-col gap-4 rounded-xl bg-gradient-to-r from-brand-700 to-brand-500 p-6 text-white shadow-md md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Welcome back 👋</h2>
          <p className="mt-1 text-sm text-brand-100">
            Here's what's happening with your store today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg" variant="secondary" className="bg-white/20 text-white hover:bg-white/30">
            <Link href="/buy">
              <Truck className="mr-2 h-5 w-5" /> Buy Stock
            </Link>
          </Button>
          <Button asChild size="lg" className="bg-white text-brand-700 hover:bg-brand-50">
            <Link href="/sell">
              <Barcode className="mr-2 h-5 w-5" /> Start Selling
            </Link>
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's Sales"
          value={formatCurrency(stats.todaySell)}
          subLabel="discount given"
          subValue={formatCurrency(stats.todayDiscount)}
          icon={Banknote}
          trend="up"
        />
        <StatCard
          label="Today's Profit"
          value={formatCurrency(stats.todayProfit)}
          subLabel="vs yesterday"
          subValue={`${profitChange >= 0 ? "+" : ""}${profitChange.toFixed(1)}%`}
          icon={TrendingUp}
          trend={profitChange >= 0 ? "up" : "down"}
        />
        <StatCard
          label="Outstanding Debt"
          value={formatCurrency(stats.todayDebt)}
          subLabel="pending"
          subValue="Receivable"
          icon={Receipt}
        />
        <StatCard
          label="Low Stock Items"
          value={String(stats.lowStockCount)}
          subLabel="of"
          subValue={`${stats.totalProducts} products`}
          icon={Package}
          accent={stats.lowStockCount > 0 ? "text-warning" : "text-brand-500"}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {quickActions.map((a) => {
            const Icon = a.icon
            return (
              <Button
                key={a.label}
                asChild
                variant="ghost"
                className="flex h-auto flex-col items-center gap-2 rounded-xl p-3 text-foreground hover:bg-muted"
              >
                <Link href={a.href}>
                  <span className={cn("flex h-12 w-12 items-center justify-center rounded-xl", a.color)}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="text-xs font-medium">{a.label}</span>
                </Link>
              </Button>
            )
          })}
        </CardContent>
      </Card>

      {/* Modules grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {modules.map((m) => {
          const Icon = m.icon
          return (
            <Link
              key={m.label}
              href={m.href}
              className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-all hover:border-brand-400 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-500 group-hover:text-white dark:bg-brand-900/40 dark:text-brand-200">
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium">{m.label}</span>
            </Link>
          )
        })}
      </div>

      {/* Lower grid: recent tx + low stock */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentTransactions transactions={transactions.slice(0, 5)} />
        </div>
        <LowStockAlert products={products.filter((p) => p.stock <= p.lowStockThreshold)} />
      </div>
    </div>
  )
}
