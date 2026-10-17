import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = "৳") {
  return `${currency}${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

/**
 * Shared number formatter used everywhere a figure is shown in the UI: at
 * most `maxDecimals` (default 2) fraction digits, and no trailing zero
 * padding — a whole number stays whole ("5", not "5.00"), and a value with
 * one meaningful decimal keeps just that one ("5.5", not "5.50").
 */
export function formatNumber(n: number | null | undefined, maxDecimals: number = 2): string {
  if (n == null || Number.isNaN(n)) return "0"
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals })
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function getInitials(name: string) {
  if (!name) return "?"
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function generateAvatarColor(name: string) {
  const colors = [
    "hsl(217, 89%, 61%)", // primary blue
    "hsl(25, 95%, 53%)",  // orange
    "hsl(340, 82%, 52%)", // rose
    "hsl(291, 64%, 42%)", // fuchsia
    "hsl(262, 83%, 58%)", // violet
    "hsl(187, 92%, 40%)", // cyan
    "hsl(160, 84%, 39%)", // emerald
    "hsl(45, 93%, 47%)",  // yellow
    "hsl(0, 84%, 60%)",   // red
    "hsl(271, 81%, 56%)", // purple
    "hsl(175, 84%, 32%)", // teal
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}
