import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { loadNavigationData, pageRange, pageTransactions } from './navigation-data'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('navigation requests one server page, including filters, without walking history', async () => {
  const calls: URL[] = []
  globalThis.fetch = async input => {
    const url = new URL(String(input))
    calls.push(url)
    return new Response(JSON.stringify({ success: true, data: { page: 2, total: 15529 } }), { status: 200 })
  }
  const result = await loadNavigationData<{ page: number; total: number }>('transactions', 'shop-1', { page: 2, search: 'Rice', type: 'sale' })
  assert.equal(result.total, 15529)
  assert.equal(calls.length, 1)
  assert(calls[0].pathname.endsWith('/analytics/navigation/transactions'))
  assert.equal(calls[0].searchParams.get('page'), '2')
  assert.equal(calls[0].searchParams.get('shopId'), 'shop-1')
  assert.equal(calls[0].searchParams.get('search'), 'Rice')
})

test('page ranges reflect the server total rather than the loaded ten records', () => {
  assert.deepEqual(pageRange(2, 15529), { page: 2, total: 15529, pageCount: 1553, rangeStart: 11, rangeEnd: 20 })
  assert.deepEqual(pageRange(1, 0), { page: 1, total: 0, pageCount: 1, rangeStart: 0, rangeEnd: 0 })
})

test('empty history remains empty; failed or missing summaries are not replaced by zero totals', async () => {
  assert.deepEqual(pageTransactions({ checkouts: [], purchases: [], page: 1, total: 0, totals: { sales: 0, purchases: 0, due: 0 } }), [])
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true }), { status: 200 })
  await assert.rejects(() => loadNavigationData('reports', 'shop'), /Missing page data/)
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Unavailable' }), { status: 503 })
  await assert.rejects(() => loadNavigationData('reports', 'shop'), /Unavailable/)
})
