"use client"

import * as React from "react"
import { Input, type InputProps } from "./input"

export function NumberFriendlyInput({ value, type, onChange, onBlur, onFocus, ...props }: InputProps) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const numeric = type === "number"
  const showDraft = numeric && draft !== null && Number(draft) === Number(value)
  return <Input {...props} type={type} value={showDraft ? draft : value}
    onChange={e => { if (numeric) setDraft(e.target.value); onChange?.(e) }}
    onFocus={e => { if (numeric && e.target.value === "0") e.target.select(); onFocus?.(e) }}
    onBlur={e => { setDraft(null); onBlur?.(e) }} />
}
