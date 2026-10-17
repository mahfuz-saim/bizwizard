export type MeasuringUnit =
  | "Piece (pc)"
  | "Kilogram (kg)"
  | "Gram (g)"
  | "Litre (L)"
  | "Millilitre (mL)"
  | "Dozen (doz)"
  | "Box (box)"
  | "Carton"
  | "Bag"
  | "Bottle"
  | "Roll"
  | "Packet"
  | "Meter (m)"
  | "Feet (ft)"

export interface Product {
  id: string
  name: string
  variantName?: string
  variantCode?: string
  barcode?: string
  category: string
  measuringUnit: MeasuringUnit
  image?: string
  stock: number
  lots?: { id: string; stock: number; buyPrice?: number | null; sellPrice?: number | null; expDate?: string | null }[]
  lowStockThreshold: number
  buyPrice: number
  sellPrice: number
  expiryDate?: string
  lastSoldDate?: string
  createdAt: string
  updatedAt: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  address?: string
  totalDue: number
  totalPurchased: number
  createdAt: string
}

export interface Supplier {
  id: string
  name: string
  phone: string
  email?: string
  address?: string
  paymentTracked?: boolean
  totalPurchased?: number
  userID?: string
  totalPaid: number
  totalDue: number
  createdAt: string
}

export interface Employee {
  id: string
  name: string
  phone: string
  role: "OWNER" | "EMPLOYEE" | "ADMIN"
  joinedAt: string
}

export interface Transaction {
  id: string
  type: "SALE" | "BUY" | "EXPENSE" | "PAYMENT"
  customerId?: string
  customerName?: string
  supplierId?: string
  supplierName?: string
  items: TransactionItem[]
  subtotal: number
  discount: number
  total: number
  paid: number
  due: number
  paymentMethod: "CASH" | "BKASH" | "NAGAD" | "CARD" | "BANK" | "UNKNOWN"
  note?: string
  createdAt: string
  cost?: number
  paymentTracked?: boolean
  soldBy?: string
}

export interface TransactionItem {
  productId: string
  productName: string
  variantName?: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Expense {
  id: string
  category: string
  amount: number
  note?: string
  date: string
}

export interface DashboardStats {
  todaySell: number
  todayProfit: number
  todayDebt: number
  todayDiscount: number
  yesterdayProfit: number
  totalProducts: number
  lowStockCount: number
  totalCustomers: number
  totalSuppliers: number
}

export interface ShopNotification { id: string; title: string; body: string; createdAt: string; ReadStatus?: { isRead: boolean }[] }
