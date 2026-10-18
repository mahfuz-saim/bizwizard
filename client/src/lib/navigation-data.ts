import { api } from './api'
import { normalizeCheckout, normalizePurchase, type RawCheckout, type RawExpenseItem } from './shop-data'
import type { Expense } from './types'

export interface TransactionPage {
  checkouts: RawCheckout[]
  purchases: RawExpenseItem[]
  total: number
  page: number
  totals: { sales: number; purchases: number; due: number }
  unitsSold?: number
}
export interface ExpensePage {
  rows: Expense[]; total: number; page: number
  totalAmount: number; monthTotal: number; categories: number
}
export interface ReportSummary {
  totalRevenue: number; totalCost: number; weekRevenue: number; monthRevenue: number
  months: { key: string; total: number }[]
}
export async function loadNavigationData<T>(section: string, shopId: string, params: Record<string, string | number> = {}) {
  const response = await api.get<T>(`/analytics/navigation/${section}`, { ...params, shopId })
  if (!response.data) throw new Error('Missing page data. Please retry.')
  return response.data
}
export function pageTransactions(data: TransactionPage) {
  return [...data.checkouts.map(normalizeCheckout), ...data.purchases.map(e => normalizePurchase(e))]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id) || a.type.localeCompare(b.type))
}
export function pageRange(page: number, total: number) {
  return { page, total, pageCount: Math.max(1, Math.ceil(total / 10)), rangeStart: total ? (page - 1) * 10 + 1 : 0, rangeEnd: Math.min(page * 10, total) }
}
