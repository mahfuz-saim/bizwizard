import { redirect } from "next/navigation"

export default function ReportsPage() {
  redirect("/finance/analysis?tab=reports")
}
