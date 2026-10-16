"use client"

import Link from "next/link"
import { AlertTriangle, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { generateAvatarColor } from "@/lib/utils"
import type { Product } from "@/lib/types"

export function LowStockAlert({ products }: { products: Product[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Low Stock Alerts
        </CardTitle>
        <Link
          href="/inventory?filter=low-stock"
          className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Manage <ChevronRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="divide-y">
        {products.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            🎉 All products are well-stocked
          </p>
        ) : (
          products.slice(0, 5).map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Avatar className="h-9 w-9" style={{ backgroundColor: generateAvatarColor(p.name) }}>
                <AvatarFallback className="bg-transparent text-white text-xs">
                  {p.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {p.name}
                  {p.variantName && <span className="text-muted-foreground"> · {p.variantName}</span>}
                </p>
                <p className="text-xs text-muted-foreground">Threshold: {p.lowStockThreshold}</p>
              </div>
              <Badge variant={p.stock === 0 ? "destructive" : "warning"}>
                {p.stock} left
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
