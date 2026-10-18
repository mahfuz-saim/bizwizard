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
import { formatNumber } from "@/lib/utils"
import { PageLoadState, PageRefreshState } from "@/components/page-load-state"
import { useStore } from "@/lib/store"

type Policy = { id: string; agentType: string; name: string; objective: string; riskAppetite: number; maxExposure: number | null; bufferTargetDays: number | null; version: number }
type Perf = { agentType: string; decisionsCount: number; executedCount: number; guardRejects: number; realizedImpactSum: number | null; benchmarkImpact: number | null; alpha: number | null; score: number | null; benchmarkPolicyVersion: string; outcomeBasis?: string }

export default function AgentLedgerPage() {
  const { dataVersion, session } = useStore()
  const canEdit = ["OWNER", "ADMIN"].includes(session?.role ?? "")
  const sim = useSimulator()
  const [policies, setPolicies] = React.useState<Policy[]>([])
  const [performance, setPerformance] = React.useState<Perf[]>([])
  const [decisions, setDecisions] = React.useState<{ id: string; agentType: string; action: string; rationale: string; confidence: number; projectedImpact: number; realizedImpact: number | null; guardResult: string; status: string; model: string }[]>([])
  const [runs, setRuns] = React.useState<{ runs: { id: string; purpose: string; model: string; costUsd: number; latencyMs: number; status: string }[]; spentUsdThisMonth: number; budgetUsd: number } | null>(null)
  const [drafts, setDrafts] = React.useState<Record<string, { risk: string; exposure: string; buffer: string }>>({})
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [loaded, setLoaded] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [p, perf, d, r] = await Promise.all([
        agentsApi.policies(), agentsApi.performance(), agentsApi.decisions(), agentsApi.runs(),
      ])
      setPolicies(p as Policy[])
      setPerformance(((perf as { performance: Perf[] }).performance ?? []) as Perf[])
      setDecisions(d as typeof decisions)
      setRuns(r as typeof runs)
      setError("")
      setLoaded(true)
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load the agent ledger.") } finally { setLoading(false) }
  }, [])
  // The simulator's TREASURER_AGENT reconciliation lands realizedImpact and
  // moves alpha for real — refetch once the run (or a reset) completes so
  // the scorecard below animates from the actual before/after, not a guess.
  React.useEffect(() => {
    let active = true
    void Promise.resolve().then(() => { if (active) return load() })
    return () => { active = false }
  }, [sim.completedAt, load, dataVersion])

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
    setExporting(true)
    try {
      const payload = await agentsApi.auditExport()
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "finance-agent-audit.json"
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setError(e instanceof Error ? e.message : "Export failed") } finally { setExporting(false) }
  }

  if (!loaded) return <PageLoadState error={error} retry={() => void load()} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Agent Ledger</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">Inspect shop-specific mandates, guarded decisions and recorded outcomes. Comparisons remain pending until a matched benchmark is supported by evidence. Without an OpenAI key, or when the budget blocks a call, the deterministic core supplies the result (model shown as <code>deterministic-fallback</code>).</p>
        </div>
        <Button variant="outline" disabled={exporting} aria-busy={exporting} onClick={() => void downloadAudit()}>{exporting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {exporting ? 'Exporting…' : 'Audit JSON'}</Button>
      </div>

      <PageRefreshState loading={loading} error={error} retry={() => void load()} />

      <Card>
          <CardHeader><CardTitle className="text-base">Outcome evidence &amp; benchmark readiness</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <p className="mb-2 text-xs text-muted-foreground">Pending means there is no measured outcome or fair matched benchmark yet. Collections are not profit; sandbox results are not real-world results.</p>
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1">Agent</th><th>Decisions</th><th>Executed</th><th>Guard rejects</th><th>Realized</th><th>Benchmark</th><th>Alpha</th><th>Score</th></tr></thead>
            <tbody>
              {performance.map((p) => <PerfRow key={p.agentType} p={p} />)}
              {performance.length === 0 && <tr><td colSpan={8} className="py-3 text-muted-foreground">No scorecard yet — run a treasury, matching or analysis flow first.</td></tr>}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Pinned benchmark functions are available for evaluation. Alpha is not reported until a matched comparison is supported by evidence.</p>
          {performance.map(p => <p key={p.agentType} className="mt-1 text-xs text-muted-foreground">{p.agentType.replaceAll("_", " ")}: {p.outcomeBasis}</p>)}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4" /> {canEdit ? "Mandates (editable)" : "Mandates (read-only)"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {policies.map((p) => {
              const draft = drafts[p.id] ?? { risk: String(p.riskAppetite), exposure: p.maxExposure == null ? "" : String(p.maxExposure), buffer: p.bufferTargetDays == null ? "" : String(p.bufferTargetDays) }
              const set = (patch: Partial<typeof draft>) => setDrafts((d) => ({ ...d, [p.id]: { ...draft, ...patch } }))
              return (
                <div key={p.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between"><p className="text-sm font-medium">{p.name}</p><Badge variant="outline">v{p.version}</Badge></div>
                  <p className="text-xs text-muted-foreground">{p.objective}</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="text-xs">Risk appetite (0–1)<Input disabled={!canEdit} value={draft.risk} onChange={(e) => set({ risk: e.target.value })} /></label>
                    <label className="text-xs">Max exposure<Input disabled={!canEdit} value={draft.exposure} onChange={(e) => set({ exposure: e.target.value })} placeholder="none" /></label>
                    <label className="text-xs">Buffer days<Input disabled={!canEdit} value={draft.buffer} onChange={(e) => set({ buffer: e.target.value })} placeholder="—" /></label>
                  </div>
                  <Button size="sm" className="mt-2" disabled={busy || !canEdit} onClick={() => void save(p)}>{busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} Save new version</Button>
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
              <p className="text-sm">Estimated tenant spend this month: <strong>${formatNumber(runs?.spentUsdThisMonth ?? 0)}</strong> of ${formatNumber(runs?.budgetUsd ?? 2)} application budget. Pure offline fallback costs $0; failed or invalid model calls may still be billed.</p>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {(runs?.runs ?? []).slice(0, 12).map((r) => (
                  <p key={r.id} className="flex justify-between text-xs text-muted-foreground"><span>{r.purpose} · {r.model}</span><span>{r.status} · {r.latencyMs}ms · ${formatNumber(r.costUsd)}</span></p>
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
  const realized = useCountUp(p.realizedImpactSum ?? 0)
  const alpha = useCountUp(p.alpha ?? 0)
  const justUpdated = p.alpha !== null && Math.abs(alpha - p.alpha) > 0.5
  return (
    <tr className="border-t">
      <td className="whitespace-nowrap py-2 pr-3 font-medium">{p.agentType.replaceAll("_", " ")}</td>
      <td>{p.decisionsCount}</td><td>{p.executedCount}</td><td>{p.guardRejects}</td>
      <td className={justUpdated ? "text-emerald-600 transition-colors" : ""}>{p.realizedImpactSum == null ? "Pending" : fmtBDT(realized)}</td><td>{p.benchmarkImpact == null ? "Pending" : fmtBDT(p.benchmarkImpact)}</td>
      <td className="font-semibold">{p.alpha == null ? "Pending" : fmtBDT(alpha)}</td>
      <td>{p.score == null ? "Pending" : `${p.score.toFixed(0)}/100`}</td>
    </tr>
  )
}
