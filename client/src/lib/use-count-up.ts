"use client"

import * as React from "react"

/**
 * Animates a displayed number from its previous value to `target` whenever
 * `target` changes. Used for Layer 2 "counter morphing" — e.g. AgentPerformance
 * alpha ticking up once a simulator run reconciles a real treasury action.
 */
export function useCountUp(target: number, durationMs = 900) {
  const [display, setDisplay] = React.useState(target)
  const prevRef = React.useRef(target)
  const rafRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    const from = prevRef.current
    const to = target
    if (from === to) { setDisplay(to); return }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (to - from) * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else prevRef.current = to
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, durationMs])

  return display
}
