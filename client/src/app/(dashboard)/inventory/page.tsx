"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import {
  AlertTriangle,
  Filter,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  Barcode,
  MoreVertical,
  Package,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrency, generateAvatarColor, getInitials } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { usePagination } from "@/lib/use-pagination"
import { PaginationBar } from "@/components/ui/pagination-bar"
import type { Product } from "@/lib/types"
import { AddProductDialog } from "@/components/inventory/add-product-dialog"
import { BuyStockDialog } from "@/components/inventory/buy-stock-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SellDialog } from "@/components/inventory/sell-dialog"

export default function InventoryPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { products, deleteProduct } = useStore()

  const [search, setSearch] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all")
  const [stockFilter, setStockFilter] = React.useState<string>("all")
  const [sortBy, setSortBy] = React.useState<string>("name")

  const [addOpen, setAddOpen] = React.useState(false)
  const [buyOpen, setBuyOpen] = React.useState(false)
  const [sellOpen, setSellOpen] = React.useState(false)
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<Product | null>(null)
  const [prefillBuyProduct, setPrefillBuyProduct] = React.useState<Product | null>(null)
  const [prefillSellProduct, setPrefillSellProduct] = React.useState<Product | null>(null)

  // Support deep-linking: ?action=add
  React.useEffect(() => {
    if (searchParams.get("action") === "add") setAddOpen(true)
    if (searchParams.get("filter") === "low-stock") setStockFilter("low")
  }, [searchParams])

  const categories = React.useMemo(() => {
    const set = new Set(products.map((p) => p.category))
    return Array.from(set).sort()
  }, [products])

  const filtered = React.useMemo(() => {
    let list = [...products]
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.variantName || "").toLowerCase().includes(q) ||
          (p.barcode || "").toLowerCase().includes(q) ||
          (p.variantCode || "").toLowerCase().includes(q)
      )
    }
    if (categoryFilter !== "all") list = list.filter((p) => p.category === categoryFilter)
    if (stockFilter === "low") list = list.filter((p) => p.stock <= p.lowStockThreshold)
    if (stockFilter === "out") list = list.filter((p) => p.stock === 0)
    if (stockFilter === "in") list = list.filter((p) => p.stock > p.lowStockThreshold)
    switch (sortBy) {
      case "stockAsc":
        list.sort((a, b) => a.stock - b.stock)
        break
      case "stockDesc":
        list.sort((a, b) => b.stock - a.stock)
      case "priceDesc":
        list.sort((a, b) => b.sellPrice - a.sellPrice)
        break
      case "priceAsc":
        list.sort((a, b) => a.sellPrice - b.sellPrice)
        break
      case "name":
      default:
        list.sort((a, b) => a.name.localeCompare(b.name))
    }
    return list
  }, [products, search, categoryFilter, stockFilter, sortBy])

  const { page, setPage, pageCount, pageItems, rangeStart, rangeEnd, total } = usePagination(
    filtered,
    10,
    `${search}|${categoryFilter}|${stockFilter}|${sortBy}`
  )

  const totalStockValue = products.reduce((s, p) => s + p.stock * p.buyPrice, 0)
  const lowCount = products.filter((p) => p.stock <= p.lowStockThreshold).length
  const outCount = products.filter((p) => p.stock === 0).length

  const openBuy = (p?: Product) => {
    setPrefillBuyProduct(p ?? null)
    setBuyOpen(true)
  }
  const openSell = (p?: Product) => {
    setPrefillSellProduct(p ?? null)
    setSellOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventory</h2>
          <p className="text-sm text-muted-foreground">
            Manage your products, stock levels, pricing and lots.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openBuy()}>
            <Truck className="mr-2 h-4 w-4" /> Buy Stock
          </Button>
          <Button variant="outline" onClick={() => openSell()}>
            <Barcode className="mr-2 h-4 w-4" /> Sell
          </Button>
          <Button onClick={() => { setEditingProduct(null); setAddOpen(true); }}>
            <PackagePlus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="metric-grid grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Products</p>
            <p className="mt-1 text-2xl font-bold">{products.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Stock Value</p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(totalStockValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Low Stock</p>
            <p className="mt-1 text-2xl font-bold text-warning">{lowCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Out of Stock</p>
            <p className="mt-1 text-2xl font-bold text-destructive">{outCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">Products</CardTitle>
            <div className="relative flex-1 md:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, barcode, variant..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={stockFilter} onValueChange={setStockFilter} className="w-auto">
              <TabsList className="grid grid-cols-2 sm:flex">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="in">In Stock</TabsTrigger>
                <TabsTrigger value="low">
                  Low Stock {lowCount > 0 && <Badge variant="warning" className="ml-2 px-1 py-0 text-[10px]">{lowCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="out">Out of Stock</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name (A→Z)</SelectItem>
                  <SelectItem value="stockAsc">Stock (low → high)</SelectItem>
                  <SelectItem value="stockDesc">Stock (high → low)</SelectItem>
                  <SelectItem value="priceAsc">Price (low → high)</SelectItem>
                  <SelectItem value="priceDesc">Price (high → low)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Product Table */}
          <div className="rounded-lg border">
            <Table className="mobile-records inventory-records">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Buy Price</TableHead>
                  <TableHead className="text-right">Sell Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                      <p>No products found</p>
                      <p className="mt-1 text-xs">Try adjusting filters or add a new product.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  pageItems.map((p) => {
                    const lowStock = p.stock <= p.lowStockThreshold
                    const outOfStock = p.stock === 0
                    return (
                      <TableRow key={p.id}>
                        <TableCell data-label="Product">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9" style={{ backgroundColor: generateAvatarColor(p.name) }}>
                              {p.image ? <AvatarImage src={p.image} alt={p.name} /> : null}
                              <AvatarFallback className="bg-transparent text-white text-xs">
                                {getInitials(p.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/inventory/${p.id}`}
                                  className="wrap-break-word text-sm font-medium hover:underline sm:truncate"
                                >
                                  {p.name}
                                </Link>
                                {p.variantCode && (
                                  <span className="hidden sm:inline rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                                    {p.variantCode}
                                  </span>
                                )}
                              </div>
                              {p.variantName && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {p.variantName} · {p.measuringUnit}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell data-label="Category">
                          <Badge variant="outline">{p.category}</Badge>
                        </TableCell>
                        <TableCell data-label="Stock" className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className={`font-semibold ${outOfStock ? "text-destructive" : lowStock ? "text-warning" : ""}`}>
                              {p.stock}
                            </span>
                            {outOfStock ? (
                              <Badge variant="destructive" className="h-5 gap-1 text-[10px]">
                                <AlertTriangle className="h-3 w-3" /> Out
                              </Badge>
                            ) : lowStock ? (
                              <Badge variant="warning" className="h-5 gap-1 text-[10px]">
                                <AlertTriangle className="h-3 w-3" /> Low
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell data-label="Buy price" className="text-right hidden md:table-cell text-muted-foreground">
                          {formatCurrency(p.buyPrice)}
                        </TableCell>
                        <TableCell data-label="Sell price" className="text-right font-semibold">
                          {formatCurrency(p.sellPrice)}
                        </TableCell>
                        <TableCell data-label="Actions" className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openBuy(p)} title="Buy more">
                              <Truck className="h-4 w-4 text-warning" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openSell(p)} title="Sell">
                              <Barcode className="h-4 w-4 text-success" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setEditingProduct(p); setAddOpen(true); }} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/inventory/${p.id}`}>View Details</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openBuy(p)}>
                                  <Truck className="mr-2 h-4 w-4" /> Buy Stock
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openSell(p)}>
                                  <Barcode className="mr-2 h-4 w-4" /> Sell Product
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(p)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
            <PaginationBar
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              total={total}
              itemLabel="products"
            />
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <AddProductDialog
        open={addOpen}
        onOpenChange={(v) => {
          setAddOpen(v)
          if (!v) {
            setEditingProduct(null)
            router.replace("/inventory")
          }
        }}
        product={editingProduct}
      />

      {/* Buy Dialog */}
      <BuyStockDialog
        open={buyOpen}
        onOpenChange={(v) => {
          setBuyOpen(v)
          if (!v) setPrefillBuyProduct(null)
        }}
        prefillProduct={prefillBuyProduct}
      />

      {/* Sell Dialog */}
      <SellDialog
        open={sellOpen}
        onOpenChange={(v) => {
          setSellOpen(v)
          if (!v) setPrefillSellProduct(null)
        }}
        prefillProduct={prefillSellProduct}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.name}</strong> from your inventory.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) void deleteProduct(deleteTarget.id).catch(() => { /* Store displays the backend error. */ })
                setDeleteTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
