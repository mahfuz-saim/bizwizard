"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Bot, Download, Loader2 } from "lucide-react"
import { agentsApi, fmtBDT } from "@/lib/finance-api"
import { useSimulator } from "@/lib/simulator-context"
import { useCountUp } from "@/lib/use-count-up"

type Policy = { id: string; agentType: string; name: string; objective: string; riskAppetite: number; maxExposure: number | null; bufferTargetDays: number | null; version: number }
type Perf = { agentType: string; decisionsCount: number; executedCount: number; guardRejects: number; realizedImpactSum: number; benchmarkImpact: number; alpha: number; score: number; benchmarkPolicyVersion: string }

export default function AgentLedgerPage() {
  const sim = useSimulator()
  const [policies, setPolicies] = React.useState<Policy[]>([])
  const [performance, setPerformance] = React.useState<Perf[]>([])
  const [decisions, setDecisions] = React.useState<{ id: string; agentType: string; action: string; rationale: string; confidence: number; projectedImpact: number; realizedImpact: number | null; guardResult: string; status: string; model: string }[]>([])
  const [runs, setRuns] = React.useState<{ runs: { id: string; purpose: string; model: string; costUsd: number; latencyMs: number; status: string }[]; spentUsdThisMonth: number; budgetUsd: number } | null>(null)
  const [drafts, setDrafts] = React.useState<Record<string, { risk: string; exposure: string; buffer: string }>>({})
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const [p, perf, d, r] = await Promise.all([
        agentsApi.policies(), agentsApi.performance(), agentsApi.decisions(), agentsApi.runs(),
      ])
      setPolicies(p as Policy[])
      setPerformance(((perf as { performance: Perf[] }).performance ?? []) as Perf[])
      setDecisions(d as typeof decisions)
      setRuns(r as typeof runs)
      setError("")
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load the agent ledger.") }
  }, [])
  React.useEffect(() => { void load() }, [load])
  // The simulator's TREASURER_AGENT reconciliation lands realizedImpact and
  // moves alpha for real — refetch once the run (or a reset) completes so
  // the scorecard below animates from the actual before/after, not a guess.
  React.useEffect(() => { if (sim.completedAt > 0) void load() }, [sim.completedAt, load])

  const save = async (policy: Policy) => {
    const draft = drafts[policy.id]
    if (!draft) return
    setBusy(true)
    try {
      await agentsApi.updatePolicy(policy.id, {
        riskAppetite: Number(draft.risk),
        maxExposure: draft.exposure === "" ? null : Number(draft.exposure),
        bufferTargetDays: draft.buffer === "" ? null : Number(draft.buffer),
      })
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed") } finally { setBusy(false) }
  }

  const downloadAudit = async () => {
    try {
      const payload = await agentsApi.auditExport()
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "finance-agent-audit.json"
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setError(e instanceof Error ? e.message : "Export failed") }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Agent Ledger</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">The thesis, made inspectable: each agent holds a mandate and a position, takes binding decisions inside deterministic guards, and is scored against a pinned rule-based benchmark. <strong>Alpha = realized − benchmark.</strong> Without an OpenAI key the agents run on the deterministic core (model shown as <code>deterministic-fallback</code>) — same guards, same ledger.</p>
        </div>
        <Button variant="outline" onClick={() => void downloadAudit()}><Download className="mr-2 h-4 w-4" /> Audit JSON</Button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader><CardTitle className="text-base">Scorecards — alpha vs the pinned benchmark</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1">Agent</th><th>Decisions</th><th>Executed</th><th>Guard rejects</th><th>Realized</th><th>Benchmark</th><th>Alpha</th><th>Score</th></tr></thead>
            <tbody>
              {performance.map((p) => <PerfRow key={p.agentType} p={p} />)}
              {performance.length === 0 && <tr><td colSpan={8} className="py-3 text-muted-foreground">No scorecard yet — run a treasury, matching or analysis flow first.</td></tr>}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Benchmark policy: pinned-v1 (flat-rate lender · round-0 borrower · hold-and-collect-at-60d treasurer · equal-weight analyst), same universe and same PD/LGD model as the AI.</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4" /> Mandates (editable)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {policies.map((p) => {
              const draft = drafts[p.id] ?? { risk: String(p.riskAppetite), exposure: p.maxExposure == null ? "" : String(p.maxExposure), buffer: p.bufferTargetDays == null ? "" : String(p.bufferTargetDays) }
              const set = (patch: Partial<typeof draft>) => setDrafts((d) => ({ ...d, [p.id]: { ...draft, ...patch } }))
              return (
                <div key={p.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between"><p className="text-sm font-medium">{p.name}</p><Badge variant="outline">v{p.version}</Badge></div>
                  <p className="text-xs text-muted-foreground">{p.objective}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label className="text-xs">Risk appetite (0–1)<Input value={draft.risk} onChange={(e) => set({ risk: e.target.value })} /></label>
                    <label className="text-xs">Max exposure<Input value={draft.exposure} onChange={(e) => set({ exposure: e.target.value })} placeholder="none" /></label>
                    <label className="text-xs">Buffer days<Input value={draft.buffer} onChange={(e) => set({ buffer: e.target.value })} placeholder="—" /></label>
                  </div>
                  <Button size="sm" className="mt-2" disabled={busy} onClick={() => void save(p)}>{busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} Save new version</Button>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Decision ledger</CardTitle></CardHeader>
            <CardContent className="max-h-96 space-y-2 overflow-y-auto">
              {decisions.length === 0 && <p className="text-sm text-muted-foreground">Every AI decision lands here with rationale, confidence, projected vs realized impact and the guard verdict. None yet.</p>}
              {decisions.map((d) => (
                <div key={d.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{d.action} <Badge variant="outline">{d.agentType.replaceAll("_", " ")}</Badge></p>
                  <p className="text-xs text-muted-foreground">{d.rationale}</p>
                  <p className="text-xs">Projected {fmtBDT(d.projectedImpact)} · Realized {d.realizedImpact == null ? "pending" : fmtBDT(d.realizedImpact)} · Guard: {d.guardResult} · {d.status} · {d.model}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">AI runs &amp; budget</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm">Spent this month: <strong>${(runs?.spentUsdThisMonth ?? 0).toFixed(4)}</strong> of ${(runs?.budgetUsd ?? 2).toFixed(2)} budget. Deterministic-fallback runs cost $0.</p>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {(runs?.runs ?? []).slice(0, 12).map((r) => (
                  <p key={r.id} className="flex justify-between text-xs text-muted-foreground"><span>{r.purpose} · {r.model}</span><span>{r.status} · {r.latencyMs}ms · ${r.costUsd.toFixed(4)}</span></p>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** One scorecard row — isolated so its alpha/realized counters can animate independently when the simulator reconciles a treasury action. */
function PerfRow({ p }: { p: Perf }) {
  const realized = useCountUp(p.realizedImpactSum)
  const alpha = useCountUp(p.alpha)
  const justUpdated = Math.abs(alpha - p.alpha) > 0.5
  return (
    <tr className="border-t">
      <td className="py-2 font-medium">{p.agentType.replaceAll("_", " ")}</td>
      <td>{p.decisionsCount}</td><td>{p.executedCount}</td><td>{p.guardRejects}</td>
      <td className={justUpdated ? "text-emerald-600 transition-colors" : ""}>{fmtBDT(realized)}</td><td>{fmtBDT(p.benchmarkImpact)}</td>
      <td className={`font-semibold transition-colors ${alpha >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmtBDT(alpha)}</td>
      <td>{p.score.toFixed(0)}/100</td>
    </tr>
  )
}
