"use client"

import * as React from "react"
import { Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"
import { api } from "@/lib/api"

type Mode = "login" | "register" | "forgot" | "otp" | "reset"

export function AuthScreen() {
  const { login, runDemo, error: connectionError } = useStore()
  const [mode, setMode] = React.useState<Mode>("login")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [resetToken, setResetToken] = React.useState("")

  function navigate(next: Mode) {
    setMode(next)
    setError("")
    setMessage("")
    setResetToken("")
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const identifier = String(fields.get("identifier") || "").trim()
    const password = String(fields.get("password") || "")
    setBusy(true)
    setError("")
    setMessage("")
    try {
      if (mode === "login") {
        await login(identifier, password)
      } else if (mode === "register") {
        await api.post("/auth/register", {
          name: String(fields.get("name") || "").trim(),
          shopName: String(fields.get("shopName") || "").trim(),
          ...(identifier.includes("@") ? { email: identifier } : { number: identifier }),
          password,
        })
        await login(identifier, password)
      } else if (mode === "forgot") {
        const response = await api.post<{ token: string }>("/auth/forget-password", { number: identifier })
        if (!response.data?.token) throw new Error("Could not start password reset.")
        setResetToken(response.data.token)
        setMode("otp")
        setMessage("Enter the verification code sent to your phone.")
      } else if (mode === "otp") {
        const response = await api.postWithAuthorization<{ token: string }>("/auth/check-otp", { OTP: Number(fields.get("otp")) }, resetToken)
        if (!response.data?.token) throw new Error("Could not verify the code.")
        setResetToken(response.data.token)
        setMode("reset")
      } else {
        await api.postWithAuthorization("/auth/reset-password", { newPassword: password }, resetToken)
        navigate("login")
        setMessage("Password reset successfully. Log in with your new password.")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const title = mode === "login" ? "Log in to BizWizard" : mode === "register" ? "Create your account" : mode === "otp" ? "Verify your phone" : "Reset your password"

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <section className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm sm:p-8" aria-labelledby="auth-title">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-primary p-3 text-primary-foreground"><Store className="h-6 w-6" /></div>
          <div><h1 id="auth-title" className="text-xl font-semibold">{title}</h1><p className="text-sm text-muted-foreground">Manage your business with confidence.</p></div>
        </div>
        <form key={mode} onSubmit={submit} className="space-y-4">
          {mode === "register" && <>
            <div className="space-y-2"><Label htmlFor="name">Your name</Label><Input id="name" name="name" autoComplete="name" required disabled={busy} /></div>
            <div className="space-y-2"><Label htmlFor="shopName">Shop name</Label><Input id="shopName" name="shopName" required disabled={busy} /></div>
          </>}
          {(mode === "login" || mode === "register" || mode === "forgot") && <div className="space-y-2">
            <Label htmlFor="identifier">{mode === "forgot" ? "Phone number" : "Email or phone number"}</Label>
            <Input id="identifier" name="identifier" type={mode === "forgot" ? "tel" : "text"} autoComplete={mode === "forgot" ? "tel" : "username"} required disabled={busy} />
          </div>}
          {(mode === "login" || mode === "register" || mode === "reset") && <div className="space-y-2">
            <Label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</Label>
            <Input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? undefined : 6} required disabled={busy} />
          </div>}
          {mode === "otp" && <div className="space-y-2"><Label htmlFor="otp">Verification code</Label><Input id="otp" name="otp" inputMode="numeric" pattern="[0-9]{4}" autoComplete="one-time-code" required disabled={busy} /></div>}
          {(error || connectionError) && <p role="alert" className="text-sm text-destructive">{error || connectionError}</p>}
          {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset code" : mode === "otp" ? "Verify code" : "Save new password"}</Button>
        </form>
        <div className="mt-4 flex flex-col gap-2">
          {mode === "login" ? <>
            <Button variant="outline" disabled={busy} onClick={() => navigate("register")}>Create account</Button>
            <Button variant="ghost" disabled={busy} onClick={() => navigate("forgot")}>Reset password</Button>
          </> : <Button variant="ghost" disabled={busy} onClick={() => navigate("login")}>Back to login</Button>}
        </div>
        <div className="mt-6 border-t pt-6">
          <p className="mb-3 text-center text-sm text-muted-foreground">Just exploring? Try sample data without an account.</p>
          <Button variant="secondary" className="w-full" disabled={busy} onClick={runDemo}>Run Demo</Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">Demo changes are temporary and never sent to your account.</p>
        </div>
      </section>
    </main>
  )
}
