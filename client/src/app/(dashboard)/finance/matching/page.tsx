"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Bot, FileCheck, HandCoins, Loader2 } from "lucide-react"
import { fmtBDT, fmtPct, matchingApi, type FinanceMatch, type FinanceOffer } from "@/lib/finance-api"
import { PageLoadState, PageRefreshState } from "@/components/page-load-state"
import { useStore } from "@/lib/store"

export default function MatchingPage() {
  const { dataVersion } = useStore()
  const [amount, setAmount] = React.useState("300000")
  const [tenor, setTenor] = React.useState("6")
  const [purpose, setPurpose] = React.useState("INVENTORY")
  const [maxRate, setMaxRate] = React.useState("")
  const [matches, setMatches] = React.useState<FinanceMatch[]>([])
  const [offers, setOffers] = React.useState<FinanceOffer[]>([])
  const [applications, setApplications] = React.useState<{ id: string; requestedAmount: number; status: string; schedule?: { installmentNo: number; totalDue: number; status: string }[] }[]>([])
  const [notice, setNotice] = React.useState("")
  const [transcript, setTranscript] = React.useState<{ id?: string; fromParty: string; message: string; reasoning: string; round: number }[]>([])
  const [busy, setBusy] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [loaded, setLoaded] = React.useState(false)
  const [loadError, setLoadError] = React.useState("")

  const load = React.useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      const [r, apps] = await Promise.all([matchingApi.results(), matchingApi.applications()])
      setMatches(r.matches)
      setOffers(r.offers)
      setApplications(apps as typeof applications)
      setLoaded(true)
    } catch (e) { setLoadError(e instanceof Error ? e.message : "Could not load financing data.") } finally { setLoading(false) }
  }, [])
  React.useEffect(() => {
    let active = true
    void Promise.resolve().then(() => { if (active) return load() })
    return () => { active = false }
  }, [load, dataVersion])

  const run = async () => {
    setBusy(true); setNotice("")
    try {
      const result = await matchingApi.run({
        requestedAmount: Number(amount), preferredTenorMonths: Number(tenor), purpose,
        ...(maxRate ? { maxRate: Number(maxRate) } : {}),
      }) as { insufficientData?: boolean; message?: string }
      if (result.insufficientData) setNotice(result.message ?? "Insufficient data for matching.")
      await load()
    } catch (e) { setNotice(e instanceof Error ? e.message : "Matching failed") } finally { setBusy(false) }
  }

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try { await fn(); await load() } catch (e) { setNotice(e instanceof Error ? e.message : "Action failed") } finally { setBusy(false) }
  }

  const negotiate = async (offer: FinanceOffer) => {
    setBusy(true)
    try {
      const result = await matchingApi.negotiate(offer.id) as { negotiation?: typeof transcript }
      setTranscript(result.negotiation ?? [])
      await load()
    } catch (e) { setNotice(e instanceof Error ? e.message : "Negotiation failed") } finally { setBusy(false) }
  }

  if (!loaded) return <PageLoadState error={loadError} retry={() => void load()} />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Financing Matching</h2>
        <p className="text-sm text-muted-foreground">A simulated market: deterministic rules decide eligibility, the AI lender prices risk, and your Borrower agent negotiates back — capped at 3 rounds, guarded by what your cash flow can actually service.</p>
        <Badge variant="secondary" className="mt-2">Simulated market for evaluation — no real lender is contacted</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><HandCoins className="h-4 w-4" /> What do you need?</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Amount (BDT)<Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label className="text-sm">Tenor (months)<Input inputMode="numeric" value={tenor} onChange={(e) => setTenor(e.target.value)} /></label>
          <label className="text-sm">Purpose
            <select className="mt-1 block h-9 rounded-md border bg-background px-2 text-sm" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              {["WORKING_CAPITAL", "INVENTORY", "EXPANSION", "EQUIPMENT", "DEBT_CONSOLIDATION", "EMERGENCY"].map((p) => <option key={p} value={p}>{p.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="text-sm">Max rate % (optional)<Input inputMode="decimal" value={maxRate} onChange={(e) => setMaxRate(e.target.value)} /></label>
          <Button disabled={busy} onClick={() => void run()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Find &amp; negotiate offers</Button>
        </CardContent>
      </Card>

      <PageRefreshState loading={loading} error={loadError} retry={() => void load()} />
      {notice && <p role="alert" className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">{notice}</p>}

      {matches.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Ranked options (rule gate first, AI re-rank second)</h3>
          {[...matches].sort((a, b) => b.finalScore - a.finalScore).map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{m.product?.name ?? "Finance product"} <span className="text-xs text-muted-foreground">{m.product?.provider?.name ?? ""} · {m.product?.productType ?? ""}</span></p>
                  <Badge variant={m.eligibilityStatus === "ELIGIBLE" ? "default" : "secondary"}>{m.eligibilityStatus.replace("_", " ")}</Badge>
                </div>
                <div className="mt-2 h-2 rounded bg-muted"><div className="h-2 rounded bg-brand-500" style={{ width: `${Math.max(0, Math.min(100, m.finalScore))}%` }} /></div>
                <p className="mt-2 text-sm text-muted-foreground">{m.aiRationale}</p>
                <p className="mt-1 text-xs text-muted-foreground">Fit {m.finalScore.toFixed(0)}/100 · Est. APR {fmtPct(m.estimatedCost)} · Max affordable {fmtBDT(m.maxAffordableAmount)}{m.failedRules.length ? ` · Failed: ${m.failedRules.join(", ")}` : ""}</p>
                {(m.aiTradeoffs ?? []).map((t, i) => <p key={i} className="text-xs text-muted-foreground">– {t}</p>)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {offers.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Binding offers from the AI lender</h3>
          {offers.map((o) => (
            <Card key={o.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-medium">{fmtBDT(o.offeredAmount)} at {fmtPct(o.offeredRate)} · {o.tenorMonths} months</p>
                  <Badge variant={o.status === "ACCEPTED" ? "default" : "secondary"}>{o.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Effective APR {fmtPct(o.effectiveApr)} · Total repayment {fmtBDT(o.totalRepayment)} · Confidence {(o.confidence * 100).toFixed(0)}%</p>
                <p className="mt-1 text-sm text-muted-foreground">{o.rationale}</p>
                <p className="text-xs text-muted-foreground">Documents: {(o.conditions ?? []).join(" · ") || "Standard KYC"}</p>
                {["ISSUED", "COUNTERED"].includes(o.status) && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" disabled={busy} onClick={() => void negotiate(o)}><Bot className="mr-1 h-4 w-4" /> Let agents negotiate</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(() => matchingApi.accept(o.id))}><FileCheck className="mr-1 h-4 w-4" /> Accept &amp; apply</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act(() => matchingApi.reject(o.id))}>Walk away</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {transcript.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Negotiation — Lender agent vs Borrower agent</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {transcript.map((t, i) => (
              <div key={t.id ?? i} className={`max-w-[85%] rounded-lg p-3 text-sm ${t.fromParty === "LENDER_AGENT" ? "bg-muted" : "ml-auto bg-brand-50 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100"}`}>
                <p className="text-xs font-medium">{t.fromParty.replace("_", " ")} · round {t.round}</p>
                <p>{t.message}</p><p className="text-xs text-muted-foreground">{t.reasoning}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {applications.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Applications &amp; repayment schedule</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {applications.map((a) => (
              <div key={a.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{fmtBDT(a.requestedAmount)} · {a.status}</p>
                <p className="text-xs text-muted-foreground">{(a.schedule ?? []).slice(0, 6).map((s) => `#${s.installmentNo} ${fmtBDT(s.totalDue)} (${s.status})`).join(" · ")}{(a.schedule?.length ?? 0) > 6 ? " · …" : ""}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
