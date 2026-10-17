"use client"

import * as React from "react"
import { FinanceSimulatorProvider } from "@/lib/simulator-context"
import { SimulatorBar } from "@/components/finance/simulator-bar"
import { SimulatorDrawer } from "@/components/finance/simulator-drawer"
import { SimulatorToastHost } from "@/components/finance/simulator-toasts"

/**
 * Shared shell for every /finance/* page: hosts the judge-facing simulator
 * (Layer 1 live stream drawer + Layer 3 milestone toasts) so state survives
 * navigation between Cash Flow, Analysis and the Agent Ledger while a run
 * plays out. Individual pages opt into Layer 2 (in-place chart/counter
 * morphing) via `useSimulator()`.
 */
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <FinanceSimulatorProvider>
      <div className="space-y-4">
        <SimulatorBar />
        {children}
      </div>
      <SimulatorDrawer />
      <SimulatorToastHost />
    </FinanceSimulatorProvider>
  )
}
