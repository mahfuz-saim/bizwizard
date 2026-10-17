"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PaginationBarProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  rangeStart: number
  rangeEnd: number
  total: number
  itemLabel?: string
  className?: string
}

/** Shared Prev/Next pagination bar for any long list/table in the app. */
export function PaginationBar({
  page,
  pageCount,
  onPageChange,
  rangeStart,
  rangeEnd,
  total,
  itemLabel = "results",
  className = "",
}: PaginationBarProps) {
  if (total === 0 || pageCount <= 1) return null

  return (
    <div
      className={`flex flex-col gap-2 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <p className="text-xs text-muted-foreground">
        Showing {rangeStart}–{rangeEnd} of {total} {itemLabel}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous page</span>
        </Button>
        <span className="px-2 text-xs font-medium tabular-nums">
          Page {page} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next page</span>
        </Button>
      </div>
    </div>
  )
}
