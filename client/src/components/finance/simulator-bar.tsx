"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { FastForward, Loader2, RadioTower, RotateCcw, Zap } from "lucide-react"
import { useSimulator } from "@/lib/simulator-context"

/**
 * Judge-facing control strip for the finance simulator (plan: "fast-forward
 * 30 days" + "Instant" skip + "Reset simulation"). Lives above every
 * /finance/* page via the finance layout.
 */
export function SimulatorBar() {
  const sim = useSimulator()
  const playing = sim.status === "playing"
  const loading = sim.status === "loading"
  const canReset = sim.status === "done" || (sim.result != null && sim.status !== "loading")

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-brand-400/50 bg-brand-50/40 px-3 py-2 text-sm dark:bg-brand-950/20">
      <span className="flex items-center gap-1.5 font-medium text-brand-700 dark:text-brand-300">
        <Zap className="h-4 w-4" /> Finance Simulator
      </span>
      <span className="text-xs text-muted-foreground">
        30 fabricated-but-real days, written into this shop&apos;s live ledger — every row is inspectable.
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {(playing || loading) && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {loading ? "Writing 30 days…" : `Day ${sim.dayIndex}/30`}
          </span>
        )}
        <Button
          size="sm" variant="outline" disabled={playing}
          onClick={() => sim.setDrawerOpen(!sim.drawerOpen)}
        >
          <RadioTower className="mr-1.5 h-3.5 w-3.5" /> Live stream
        </Button>
        {playing && (
          <Button size="sm" variant="secondary" onClick={() => sim.skipToEnd()}>
            <FastForward className="mr-1.5 h-3.5 w-3.5" /> Instant
          </Button>
        )}
        {!playing && !loading && (
          <Button size="sm" disabled={sim.status === "resetting"} onClick={() => void sim.runFastForward()}>
            <Zap className="mr-1.5 h-3.5 w-3.5" /> Fast-forward 30 days
          </Button>
        )}
        {canReset && !playing && (
          <Button size="sm" variant="ghost" disabled={sim.status === "resetting"} onClick={() => void sim.resetSimulation()}>
            {sim.status === "resetting" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
            Reset simulation
          </Button>
        )}
      </div>
      {sim.error && <p role="alert" className="w-full text-xs text-destructive">{sim.error}</p>}
    </div>
  )
}
