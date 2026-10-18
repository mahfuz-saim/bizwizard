import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'
import { Loader2 } from 'lucide-react'

export function PageLoadState({ error, retry }: { error?: string; retry: () => void }) {
  return <div role={error ? 'alert' : 'status'} aria-busy={!error} className="space-y-3 py-8 text-sm text-muted-foreground">
    <p>{error || 'Loading this page…'}</p>
    {error && <Button variant="outline" onClick={retry}>Retry</Button>}
    {!error && <div aria-hidden="true" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      <Skeleton className="h-56 w-full" />
    </div>}
  </div>
}

export function PageRefreshState({ loading, error, retry }: { loading: boolean; error?: string; retry: () => void }) {
  if (error) return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
    <p className="min-w-0 flex-1">{error}</p><Button variant="outline" disabled={loading} onClick={retry}>Retry</Button>
  </div>
  if (loading) return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Updating data…</p>
  return null
}
