"use client"

import * as React from "react"
import { simulatorApi, type FastForwardResult, type SimDailyStreamEvent, type SimToast, type StreamEventType } from "./simulator-api"

const TOTAL_DAYS = 30
export const DEFAULT_SPEED_MS = 600

/** Playback speed presets shown wherever the simulator is controlled (profile menu). */
export const SPEED_PRESETS = [
  { label: "Slow", ms: 1200, hint: "~36s total" },
  { label: "Normal", ms: 600, hint: "~18s total" },
  { label: "Fast", ms: 150, hint: "~4.5s total" },
  { label: "Turbo", ms: 60, hint: "~1.8s total" },
] as const

export type VisibleStreamEvent = SimDailyStreamEvent & { day: number; date: string; phase: string }

interface SimulatorState {
  status: "idle" | "loading" | "playing" | "done" | "error" | "resetting"
  error: string | null
  result: FastForwardResult | null
  dayIndex: number
  /** 0..1 playback progress — pages lerp their own baseline → final numbers with this. */
  progress: number
  visibleEvents: VisibleStreamEvent[]
  activeToasts: SimToast[]
  drawerOpen: boolean
  /** Milliseconds of delay per simulated day — adjustable mid-run. */
  speedMs: number
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
  inspect: (type: StreamEventType, id: string) => ReturnType<typeof simulatorApi.inspect>
}

const SimulatorContext = React.createContext<SimulatorContextValue | null>(null)

export function FinanceSimulatorProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<SimulatorState>({
    status: "idle", error: null, result: null, dayIndex: 0, progress: 0,
    visibleEvents: [], activeToasts: [], drawerOpen: false, speedMs: DEFAULT_SPEED_MS, completedAt: 0,
  })
  const dayRef = React.useRef(0)
  const resultRef = React.useRef<FastForwardResult | null>(null)
  const shownToastIds = React.useRef<Set<string>>(new Set())

  const applyDayIndex = React.useCallback((result: FastForwardResult, dayIndex: number) => {
    const visible: VisibleStreamEvent[] = []
    for (const d of result.dailyEvents.slice(0, dayIndex)) {
      for (const e of d.events) visible.push({ ...e, day: d.day, date: d.date, phase: d.phase })
    }
    visible.reverse()
    const dueToasts = result.toasts.filter((t) => dayIndex >= t.uiCueDay && !shownToastIds.current.has(t.id))
    dueToasts.forEach((t) => shownToastIds.current.add(t.id))
    setState((s) => ({
      ...s,
      dayIndex,
      progress: dayIndex / TOTAL_DAYS,
      visibleEvents: visible,
      activeToasts: dueToasts.length ? [...s.activeToasts, ...dueToasts].slice(-2) : s.activeToasts,
    }))
  }, [])

  // Single ticking loop, re-created whenever playback starts/stops or the
  // speed changes — so dragging the speed control mid-run takes effect
  // immediately instead of waiting for a restart.
  React.useEffect(() => {
    if (state.status !== "playing" || !resultRef.current) return
    const result = resultRef.current
    const id = setInterval(() => {
      dayRef.current += 1
      if (dayRef.current >= TOTAL_DAYS) {
        clearInterval(id)
        applyDayIndex(result, TOTAL_DAYS)
        setState((s) => ({ ...s, status: "done", completedAt: s.completedAt + 1 }))
        return
      }
      applyDayIndex(result, dayRef.current)
    }, state.speedMs)
    return () => clearInterval(id)
  }, [state.status, state.speedMs, applyDayIndex])

  const runFastForward = React.useCallback(async () => {
    shownToastIds.current = new Set()
    setState((s) => ({ ...s, status: "loading", error: null, drawerOpen: true }))
    try {
      const result = await simulatorApi.fastForward()
      resultRef.current = result
      dayRef.current = 0
      setState((s) => ({ ...s, status: "playing", result, dayIndex: 0, progress: 0, visibleEvents: [], activeToasts: [] }))
    } catch (e) {
      setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : "Simulation failed to run." }))
    }
  }, [])

  const skipToEnd = React.useCallback(() => {
    const result = resultRef.current
    if (!result) return
    dayRef.current = TOTAL_DAYS
    const visible: VisibleStreamEvent[] = []
    for (const d of result.dailyEvents) for (const e of d.events) visible.push({ ...e, day: d.day, date: d.date, phase: d.phase })
    visible.reverse()
    const remaining = result.toasts.filter((t) => !shownToastIds.current.has(t.id))
    remaining.forEach((t) => shownToastIds.current.add(t.id))
    setState((s) => ({
      ...s, status: "done", dayIndex: TOTAL_DAYS, progress: 1, visibleEvents: visible,
      activeToasts: [...s.activeToasts, ...remaining].slice(-2), completedAt: s.completedAt + 1,
    }))
  }, [])

  const resetSimulation = React.useCallback(async () => {
    setState((s) => ({ ...s, status: "resetting", error: null }))
    try {
      await simulatorApi.reset()
      shownToastIds.current = new Set()
      resultRef.current = null
      dayRef.current = 0
      setState((s) => ({
        status: "idle", error: null, result: null, dayIndex: 0, progress: 0,
        visibleEvents: [], activeToasts: [], drawerOpen: s.drawerOpen, speedMs: s.speedMs, completedAt: s.completedAt + 1,
      }))
    } catch (e) {
      setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : "Reset failed." }))
    }
  }, [])

  const dismissToast = React.useCallback((id: string) => {
    setState((s) => ({ ...s, activeToasts: s.activeToasts.filter((t) => t.id !== id) }))
  }, [])
  const setDrawerOpen = React.useCallback((open: boolean) => setState((s) => ({ ...s, drawerOpen: open })), [])
  const setSpeedMs = React.useCallback((ms: number) => setState((s) => ({ ...s, speedMs: Math.max(30, ms) })), [])

  const value = React.useMemo<SimulatorContextValue>(() => ({
    ...state, runFastForward, skipToEnd, resetSimulation, dismissToast, setDrawerOpen, setSpeedMs, inspect: simulatorApi.inspect,
  }), [state, runFastForward, skipToEnd, resetSimulation, dismissToast, setDrawerOpen, setSpeedMs])

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
