"use client"

import * as React from "react"

export interface UsePaginationResult<T> {
  page: number
  setPage: (page: number) => void
  pageCount: number
  pageItems: T[]
  pageSize: number
  total: number
  rangeStart: number
  rangeEnd: number
}

/**
 * Client-side pagination over an already-loaded array. Pages with large
 * result sets (inventory, sales, customers, ...) were rendering every row at
 * once, which got slow once a shop had hundreds/thousands of records — this
 * slices the (already filtered/sorted) list down to one page at a time.
 *
 * Pass `resetKey` with a value derived from any active filters/search/tabs
 * so the page resets to 1 whenever those change (otherwise a narrower filter
 * could leave the view on an out-of-range page).
 */
export function usePagination<T>(
  items: T[],
  pageSize = 10,
  resetKey?: unknown
): UsePaginationResult<T> {
  const [page, setPage] = React.useState(1)

  // Reset to page 1 whenever the caller's filter key changes. Adjusting
  // state while rendering (storing the previous key in state, not a ref) is
  // the React-recommended way to do this without an effect.
  const [prevResetKey, setPrevResetKey] = React.useState(resetKey)
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey)
    if (page !== 1) setPage(1)
  }

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * pageSize

  const pageItems = React.useMemo(
    () => items.slice(start, start + pageSize),
    [items, start, pageSize]
  )

  return {
    page: safePage,
    setPage,
    pageCount,
    pageItems,
    pageSize,
    total: items.length,
    rangeStart: items.length === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, items.length),
  }
}
