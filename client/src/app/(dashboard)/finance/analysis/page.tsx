"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Loader2, ShieldCheck, Sparkles, XCircle } from "lucide-react"
import { analysisApi, fmtBDT, fmtPct } from "@/lib/finance-api"

type Insight = { id: string; insightType: string; severity: string; title: string; summary: string; hypothesis: string; verificationStatus: string; verifiedMetrics?: Record<string, unknown> }
type Econ = { productKey: string; productName: string; revenue: number; contribution: number; contributionMargin: number; quadrant: string; deadStock: boolean }

export default function AnalysisPage() {
  const [metrics, setMetrics] = React.useState<Record<string, Record<string, number>> | null>(null)
  const [insights, setInsights] = React.useState<Insight[]>([])
  const [refuted, setRefuted] = React.useState(0)
  const [econ, setEcon] = React.useState<Econ[]>([])
  const [decisions, setDecisions] = React.useState<{ id: string; title: string; decisionType: string; capitalReleased: number; projectedProfitImpact: number; realizedProfitImpact: number | null; status: string }[]>([])
  const [forecastMeta, setForecastMeta] = React.useState<{ backtestMAPE: number | null; method: string } | null>(null)
  const [scenarioName, setScenarioName] = React.useState("Price +5%")
  const [priceDelta, setPriceDelta] = React.useState("5")
  const [scenarioResult, setScenarioResult] = React.useState("")
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const [m, ins, e, d, f] = await Promise.all([
        analysisApi.metrics(), analysisApi.insights(), analysisApi.productEconomics(),
        analysisApi.capitalDecisions(), analysisApi.forecast(),
      ])
      setMetrics(m as typeof metrics)
      const payload = ins as { insights: Insight[]; refutedCount: number }
      setInsights(payload.insights ?? [])
      setRefuted(payload.refutedCount ?? 0)
      setEcon(e as Econ[])
      setDecisions(d as typeof decisions)
      setForecastMeta(f as { backtestMAPE: number | null; method: string })
      setError("")
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load analysis. Log in and pick a shop, then try again.") }
  }, [])
  React.useEffect(() => { void load() }, [load])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try { await fn(); await load() } catch (e) { setError(e instanceof Error ? e.message : "Action failed") } finally { setBusy(false) }
  }

  const pnl = metrics?.pnl ?? {}
  const wc = metrics?.workingCapital ?? {}

  const simulate = async () => {
    setBusy(true)
    try {
      const created = await analysisApi.createScenario({
        name: scenarioName, createdBy: "OWNER",
        assumptions: [{ key: "price_change_pct", label: "Price change", from: 0, to: Number(priceDelta), unit: "%" }],
      }) as { id: string; projected: { profitDelta: number; revenueDelta: number }; expectedValue: number }
      const ranked = await analysisApi.recommendScenario(created.id) as { recommendation: string }
      setScenarioResult(`Simulated profit change ${fmtBDT(created.projected.profitDelta)}, revenue change ${fmtBDT(created.projected.revenueDelta)}, EV ${fmtBDT(created.expectedValue)}. ${ranked.recommendation}`)
    } catch (e) { setError(e instanceof Error ? e.message : "Simulation failed") } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Financial Analysis</h2>
          <p className="text-sm text-muted-foreground">Verified insights only: the Analyst proposes a cause, then deterministic code re-tests it against your data before you ever see it. Refuted ideas are kept in the log — {refuted} refuted so far.</p>
        </div>
        <Button disabled={busy} onClick={() => void run(() => analysisApi.generateInsights())}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Re-analyse</Button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Revenue (90d)</p><p className="mt-1 text-2xl font-bold">{fmtBDT(pnl.revenue)}</p><p className="text-xs text-muted-foreground">Gross margin {fmtPct(pnl.grossMargin)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cash conversion cycle</p><p className="mt-1 text-2xl font-bold">{wc.cashConversionCycle ?? "—"} days</p><p className="text-xs text-muted-foreground">DSO {wc.dso ?? "—"} · DIO {wc.dio ?? "—"} · DPO {wc.dpo ?? "—"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Stock value</p><p className="mt-1 text-2xl font-bold">{fmtBDT(wc.inventoryValue)}</p><p className="text-xs text-muted-foreground">Receivables {fmtBDT(wc.receivables)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Forecast honesty (MAPE)</p><p className="mt-1 text-2xl font-bold">{forecastMeta?.backtestMAPE == null ? "—" : `${forecastMeta.backtestMAPE.toFixed(1)}%`}</p><p className="text-xs text-muted-foreground">{forecastMeta?.method ?? ""}{forecastMeta?.backtestMAPE != null && forecastMeta.backtestMAPE > 15 ? " · Poor right now — trust the band, not the line" : ""}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Verified insights</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {insights.length === 0 && <p className="text-sm text-muted-foreground">No verified insights yet — hit Re-analyse. Anything the verifier cannot prove stays out of this feed.</p>}
            {insights.map((i) => (
              <div key={i.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{i.title}</p><Badge variant={i.verificationStatus === "VERIFIED" ? "default" : "secondary"}>{i.verificationStatus === "VERIFIED" ? <><CheckCircle2 className="mr-1 h-3 w-3" /> Verified</> : <><XCircle className="mr-1 h-3 w-3" /> {i.verificationStatus}</>}</Badge></div>
                <p className="mt-1 text-sm text-muted-foreground">{i.summary}</p>
                <p className="text-xs text-muted-foreground">Hypothesis: {i.hypothesis}</p>
                {i.verifiedMetrics && <p className="text-xs text-muted-foreground">Evidence: {Object.entries(i.verifiedMetrics).map(([k, v]) => `${k}=${String(v)}`).join(" · ")}</p>}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => analysisApi.createCapitalDecision({ insightID: i.id, decisionType: i.insightType === "WORKING_CAPITAL" ? "LIQUIDATE_STOCK" : "COLLECT_FAST", title: `Act on: ${i.title}`, rationale: i.hypothesis, capitalReleased: 0, projectedProfitImpact: 0 }))}>Propose capital action</Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => analysisApi.dismissInsight(i.id))}>Dismiss</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Product economics (ABC quadrants)</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {econ.slice(0, 10).map((p) => (
                <p key={p.productKey} className="flex justify-between text-sm"><span>{p.productName} <Badge variant="outline">{p.quadrant.replace("_", " ")}</Badge>{p.deadStock ? <Badge variant="destructive">dead stock</Badge> : null}</span><span>{fmtBDT(p.contribution)} · {fmtPct(p.contributionMargin)}</span></p>
              ))}
              {econ.length === 0 && <p className="text-sm text-muted-foreground">No product sales in the window yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Scenario simulator (deterministic)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} placeholder="Scenario name" />
                <label className="flex items-center gap-2 text-sm">Price change %<Input className="w-24" inputMode="decimal" value={priceDelta} onChange={(e) => setPriceDelta(e.target.value)} /></label>
                <Button disabled={busy} onClick={() => void simulate()}>Simulate &amp; rank</Button>
              </div>
              {scenarioResult && <p className="text-sm text-muted-foreground">{scenarioResult}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Capital decisions — projected vs realized</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {decisions.length === 0 && <p className="text-sm text-muted-foreground">None yet. Approve one and its outcome is measured after 30/60 days into the Analyst scorecard.</p>}
              {decisions.map((d) => (
                <div key={d.id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
                  <div><p className="text-sm font-medium">{d.title}</p><p className="text-xs text-muted-foreground">{d.decisionType.replaceAll("_", " ")} · releases {fmtBDT(d.capitalReleased)} · projected {fmtBDT(d.projectedProfitImpact)} · realized {d.realizedProfitImpact == null ? "pending" : fmtBDT(d.realizedProfitImpact)} · {d.status}</p></div>
                  {d.status === "PROPOSED" && <Button size="sm" disabled={busy} onClick={() => void run(() => analysisApi.approveCapitalDecision(d.id))}>Approve</Button>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
