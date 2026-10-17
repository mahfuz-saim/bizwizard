"use client"

import * as React from "react"
import { simulatorApi, type FastForwardResult, type SimDailyStreamEvent, type SimToast, type StreamEventType } from "./simulator-api"

const DRIP_MS = 150
const TOTAL_DAYS = 30

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
  /** Bumped once per completed run/reset so finance pages know to refetch real data. */
  completedAt: number
}

interface SimulatorContextValue extends SimulatorState {
  runFastForward: () => Promise<void>
  skipToEnd: () => void
  resetSimulation: () => Promise<void>
  dismissToast: (id: string) => void
  setDrawerOpen: (open: boolean) => void
  inspect: (type: StreamEventType, id: string) => ReturnType<typeof simulatorApi.inspect>
}

const SimulatorContext = React.createContext<SimulatorContextValue | null>(null)

export function FinanceSimulatorProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<SimulatorState>({
    status: "idle", error: null, result: null, dayIndex: 0, progress: 0,
    visibleEvents: [], activeToasts: [], drawerOpen: false, completedAt: 0,
  })
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const shownToastIds = React.useRef<Set<string>>(new Set())

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

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

  const runFastForward = React.useCallback(async () => {
    clearTimer()
    shownToastIds.current = new Set()
    setState((s) => ({ ...s, status: "loading", error: null, drawerOpen: true }))
    try {
      const result = await simulatorApi.fastForward()
      setState((s) => ({ ...s, status: "playing", result, dayIndex: 0, progress: 0, visibleEvents: [], activeToasts: [] }))
      let day = 0
      timerRef.current = setInterval(() => {
        day += 1
        if (day >= TOTAL_DAYS) {
          clearTimer()
          applyDayIndex(result, TOTAL_DAYS)
          setState((s) => ({ ...s, status: "done", completedAt: s.completedAt + 1 }))
          return
        }
        applyDayIndex(result, day)
      }, DRIP_MS)
    } catch (e) {
      setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : "Simulation failed to run." }))
    }
  }, [applyDayIndex, clearTimer])

  const skipToEnd = React.useCallback(() => {
    clearTimer()
    setState((s) => {
      if (!s.result) return s
      return s
    })
    setState((s) => {
      if (!s.result) return s
      const visible: VisibleStreamEvent[] = []
      for (const d of s.result.dailyEvents) for (const e of d.events) visible.push({ ...e, day: d.day, date: d.date, phase: d.phase })
      visible.reverse()
      const remaining = s.result.toasts.filter((t) => !shownToastIds.current.has(t.id))
      remaining.forEach((t) => shownToastIds.current.add(t.id))
      return {
        ...s, status: "done", dayIndex: TOTAL_DAYS, progress: 1, visibleEvents: visible,
        activeToasts: [...s.activeToasts, ...remaining].slice(-2), completedAt: s.completedAt + 1,
      }
    })
  }, [clearTimer])

  const resetSimulation = React.useCallback(async () => {
    clearTimer()
    setState((s) => ({ ...s, status: "resetting", error: null }))
    try {
      await simulatorApi.reset()
      shownToastIds.current = new Set()
      setState((s) => ({
        status: "idle", error: null, result: null, dayIndex: 0, progress: 0,
        visibleEvents: [], activeToasts: [], drawerOpen: s.drawerOpen, completedAt: s.completedAt + 1,
      }))
    } catch (e) {
      setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : "Reset failed." }))
    }
  }, [clearTimer])

  const dismissToast = React.useCallback((id: string) => {
    setState((s) => ({ ...s, activeToasts: s.activeToasts.filter((t) => t.id !== id) }))
  }, [])
  const setDrawerOpen = React.useCallback((open: boolean) => setState((s) => ({ ...s, drawerOpen: open })), [])

  React.useEffect(() => () => clearTimer(), [clearTimer])

  const value = React.useMemo<SimulatorContextValue>(() => ({
    ...state, runFastForward, skipToEnd, resetSimulation, dismissToast, setDrawerOpen, inspect: simulatorApi.inspect,
  }), [state, runFastForward, skipToEnd, resetSimulation, dismissToast, setDrawerOpen])

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
