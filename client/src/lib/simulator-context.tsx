"use client"

import * as React from "react"
import { useStore } from "./store"
import { getAccessToken, getSessionIdentity, sameSessionIdentity, type SessionIdentity } from "./api"
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

/**
 * Guard for a long-running simulator operation.
 *
 * The API client rotates the access token whenever a request comes back 401
 * (see api.ts), so a *refreshed* token is not an account change and must not
 * abort the run — the next request simply uses the new token. Only a session
 * that ended (no token left) or a genuinely different account stops the work.
 *
 * Throws with a user-facing message; callers must surface it instead of
 * silently giving up, otherwise the live stream stays empty with no reason
 * shown anywhere.
 */
export function assertSessionUnchanged(identity: SessionIdentity | null): void {
  if (!getAccessToken()) throw new Error("Your session ended before the simulation could finish. Please sign in again.")
  if (!sameSessionIdentity(identity, getSessionIdentity())) throw new Error("Account changed; simulation UI operation cancelled.")
}

interface SimulatorState {
  status: "idle" | "loading" | "playing" | "paused" | "done" | "error" | "resetting"
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
  exitSimulation: () => Promise<void>
  runFastForward: () => Promise<void>
  skipToEnd: () => void
  pauseSimulation: () => void
  resumeSimulation: () => void
  resetSimulation: () => Promise<void>
  dismissToast: (id: string) => void
  setDrawerOpen: (open: boolean) => void
  setSpeedMs: (ms: number) => void
  setTemplate: (template: SimTemplate) => void
  inspect: (type: StreamEventType, id: string) => ReturnType<typeof simulatorApi.inspect>
}

const SimulatorContext = React.createContext<SimulatorContextValue | null>(null)

