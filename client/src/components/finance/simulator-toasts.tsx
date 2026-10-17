"use client"

import * as React from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { useSimulator } from "@/lib/simulator-context"
import type { SimToast } from "@/lib/simulator-api"

const STYLES: Record<SimToast["kind"], string> = {
  critical: "border-destructive/50 bg-destructive/10 text-destructive-foreground",
  guard: "border-amber-500/50 bg-amber-500/10",
  reconciled: "border-emerald-500/50 bg-emerald-500/10",
}

/**
 * Layer 3 — high-signal toasts for AI agent milestones only (custom,
 * dependency-free): critical shortfall, guardrail-blocked offer, and the
 * reconciliation/alpha result. Capped at two visible at a time, auto-dismiss.
 */
export function SimulatorToastHost() {
  const sim = useSimulator()

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      {sim.activeToasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => sim.dismissToast(t.id)} />
      ))}
    </div>
  )
}

function ToastCard({ toast, onClose }: { toast: SimToast; onClose: () => void }) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 8000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id])

  return (
    <div
      role="status"
      className={`animate-in slide-in-from-bottom-4 fade-in pointer-events-auto rounded-xl border p-3 shadow-lg backdrop-blur ${STYLES[toast.kind]} bg-background/95 duration-300`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{toast.title}</p>
        <button type="button" aria-label="Dismiss" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-1 text-sm">{toast.message}</p>
      <Link
        href={toast.actionHref}
        className="mt-2 inline-block text-xs font-medium underline underline-offset-2"
        onClick={onClose}
      >
        {toast.actionLabel} →
      </Link>
    </div>
  )
}
