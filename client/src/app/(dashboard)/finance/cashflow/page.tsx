"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Bot, Check, Loader2, Play, RefreshCw, Wallet, X } from "lucide-react"
import { cashflowApi, fmtBDT, type CashAlert } from "@/lib/finance-api"

type Bucket = { date: string; inflow: number; outflow: number; closingBalance: number }

export default function CashflowPage() {
  const [accounts, setAccounts] = React.useState<{ accounts: { id: string; name: string; accountType: string; currentBalance: number }[]; totalCash: number } | null>(null)
  const [projection, setProjection] = React.useState<{ dailyBuckets: Bucket[]; daysOfBuffer: number; minProjectedBalance: number; troughDate: string | null; shortfallDate: string | null; closingBalance: number; currentCash: number; narrative?: string | null } | null>(null)
  const [alerts, setAlerts] = React.useState<CashAlert[]>([])
  const [actions, setActions] = React.useState<{ id: string; title: string; rationale: string; projectedImpact: number; realizedImpact: number | null; status: string }[]>([])
  const [commitments, setCommitments] = React.useState<{ id: string; name: string; amount: number; dueDate: string }[]>([])
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [noteText, setNoteText] = React.useState("")
  const [commitName, setCommitName] = React.useState("")
  const [commitAmount, setCommitAmount] = React.useState("")
  const [commitDate, setCommitDate] = React.useState("")

  const load = React.useCallback(async () => {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load cash-flow data. Log in and pick a shop, then try again.")
    }
  }, [])

  React.useEffect(() => { void load() }, [load])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try { await fn(); await load() } catch (e) { setError(e instanceof Error ? e.message : "Action failed") } finally { setBusy(false) }
  }

  const buckets = projection?.dailyBuckets ?? []
  const min = Math.min(0, ...buckets.map((b) => b.closingBalance))
  const max = Math.max(1, ...buckets.map((b) => b.closingBalance))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cash Flow &amp; Treasury</h2>
          <p className="text-sm text-muted-foreground">Your 90-day cash position, watched by the Treasurer agent — every action is proposed, guarded, and later reconciled against what actually happened.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy} onClick={() => void run(() => cashflowApi.backfill())}><RefreshCw className="mr-2 h-4 w-4" /> Backfill ledger</Button>
          <Button disabled={busy} onClick={() => void run(() => cashflowApi.run())}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Run treasurer</Button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card><CardContent className="p-4"><p className="flex items-center gap-1 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> Cash now</p><p className="mt-1 text-2xl font-bold">{fmtBDT(projection?.currentCash ?? accounts?.totalCash)}</p>{(accounts?.accounts ?? []).map((a) => <p key={a.id} className="text-xs text-muted-foreground">{a.name}: {fmtBDT(a.currentBalance)}</p>)}</CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Days of buffer</p><p className="mt-1 text-2xl font-bold">{projection?.daysOfBuffer ?? "—"}</p><p className="text-xs text-muted-foreground">Target: 14 days</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Lowest point (90d)</p><p className="mt-1 text-2xl font-bold">{fmtBDT(projection?.minProjectedBalance)}</p><p className="text-xs text-muted-foreground">{projection?.troughDate ?? ""}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Shortfall</p><p className="mt-1 text-2xl font-bold">{projection?.shortfallDate ?? "None"}</p><p className="text-xs text-muted-foreground">Projected closing: {fmtBDT(projection?.closingBalance)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Projected balance — next 90 days</CardTitle></CardHeader>
        <CardContent>
          {projection?.narrative && <p className="mb-3 flex gap-2 text-sm text-muted-foreground"><Bot className="mt-0.5 h-4 w-4 shrink-0" />{projection.narrative}</p>}
          <div className="flex h-48 items-end gap-[2px]" role="img" aria-label="90-day projected cash balance chart">
            {buckets.map((b) => (
              <div key={b.date} title={`${b.date}: ${fmtBDT(b.closingBalance)}`} className={`flex-1 rounded-t ${b.closingBalance < 0 ? "bg-destructive" : "bg-gradient-to-t from-brand-600 to-brand-400"}`} style={{ height: `${Math.max(2, ((b.closingBalance - min) / (max - min || 1)) * 100)}%` }} />
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
                    <Button key={i} size="sm" disabled={busy} onClick={() => void run(() => cashflowApi.executeAlert(a.id, { actionType: r.actionType, projectedImpact: r.projectedImpact }))}>{r.actionType.replaceAll("_", " ")} · {fmtBDT(r.projectedImpact)}</Button>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => void run(() => cashflowApi.ackAlert(a.id, "ack"))}><Check className="mr-1 h-3.5 w-3.5" /> Acknowledge</Button>
                  <Button size="sm" variant="ghost" onClick={() => void run(() => cashflowApi.ackAlert(a.id, "dismiss"))}><X className="mr-1 h-3.5 w-3.5" /> Dismiss</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Treasurer actions — projected vs realized</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {actions.length === 0 && <p className="text-sm text-muted-foreground">No actions yet. The treasurer only proposes from a pre-computed menu; anything moving money needs your approval.</p>}
              {actions.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
                  <div><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-muted-foreground">{a.rationale}</p><p className="text-xs">Projected {fmtBDT(a.projectedImpact)} · Realized {a.realizedImpact == null ? "pending" : fmtBDT(a.realizedImpact)} · {a.status}</p></div>
                  {a.status === "PROPOSED" && <div className="flex gap-1"><Button size="sm" onClick={() => void run(() => cashflowApi.decideAction(a.id, true))}>Approve</Button><Button size="sm" variant="ghost" onClick={() => void run(() => cashflowApi.decideAction(a.id, false))}>Reject</Button></div>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Upcoming commitments</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {commitments.slice(0, 6).map((c) => <p key={c.id} className="flex justify-between text-sm"><span>{c.name}</span><span>{fmtBDT(c.amount)} · {String(c.dueDate).slice(0, 10)}</span></p>)}
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Name" value={commitName} onChange={(e) => setCommitName(e.target.value)} />
                <Input placeholder="Amount" inputMode="numeric" value={commitAmount} onChange={(e) => setCommitAmount(e.target.value)} />
                <Input type="date" value={commitDate} onChange={(e) => setCommitDate(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy || !commitName || !commitAmount || !commitDate} onClick={() => void run(async () => { await cashflowApi.createCommitment({ name: commitName, amount: Number(commitAmount), dueDate: commitDate }); setCommitName(""); setCommitAmount(""); setCommitDate("") })}>Add commitment</Button>
                <Input placeholder='Or paste a note: "Rent 45000 due in 5 days, monthly"' value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <Button size="sm" variant="outline" disabled={busy || !noteText} onClick={() => void run(async () => { await cashflowApi.extractCommitment(noteText); setNoteText("") })}>Extract</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
