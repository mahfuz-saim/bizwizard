"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowUpRight, ArrowDownRight, Pause, Play, ReceiptText, Wallet, HandCoins, ShoppingCart } from "lucide-react"
import { fmtBDT } from "@/lib/finance-api"
import { useSimulator, type VisibleStreamEvent } from "@/lib/simulator-context"
import type { StreamEventType } from "@/lib/simulator-api"

const ICONS: Record<StreamEventType, React.ElementType> = {
  CHECKOUT: ShoppingCart,
  EXPENSE_ITEM: ReceiptText,
  DEBT_PAYMENT: HandCoins,
  CASH_TRANSACTION: Wallet,
}
const LABELS: Record<StreamEventType, string> = {
  CHECKOUT: "Checkout",
  EXPENSE_ITEM: "Expense item",
  DEBT_PAYMENT: "Debt payment",
  CASH_TRANSACTION: "Cash transaction",
}

/** Layer 1 — "Live Business Stream": a scrolling, inspectable log of every row the simulator writes. */
export function SimulatorDrawer() {
  const sim = useSimulator()
  const [inspecting, setInspecting] = React.useState<VisibleStreamEvent | null>(null)

  return (
    <>
      <Sheet open={sim.drawerOpen} onOpenChange={sim.setDrawerOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b p-4">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle>Live Business Stream</SheetTitle>
              {(sim.status === "playing" || sim.status === "paused") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={() => (sim.status === "playing" ? sim.pauseSimulation() : sim.resumeSimulation())}
                >
                  {sim.status === "playing" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {sim.status === "playing" ? "Pause" : "Resume"}
                </Button>
              )}
            </div>
            <SheetDescription>
              {sim.result
                ? `Run ${sim.result.simulationRunID.slice(0, 14)}… · ${
                    sim.status === "playing"
                      ? `day ${sim.dayIndex} of 30 (${sim.revealedEvents}/${sim.totalEvents})`
                      : sim.status === "paused"
                        ? `paused at day ${sim.dayIndex} of 30 (${sim.revealedEvents}/${sim.totalEvents})`
                        : `${sim.visibleEvents.length} rows written`
                  }`
                : "Hit \"Fast-forward 30 days\" to stream fabricated-but-real rows as they hit the database."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {sim.visibleEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">No simulated activity yet.</p>
            )}
            {sim.visibleEvents.map((e, i) => {
              const Icon = ICONS[e.type]
              return (
                <div
                  key={`${e.id}-${i}`}
                  className="animate-in fade-in slide-in-from-top-1 flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm duration-200"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${e.direction === "IN" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.description}</p>
                      <p className="text-xs text-muted-foreground">{LABELS[e.type]} · day {e.day} · {e.date}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`flex items-center gap-0.5 font-semibold ${e.direction === "IN" ? "text-emerald-600" : "text-rose-600"}`}>
                      {e.direction === "IN" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                      {fmtBDT(e.amount)}
                    </span>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7" title="Inspect the real database record"
                      aria-label={`Inspect ${LABELS[e.type]} ${e.id}`}
                      onClick={() => setInspecting(e)}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5 rotate-[-45deg]" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
      <InspectDialog event={inspecting} onClose={() => setInspecting(null)} />
    </>
  )
}

function InspectDialog({ event, onClose }: { event: VisibleStreamEvent | null; onClose: () => void }) {
  const sim = useSimulator()
  const [row, setRow] = React.useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (!event) { setRow(null); setError(""); return }
    setLoading(true)
    setError("")
    sim.inspect(event.type, event.id)
      .then((res: { row: Record<string, unknown> }) => setRow(res.row))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load the record"))
      .finally(() => setLoading(false))
  }, [event, sim])

  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {event ? LABELS[event.type] : ""} <Badge variant="outline">real database row</Badge>
          </DialogTitle>
          <DialogDescription>
            This is the actual {event ? LABELS[event.type].toLowerCase() : "record"} written by the simulator — not a mock. Proof the demo touches real tables.
          </DialogDescription>
        </DialogHeader>
        {loading && (
          <div className="space-y-2" role="status" aria-label="Loading record">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {row && (
          <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs">
            {JSON.stringify(row, null, 2)}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  )
}
