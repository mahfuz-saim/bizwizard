"use client"

import * as React from 'react'
import { loadNavigationData } from './navigation-data'
import { useStore } from './store'

export function useShopQuery<T>(section: string, params: Record<string, string | number> = {}) {
  const { source, session, dataVersion } = useStore()
  const [attempt, setAttempt] = React.useState(0)
  const scope = JSON.stringify([section, session?.shopId])
  const key = JSON.stringify([section, session?.shopId, params, dataVersion, attempt])
  const [result, setResult] = React.useState<{ key: string; scope: string; data?: T; error?: string }>()
  React.useEffect(() => {
    const [section, shopId, query] = JSON.parse(key)
    if (source !== 'backend' || !shopId) return
    let active = true
    void loadNavigationData<T>(section, shopId, query).then(
      data => { if (active) setResult({ key, scope, data }) },
      error => { if (active) setResult(previous => ({ key, scope, data: previous?.scope === scope ? previous.data : undefined, error: error instanceof Error ? error.message : 'Unable to load this page' })) },
    )
    return () => { active = false }
  }, [key, scope, source])
  return { data: result?.scope === scope ? result.data : undefined, error: result?.key === key ? result.error : undefined,
    loading: result?.key !== key, retry: () => setAttempt(v => v + 1), remote: source === 'backend' }
}