export function FinanceSimulatorProvider({ children }: { children: React.ReactNode }) {
  const store = useStore()
  const [state, setState] = React.useState<SimulatorState>({
    status: "idle", error: null, result: null, dayIndex: 0, progress: 0, totalEvents: 0, revealedEvents: 0,
    visibleEvents: [], activeToasts: [], drawerOpen: false, speedMs: DEFAULT_SPEED_MS, template: "LESS", completedAt: 0,
  })
  const eventsRef = React.useRef<VisibleStreamEvent[]>([])
  const revealedRef = React.useRef(0)
  const shownToastIds = React.useRef<Set<string>>(new Set())
  /** Toasts known so far — milestone cues arrive while the run is still going. */
  const toastsRef = React.useRef<SimToast[]>([])
  /** True once the backend confirmed the run finished. */
  const runCompleteRef = React.useRef(false)
  React.useEffect(() => {
    if (!store.simulationSourceId || !store.session?.shopId || state.status !== "idle") return
    let active = true
    void simulatorApi.workspace().then(workspace => {
      if (!active || !workspace?.simulationResult) return
      const result = workspace.simulationResult
      const events = flattenEvents(result)
      eventsRef.current = events
      revealedRef.current = events.length
      toastsRef.current = result.toasts ?? []
      setState(s => s.status !== "idle" ? s : ({ ...s, result, status: "done", dayIndex: result.dailyEvents.length, progress: 1, visibleEvents: events.slice().reverse(), totalEvents: events.length, revealedEvents: events.length }))
    }).catch(() => {})
    return () => { active = false }
  }, [store.simulationSourceId, store.session?.shopId, state.status])

  const applyRevealed = React.useCallback((revealed: number) => {
    const events = eventsRef.current
    const visible = events.slice(0, revealed).slice().reverse()
    const dayIndex = revealed > 0 ? events[revealed - 1].day : 0
    const through = revealed > 0 ? Date.parse(events[revealed - 1].occurredAt) : -Infinity
    const dueToasts = toastsRef.current.filter((t) => through >= Date.parse(t.occurredAt) && !shownToastIds.current.has(t.id))
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
    if (state.status !== "playing") return
    const id = setInterval(() => {
      const total = eventsRef.current.length
      if (revealedRef.current >= total) {
        // The queue is drained. The run is only over once the backend has
        // confirmed it — more days may still be on their way.
        if (runCompleteRef.current) {
          clearInterval(id)
          applyRevealed(total)
          setState((s) => ({ ...s, status: "done", completedAt: s.completedAt + 1 }))
        }
        return
      }
      revealedRef.current += 1
      applyRevealed(revealedRef.current)
    }, state.speedMs)
    return () => clearInterval(id)
  }, [state.status, state.speedMs, applyRevealed])

  const runFastForward = React.useCallback(async () => {
    const identity = getSessionIdentity()
    const assertSession = () => assertSessionUnchanged(identity)
    shownToastIds.current = new Set()
    toastsRef.current = []
    runCompleteRef.current = false
    eventsRef.current = []
    revealedRef.current = 0
    setState((s) => ({ ...s, status: "loading", error: null, drawerOpen: true, result: null, visibleEvents: [], activeToasts: [], totalEvents: 0, revealedEvents: 0, progress: 0, dayIndex: 0 }))
    try {
      const template = state.template
      if (store.source !== "backend" || !["OWNER", "ADMIN"].includes(store.session?.role ?? "")) throw new Error("Log in as a shop owner to use the isolated demo simulator.")
      const demo = await simulatorApi.prepare()
      assertSession()
      // The demo workspace is ready — the page data can refresh in the
      // background while the simulation starts streaming right away.
      void store.switchSimulation(demo.id, demo.simulationSourceShopID).catch(() => undefined)
      const result = await simulatorApi.fastForwardStream(
        template,
        day => {
          // A simulated day arrived: queue its rows for the one-by-one reveal.
          eventsRef.current.push(...day.events.map(e => ({ ...e, day: day.day, date: day.date, phase: day.phase })))
          setState(s => ({ ...s, status: s.status === "loading" ? "playing" : s.status, totalEvents: eventsRef.current.length }))
        },
        toast => {
          // A milestone cue (e.g. the first CRITICAL alert) — it is revealed
          // when playback reaches its transaction time.
          if (!toastsRef.current.some(t => t.id === toast.id)) toastsRef.current = [...toastsRef.current, toast]
        },
      )
      assertSession()
      runCompleteRef.current = true
      for (const toast of result.toasts ?? []) {
        const existing = toastsRef.current.find(t => t.id === toast.id)
        if (!existing) {
          toastsRef.current = [...toastsRef.current, toast]
        } else if (!shownToastIds.current.has(toast.id)) {
          // A milestone cue arrived earlier with the same id — keep its
          // timing but take the committed message.
          toastsRef.current = toastsRef.current.map(t => (t.id === toast.id ? { ...toast, occurredAt: t.occurredAt } : t))
        }
      }
      // The committed result is authoritative: use it for the event list (the
      // last day can still receive extra rows after the treasury pass).
      const flat = flattenEvents(result)
      eventsRef.current = flat
      setState((s) => ({
        ...s, status: s.status === "loading" ? "playing" : s.status, result, totalEvents: flat.length,
      }))
    } catch (e) {
      // Never fail silently: the live stream would sit empty with no reason
      // shown, which is exactly the "transactions never appear" report.
      eventsRef.current = []
      revealedRef.current = 0
      setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : "Simulation failed to run.", visibleEvents: [], totalEvents: 0, revealedEvents: 0 }))
    }
  }, [state.template, store])

  // Pausing just flips status away from "playing" — the ticking effect above
  // already tears its interval down whenever status isn't "playing", and
  // revealedRef/eventsRef are untouched, so resuming continues from exactly
  // where it left off instead of losing or re-playing any rows.
  const pauseSimulation = React.useCallback(() => {
    setState((s) => (s.status === "playing" ? { ...s, status: "paused" } : s))
  }, [])
  const resumeSimulation = React.useCallback(() => {
    setState((s) => (s.status === "paused" ? { ...s, status: "playing" } : s))
  }, [])

  const skipToEnd = React.useCallback(() => {
    revealedRef.current = eventsRef.current.length
    applyRevealed(eventsRef.current.length)
    // While the backend is still simulating, more days can still arrive — the
    // run only ends once it confirms the result.
    if (runCompleteRef.current) setState((s) => ({ ...s, status: "done", completedAt: s.completedAt + 1 }))
  }, [applyRevealed])

  const resetSimulation = React.useCallback(async () => {
    const identity = getSessionIdentity()
    setState((s) => ({ ...s, status: "resetting", error: null }))
    try {
      await simulatorApi.reset()
      assertSessionUnchanged(identity)
      await store.refresh(false)
      shownToastIds.current = new Set()
      toastsRef.current = []
      runCompleteRef.current = false
      eventsRef.current = []
      revealedRef.current = 0
      setState((s) => ({
        status: "idle", error: null, result: null, dayIndex: 0, progress: 0, totalEvents: 0, revealedEvents: 0,
        visibleEvents: [], activeToasts: [], drawerOpen: s.drawerOpen, speedMs: s.speedMs, template: s.template, completedAt: s.completedAt + 1,
      }))
    } catch (e) {
      setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : "Reset failed." }))
    }
  }, [store])

  const dismissToast = React.useCallback((id: string) => {
    setState((s) => ({ ...s, activeToasts: s.activeToasts.filter((t) => t.id !== id) }))
  }, [])
  const setDrawerOpen = React.useCallback((open: boolean) => setState((s) => ({ ...s, drawerOpen: open })), [])
  const exitSimulation = React.useCallback(async () => {
    if (state.status === "loading" || state.status === "resetting") return
    eventsRef.current = []
    toastsRef.current = []
    runCompleteRef.current = false
    revealedRef.current = 0
    setState(s => ({ ...s, status: "idle", result: null, visibleEvents: [], activeToasts: [], drawerOpen: false, dayIndex: 0, progress: 0 }))
    await store.switchSimulation(null, null)
  }, [state.status, store])
  const setSpeedMs = React.useCallback((ms: number) => {
    const clamped = Math.round(Math.max(MIN_SPEED_MS, Math.min(MAX_SPEED_MS, ms)))
    setState((s) => ({ ...s, speedMs: clamped }))
  }, [])
  const setTemplate = React.useCallback((template: SimTemplate) => setState((s) => ({ ...s, template })), [])

  const value = React.useMemo<SimulatorContextValue>(() => ({
    ...state, exitSimulation, runFastForward, skipToEnd, pauseSimulation, resumeSimulation, resetSimulation, dismissToast, setDrawerOpen, setSpeedMs, setTemplate, inspect: simulatorApi.inspect,
  }), [state, exitSimulation, runFastForward, skipToEnd, pauseSimulation, resumeSimulation, resetSimulation, dismissToast, setDrawerOpen, setSpeedMs, setTemplate])

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
