"use client"

import * as React from "react"
import { simulatorApi, type FastForwardResult, type SimDailyStreamEvent, type SimTemplate, type SimToast, type StreamEventType } from "./simulator-api"

const TOTAL_DAYS = 30

/** Default delay between each individual transaction appearing in the live
 *  stream (NOT per-day — every checkout/expense/payment row gets its own
 *  tick, so a busy day's rows visibly trickle in one at a time). */
export const DEFAULT_SPEED_MS = 180

/** Playback speed presets — milliseconds of delay PER TRANSACTION. Shown
 *  wherever the simulator is controlled (sidebar launcher). A manual, typed
 *  delay is also supported via setSpeedMs() for anything in between. */
export const SPEED_PRESETS = [
  { label: "Slow", ms: 400, hint: "deliberate" },
  { label: "Normal", ms: 180, hint: "default" },
  { label: "Fast", ms: 70, hint: "brisk" },
  { label: "Turbo", ms: 20, hint: "near-instant" },
] as const

export const MIN_SPEED_MS = 10
export const MAX_SPEED_MS = 5000

/** Transaction-density templates. 'LESS' is today's present pace (unchanged);
 *  'MORE' asks the backend to fan the same daily totals out into ~3x as many
 *  smaller, real transactions for a busier demo. Rough row-count estimates
 *  below are only used to preview an completion time before a run exists —
 *  once a run is loaded the real count from the server is used instead. */
export const TRANSACTION_TEMPLATES: Array<{ id: SimTemplate; label: string; description: string; estimatedRows: number }> = [
  { id: "LESS", label: "Less transactions", description: "Present data — one sale and occasional expenses per day.", estimatedRows: 90 },
  { id: "MORE", label: "More transactions", description: "~3x busier — several sales and expenses every day.", estimatedRows: 280 },
]

export type VisibleStreamEvent = SimDailyStreamEvent & { day: number; date: string; phase: string }

function flattenEvents(result: FastForwardResult): VisibleStreamEvent[] {
  const flat: VisibleStreamEvent[] = []
  for (const d of result.dailyEvents) for (const e of d.events) flat.push({ ...e, day: d.day, date: d.date, phase: d.phase })
  return flat
}

interface SimulatorState {
  status: "idle" | "loading" | "playing" | "done" | "error" | "resetting"
  error: string | null
  result: FastForwardResult | null
  dayIndex: number
  /** 0..1 playback progress — pages lerp their own baseline → final numbers with this. */
  progress: number
  /** Total individual transaction rows in the current/last run (0 before any run). */
  totalEvents: number
  /** How many of those rows have been revealed so far. */
  revealedEvents: number
  visibleEvents: VisibleStreamEvent[]
  activeToasts: SimToast[]
  drawerOpen: boolean
  /** Milliseconds of delay PER TRANSACTION — adjustable mid-run. */
  speedMs: number
  /** Transaction density for the NEXT run (changing it mid-run has no effect on the run already in flight). */
  template: SimTemplate
  /** Bumped once per completed run/reset so finance pages know to refetch real data. */
  completedAt: number
}

interface SimulatorContextValue extends SimulatorState {
  runFastForward: () => Promise<void>
  skipToEnd: () => void
  resetSimulation: () => Promise<void>
  dismissToast: (id: string) => void
  setDrawerOpen: (open: boolean) => void
  setSpeedMs: (ms: number) => void
  setTemplate: (template: SimTemplate) => void
  inspect: (type: StreamEventType, id: string) => ReturnType<typeof simulatorApi.inspect>
}

const SimulatorContext = React.createContext<SimulatorContextValue | null>(null)

