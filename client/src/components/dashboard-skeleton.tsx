import { Skeleton } from "@/components/ui/skeleton"

/**
 * Mimics the real dashboard shell (sidebar + topbar + content cards) while
 * the account/session/shop history is being fetched, instead of blocking the
 * whole viewport behind a spinner. Purely decorative — no real data here.
 */
export function DashboardSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-background" role="status" aria-label="Loading your account">
      <aside className="hidden md:flex h-screen w-64 shrink-0 flex-col border-r bg-sidebar p-4">
        <div className="mb-6 flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4 md:px-6">
          <Skeleton className="hidden h-8 w-40 md:block" />
          <Skeleton className="ml-auto h-9 w-full max-w-sm rounded-md md:ml-6" />
          <Skeleton className="hidden h-8 w-20 sm:block" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Skeleton className="mb-6 h-7 w-48" />
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-lg" />
        </main>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}
