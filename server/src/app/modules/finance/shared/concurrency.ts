/**
 * Bounded concurrency helper (PLAN §4.3 step 5.5, §7.3).
 * Worker-pool over Promise.allSettled semantics: one failed/slow item never
 * fails the batch, and at most `limit` functions are ever in flight.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<Array<{ status: 'fulfilled'; value: R } | { status: 'rejected'; reason: unknown }>> {
  const results: Array<
    { status: 'fulfilled'; value: R } | { status: 'rejected'; reason: unknown }
  > = new Array(items.length);
  const cap = Math.max(1, Math.min(Math.floor(limit) || 1, items.length || 1));
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const idx = next++;
      try {
        results[idx] = { status: 'fulfilled', value: await fn(items[idx], idx) };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(Array.from({ length: cap }, () => worker()));
  return results;
}

/** Race a promise against a sub-budget; rejects with a TIMEOUT error. */
export async function withTimeout<T>(p: Promise<T>, ms: number, label = 'call'): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