export function FinanceSimulatorProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<SimulatorState>({
    status: "idle", error: null, result: null, dayIndex: 0, progress: 0, totalEvents: 0, revealedEvents: 0,
    visibleEvents: [], activeToasts: [], drawerOpen: false, speedMs: DEFAULT_SPEED_MS, template: "LESS", completedAt: 0,
  })
  const eventsRef = React.useRef<VisibleStreamEvent[]>([])
  const revealedRef = React.useRef(0)
  const shownToastIds = React.useRef<Set<string>>(new Set())

  const applyRevealed = React.useCallback((result: FastForwardResult, revealed: number) => {
    const events = eventsRef.current
    const visible = events.slice(0, revealed).slice().reverse()
    const dayIndex = revealed > 0 ? events[revealed - 1].day : 0
    const dueToasts = result.toasts.filter((t) => dayIndex >= t.uiCueDay && !shownToastIds.current.has(t.id))
    dueToasts.forEach((t) => shownToastIds.current.add(t.id))
    setState((s) => ({
      ...s,
      dayIndex,
      revealedEvents: revealed,
      progress: events.length ? revealed / events.length : 0,
      visibleEvents: visible,
      activeToasts: dueToasts.length ? [...s.activeToasts, ...dueToasts].slice(-2) : s.activeToasts,
    }))
  }, [])

  // One transaction is revealed per tick (NOT one whole day) — this is what
  // actually makes the live stream feel like real, slightly-staggered
  // business activity instead of a day's worth of rows landing at once.
  // Re-created whenever playback starts/stops or the speed changes, so a
  // manual speed change mid-run takes effect on the very next tick.
  React.useEffect(() => {
    if (state.status !== "playing" || !state.result) return
    const result = state.result
    const id = setInterval(() => {
      revealedRef.current += 1
      if (revealedRef.current >= eventsRef.current.length) {
        clearInterval(id)
        applyRevealed(result, eventsRef.current.length)
        setState((s) => ({ ...s, status: "done", completedAt: s.completedAt + 1 }))
        return
      }
      applyRevealed(result, revealedRef.current)
    }, state.speedMs)
    return () => clearInterval(id)
  }, [state.status, state.speedMs, state.result, applyRevealed])

  const runFastForward = React.useCallback(async () => {
    shownToastIds.current = new Set()
    setState((s) => ({ ...s, status: "loading", error: null, drawerOpen: true }))
    try {
      const template = state.template
      const result = await simulatorApi.fastForward(template)
      const flat = flattenEvents(result)
      eventsRef.current = flat
      revealedRef.current = 0
      setState((s) => ({
        ...s, status: "playing", result, dayIndex: 0, progress: 0, totalEvents: flat.length, revealedEvents: 0,
        visibleEvents: [], activeToasts: [],
      }))
    } catch (e) {
      setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : "Simulation failed to run." }))
    }
  }, [state.template])

  const skipToEnd = React.useCallback(() => {
    const result = state.result
    if (!result) return
    revealedRef.current = eventsRef.current.length
    applyRevealed(result, eventsRef.current.length)
    setState((s) => ({ ...s, status: "done", completedAt: s.completedAt + 1 }))
  }, [state.result, applyRevealed])

  const resetSimulation = React.useCallback(async () => {
    setState((s) => ({ ...s, status: "resetting", error: null }))
    try {
      await simulatorApi.reset()
      shownToastIds.current = new Set()
      eventsRef.current = []
      revealedRef.current = 0
      setState((s) => ({
        status: "idle", error: null, result: null, dayIndex: 0, progress: 0, totalEvents: 0, revealedEvents: 0,
        visibleEvents: [], activeToasts: [], drawerOpen: s.drawerOpen, speedMs: s.speedMs, template: s.template, completedAt: s.completedAt + 1,
      }))
    } catch (e) {
      setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : "Reset failed." }))
    }
  }, [])

  const dismissToast = React.useCallback((id: string) => {
    setState((s) => ({ ...s, activeToasts: s.activeToasts.filter((t) => t.id !== id) }))
  }, [])
  const setDrawerOpen = React.useCallback((open: boolean) => setState((s) => ({ ...s, drawerOpen: open })), [])
  const setSpeedMs = React.useCallback((ms: number) => {
    const clamped = Math.round(Math.max(MIN_SPEED_MS, Math.min(MAX_SPEED_MS, ms)))
    setState((s) => ({ ...s, speedMs: clamped }))
  }, [])
  const setTemplate = React.useCallback((template: SimTemplate) => setState((s) => ({ ...s, template })), [])

  const value = React.useMemo<SimulatorContextValue>(() => ({
    ...state, runFastForward, skipToEnd, resetSimulation, dismissToast, setDrawerOpen, setSpeedMs, setTemplate, inspect: simulatorApi.inspect,
  }), [state, runFastForward, skipToEnd, resetSimulation, dismissToast, setDrawerOpen, setSpeedMs, setTemplate])

  return <SimulatorContext.Provider value={value}>{children}</SimulatorContext.Provider>
}

export function useSimulator() {
  const ctx = React.useContext(SimulatorContext)
  if (!ctx) throw new Error("useSimulator must be used within FinanceSimulatorProvider")
  return ctx
}

/** Linear interpolation helper shared by the finance pages' Layer-2 morph animations. */
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

/** Formats a millisecond duration as e.g. "1m 12s" / "8s" for the "estimated
 *  completion time" readout next to the manual speed control. */
export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes <= 0) return `${seconds}s`
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`
}

export { TOTAL_DAYS }
