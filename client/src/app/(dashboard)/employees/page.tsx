"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { UserCog, Plus, Shield, Calendar, Phone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDate, generateAvatarColor, getInitials } from "@/lib/utils"

const employees = [
  { id: "e1", name: "Store Owner", phone: "01700000000", role: "OWNER" as const, joinedAt: new Date(Date.now() - 1000*60*60*24*365).toISOString() },
  { id: "e2", name: "Rafiqul Islam", phone: "01811112222", role: "EMPLOYEE" as const, joinedAt: new Date(Date.now() - 1000*60*60*24*120).toISOString() },
]

export default function EmployeesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Employees</h2>
          <p className="text-sm text-muted-foreground">Manage staff, roles, attendance and permissions.</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" /> Invite Employee</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Staff</p><p className="mt-1 text-2xl font-bold">{employees.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active Today</p><p className="mt-1 text-2xl font-bold text-success">{employees.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Team Members</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {employees.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-lg border p-4">
              <Avatar className="h-12 w-12" style={{ backgroundColor: generateAvatarColor(e.name) }}>
                <AvatarFallback className="bg-transparent text-white">{getInitials(e.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold">{e.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> {e.phone}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" /> Joined {formatDate(e.joinedAt)}</p>
              </div>
              <Badge variant={e.role === "OWNER" ? "default" : "secondary"} className="gap-1">
                <Shield className="h-3 w-3" /> {e.role}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
