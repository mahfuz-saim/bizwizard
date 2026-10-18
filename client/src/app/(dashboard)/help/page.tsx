import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function HelpPage() {
  return <div className="space-y-6">
    <h2 className="text-2xl font-bold tracking-tight">Help &amp; support</h2>
    <Card><CardHeader><CardTitle>Using BizWizard</CardTitle></CardHeader><CardContent className="space-y-4 text-sm">
      <p><Link className="text-primary underline" href="/inventory">Inventory</Link>: add products, record fully paid stock purchases, and edit remaining stock’s sell price or expiry. Purchase cost and catalog fields are read-only after creation.</p>
      <p><Link className="text-primary underline" href="/sales">Sales</Link>: record sales and payments. Credit sales require an existing customer. Payment channels are not tracked.</p>
      <p><Link className="text-primary underline" href="/finance/cashflow">Cash flow</Link>: review alerts and proposed actions. Approval records your decision; it does not automatically collect debt, transfer funds or defer a payment.</p>
      <p>For a failed operation, copy the displayed error and note the page and steps, then contact your shop owner or project administrator. Never share your password, access token or environment variables.</p>
      <p className="text-muted-foreground">There is no in-app support chat or ticket service.</p>
    </CardContent></Card>
  </div>
}
