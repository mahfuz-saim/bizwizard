"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Bot, Check, Loader2, Play, RefreshCw, TrendingDown, Wallet, X } from "lucide-react"
import { cashflowApi, fmtBDT, type CashAlert } from "@/lib/finance-api"
import { lerp, useSimulator } from "@/lib/simulator-context"
import { PageLoadState, PageRefreshState } from "@/components/page-load-state"
import { useStore } from "@/lib/store"

type Bucket = { date: string; inflow: number; outflow: number; closingBalance: number }
type Projection = { dailyBuckets: Bucket[]; daysOfBuffer: number; minProjectedBalance: number; troughDate: string | null; shortfallDate: string | null; closingBalance: number; currentCash: number; narrative?: string | null }

export default function CashflowPage() {
  const { dataVersion, session } = useStore()
  const canApprove = ["OWNER", "ADMIN"].includes(session?.role ?? "")
  const [notice, setNotice] = React.useState("")
  const [evidence, setEvidence] = React.useState<Record<string, { id: string; amount: number; createdAt: string }[]>>({})
  const [paymentIDs, setPaymentIDs] = React.useState<Record<string, string>>({})
  const sim = useSimulator()
  const [accounts, setAccounts] = React.useState<{ accounts: { id: string; name: string; accountType: string; currentBalance: number }[]; totalCash: number } | null>(null)
  const [projection, setProjection] = React.useState<Projection | null>(null)
  const [alerts, setAlerts] = React.useState<CashAlert[]>([])
  const [actions, setActions] = React.useState<{ id: string; actionType: string; title: string; rationale: string; projectedImpact: number; realizedImpact: number | null; status: string }[]>([])
  const [commitments, setCommitments] = React.useState<{ id: string; name: string; amount: number; dueDate: string; supplierPayable?: boolean; paymentCandidates?: { id: string; name: string | null; createdAt: string }[] }[]>([])
  const [supplierPayable, setSupplierPayable] = React.useState(false)
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [loaded, setLoaded] = React.useState(false)
  const [noteText, setNoteText] = React.useState("")
  const [commitName, setCommitName] = React.useState("")
  const [commitAmount, setCommitAmount] = React.useState("")
  const [commitDate, setCommitDate] = React.useState("")

  const load = React.useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [a, p, al, ta, c] = await Promise.all([
        cashflowApi.accounts(), cashflowApi.projection(), cashflowApi.alerts(),
        cashflowApi.treasuryActions(), cashflowApi.commitments(),
      ])
      setAccounts(a as typeof accounts)
      setProjection(p as typeof projection)
      setAlerts(al)
      setActions(ta as typeof actions)
      setCommitments(c as typeof commitments)
      setError("")
      setLoaded(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load cash-flow data. Log in and pick a shop, then try again.")
    } finally { setLoading(false) }
  }, [])

  // Refetch the real, persisted numbers once a simulator run (or reset) lands —
  // the drip-feed below only animates between two authentic states, it never
  // invents its own data.
  React.useEffect(() => {
    let active = true
    void Promise.resolve().then(() => { if (active) return load() })
    return () => { active = false }
  }, [sim.completedAt, load, dataVersion])

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    setError("")
    setNotice("")
    try { await fn(); await load() } catch (e) { setError(e instanceof Error ? e.message : "Action failed") } finally { setBusy(false) }
  }

  // Layer 2: while a simulator run is playing, morph the chart/gauge from the
  // pre-run projection to the simulator's real post-run projection in lockstep
  // with the day-by-day drip feed, instead of jump-cutting at the end.
  const [baseline, setBaseline] = React.useState<Projection | null>(null)
  React.useEffect(() => {
    if (sim.status !== "playing" || sim.dayIndex !== 0) return
    let active = true
    queueMicrotask(() => { if (active) setBaseline(projection) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.status, sim.dayIndex === 0])

  const simProjection = sim.result?.finalState.projection
  const morphing = sim.status === "playing" && !!simProjection && !!baseline
  const displayProjection: Projection | null = morphing
    ? {
        ...simProjection!,
        daysOfBuffer: Math.round(lerp(baseline!.daysOfBuffer, simProjection!.daysOfBuffer, sim.progress)),
        dailyBuckets: simProjection!.dailyBuckets.map((b, i) => ({
          ...b,
          closingBalance: lerp(baseline!.dailyBuckets[i]?.closingBalance ?? b.closingBalance, b.closingBalance, sim.progress),
        })),
      }
    : projection

  const buckets = displayProjection?.dailyBuckets ?? []
  const min = Math.min(0, ...buckets.map((b) => b.closingBalance))
  const max = Math.max(1, ...buckets.map((b) => b.closingBalance))
  const troughIndex = displayProjection?.troughDate ? buckets.findIndex((b) => b.date === displayProjection.troughDate) : -1
  const showTroughMarker = troughIndex >= 0 && (sim.progress > 0.35 || sim.status !== "playing") && (displayProjection?.minProjectedBalance ?? 1) < (displayProjection?.currentCash ?? 1) * 0.3
  const bufferLow = (displayProjection?.daysOfBuffer ?? 99) < 14

  if (!loaded) return <PageLoadState error={error} retry={() => void load()} />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cash Flow &amp; Treasury</h2>
          <p className="text-sm text-muted-foreground">Your 90-day cash position, watched by the Treasurer agent — every action is proposed, guarded, and later reconciled against what actually happened.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy || !canApprove} onClick={() => void run(() => cashflowApi.backfill())}><RefreshCw className="mr-2 h-4 w-4" /> Backfill ledger</Button>
          <Button disabled={busy || !canApprove} onClick={() => void run(() => cashflowApi.run())}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Run treasurer</Button>
        </div>
      </div>

      <PageRefreshState loading={loading} error={error} retry={() => void load()} />
      {notice && <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">{notice}</p>}

      <div className="metric-grid grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card><CardContent className="p-4"><p className="flex items-center gap-1 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> Cash now</p><p className="mt-1 text-2xl font-bold">{fmtBDT(displayProjection?.currentCash ?? accounts?.totalCash)}</p>{(accounts?.accounts ?? []).map((a) => <p key={a.id} className="text-xs text-muted-foreground">{a.name}: {fmtBDT(a.currentBalance)}</p>)}</CardContent></Card>
        <Card className={bufferLow ? "border-destructive/50" : undefined}><CardContent className="p-4"><p className="text-xs text-muted-foreground">Days of buffer</p><p className={`mt-1 text-2xl font-bold transition-colors duration-500 ${bufferLow ? "text-destructive" : ""}`}>{displayProjection?.daysOfBuffer ?? "—"}</p><p className="text-xs text-muted-foreground">Target: 14 days{bufferLow ? " · below target" : ""}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Lowest point (90d)</p><p className="mt-1 text-2xl font-bold">{fmtBDT(displayProjection?.minProjectedBalance)}</p><p className="text-xs text-muted-foreground">{displayProjection?.troughDate ?? ""}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Shortfall</p><p className="mt-1 text-2xl font-bold">{displayProjection?.shortfallDate ?? "None"}</p><p className="text-xs text-muted-foreground">Projected closing: {fmtBDT(displayProjection?.closingBalance)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Projected balance — next 90 days</CardTitle></CardHeader>
        <CardContent>
          {displayProjection?.narrative && <p className="mb-3 flex gap-2 text-sm text-muted-foreground"><Bot className="mt-0.5 h-4 w-4 shrink-0" />{displayProjection.narrative}</p>}
          <div className="relative flex h-48 items-end gap-0.5" role="img" aria-label="90-day projected cash balance chart">
            {showTroughMarker && (
              <div
                className="animate-in fade-in pointer-events-none absolute -top-6 flex -translate-x-1/2 flex-col items-center text-destructive duration-500"
                style={{ left: `${(troughIndex / Math.max(1, buckets.length - 1)) * 100}%` }}
              >
                <span className="flex items-center gap-1 whitespace-nowrap rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold"><TrendingDown className="h-3 w-3" /> trough {fmtBDT(displayProjection?.minProjectedBalance)}</span>
                <span className="h-5 w-px bg-destructive" />
              </div>
            )}
            {buckets.map((b, i) => (
              <div key={b.date} title={`${b.date}: ${fmtBDT(b.closingBalance)}`} className={`flex-1 rounded-t transition-[height] duration-150 ${b.closingBalance < 0 ? "bg-destructive" : i === troughIndex && showTroughMarker ? "bg-destructive/70" : "bg-linear-to-t from-brand-600 to-brand-400"}`} style={{ height: `${Math.max(2, ((b.closingBalance - min) / (max - min || 1)) * 100)}%` }} />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>Today</span><span>+45d</span><span>+90d</span></div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" /> Alerts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 && <p className="text-sm text-muted-foreground">No open alerts. Run the treasurer after backfilling to evaluate the nine alert rules.</p>}
            {alerts.map((a) => (
              <div key={a.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{a.title}</p><Badge variant={a.severity === "CRITICAL" ? "destructive" : "secondary"}>{a.severity}</Badge></div>
                <p className="mt-1 text-sm text-muted-foreground">{a.message}</p>
                {a.aiNarrative && <p className="mt-1 text-xs text-muted-foreground">Treasurer: {a.aiNarrative}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {(a.recommendedActions ?? []).map((r, i) => (
                    <Button key={i} size="sm" disabled={busy || !canApprove} title={r.description} onClick={() => void run(async () => { await cashflowApi.executeAlert(a.id, { actionIndex: i }); setNotice("Recommendation added to Treasurer actions for review. No money has moved.") })}>Review {r.actionType.replaceAll("_", " ")} · {fmtBDT(r.projectedImpact)}</Button>
                  ))}
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(async () => { await cashflowApi.ackAlert(a.id, "ack"); setNotice("Alert acknowledged and removed from open alerts.") })}><Check className="mr-1 h-3.5 w-3.5" /> Acknowledge</Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(async () => { await cashflowApi.ackAlert(a.id, "dismiss"); setNotice("Alert dismissed and removed from open alerts.") })}><X className="mr-1 h-3.5 w-3.5" /> Dismiss</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Treasurer actions — projected vs actual</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">Approval records your decision only. Collect debts, move funds or change payments separately and record the actual transaction; projected impact is not realized income.</p>
              {actions.length === 0 && <p className="text-sm text-muted-foreground">No actions yet. The treasurer only proposes from a pre-computed menu; anything moving money needs your approval.</p>}
              {actions.map((a) => (
                <div key={a.id} className="flex flex-col items-start justify-between gap-2 rounded-lg border p-3 sm:flex-row">
                  <div><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-muted-foreground">{a.rationale}</p><p className="text-xs">Projected: {fmtBDT(a.projectedImpact)} · Actual result: {a.realizedImpact == null ? "pending" : fmtBDT(a.realizedImpact)} · {a.status}</p></div>
                  {a.status === "PROPOSED" && <div className="flex gap-1"><Button size="sm" disabled={busy || !canApprove} onClick={() => void run(async () => { await cashflowApi.decideAction(a.id, true); setNotice("Action approved. No money moved; complete and record the actual transaction separately.") })}>Approve plan</Button><Button size="sm" variant="ghost" disabled={busy || !canApprove} onClick={() => void run(() => cashflowApi.decideAction(a.id, false))}>Reject</Button></div>}
                  {a.status === "APPROVED" && a.actionType === "COLLECT_DEBT" && canApprove && <div className="w-full space-y-2 sm:max-w-sm">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => { const payments = await cashflowApi.collectionEvidence(a.id); setEvidence(previous => ({ ...previous, [a.id]: payments })) })}>Load recorded collections</Button>
                    {evidence[a.id] && (evidence[a.id].length ? <>
                      <select aria-label="Recorded debt payment" className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={paymentIDs[a.id] ?? ""} onChange={event => setPaymentIDs(previous => ({ ...previous, [a.id]: event.target.value }))}>
                        <option value="">Choose a recorded payment</option>{evidence[a.id].map(payment => <option key={payment.id} value={payment.id}>{fmtBDT(payment.amount)} · {payment.createdAt.slice(0, 10)} · {payment.id.slice(-6)}</option>)}
                      </select>
                      <Button size="sm" disabled={busy || !paymentIDs[a.id]} onClick={() => void run(async () => { await cashflowApi.recordCollection(a.id, paymentIDs[a.id]); setNotice("Existing payment linked as evidence. No additional payment or cash movement was created.") })}>Link collection evidence</Button>
                    </> : <p className="text-xs text-muted-foreground">No unused payments recorded after approval. Record the actual customer payment in Debts, then reload.</p>)}
                  </div>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Upcoming commitments</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {commitments.slice(0, 6).map((c) => <div key={c.id} className="space-y-1 text-sm"><p className="flex flex-col justify-between gap-1 sm:flex-row"><span>{c.name}{c.supplierPayable ? " · Recorded supplier obligation" : ""}</span><span>{fmtBDT(c.amount)} · {String(c.dueDate).slice(0, 10)}</span></p>{c.supplierPayable && <select aria-label={`Link purchase payment for ${c.name}`} className="h-9 w-full rounded-md border bg-background px-2" disabled={busy || !canApprove} value="" onChange={(e) => { const id = e.target.value; if (id) void run(() => cashflowApi.settleCommitment(c.id, id)) }}><option value="">{c.paymentCandidates?.length ? "Link a recorded purchase to settle" : "No matching purchase payment recorded yet"}</option>{c.paymentCandidates?.map(p => <option key={p.id} value={p.id}>{p.name ?? "Purchase"} · {String(p.createdAt).slice(0, 10)}</option>)}</select>}</div>)}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Input placeholder="Name" value={commitName} onChange={(e) => setCommitName(e.target.value)} />
                <Input placeholder="Amount" inputMode="numeric" value={commitAmount} onChange={(e) => setCommitAmount(e.target.value)} />
                <Input type="date" aria-label="Commitment due date" className="min-w-0" value={commitDate} onChange={(e) => setCommitDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button size="sm" disabled={busy || !canApprove || !commitName || Number(commitAmount) <= 0 || !commitDate} onClick={() => void run(async () => { await cashflowApi.createCommitment({ name: commitName, amount: Number(commitAmount), dueDate: commitDate, supplierPayable }); setCommitName(""); setCommitAmount(""); setCommitDate("") })}>Add commitment</Button>
                <Input placeholder='Or paste a note: "Rent 45000 due in 5 days, monthly"' value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <Button size="sm" variant="outline" disabled={busy || !canApprove || !noteText} onClick={() => void run(async () => { await cashflowApi.extractCommitment(noteText); setNoteText("") })}>Extract</Button>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={supplierPayable} disabled={!canApprove} onChange={e => setSupplierPayable(e.target.checked)} />This is an existing unpaid supplier obligation, not a planned purchase.</label>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
