import assert from "node:assert/strict"
import { test } from "node:test"
import { fmtBDT, fmtPct, normalizeRow } from "./finance-api"

test("currency formatting uses taka sign and Indian grouping, null-safe", () => {
  assert.equal(fmtBDT(45000), "৳45,000")
  assert.equal(fmtBDT(null), "৳0")
  assert.equal(fmtPct(16.5), "16.5%")
})

test("normalizeRow derives a stable display key without touching numbers", () => {
  const row = normalizeRow({ id: "abc", amount: 100.5 })
  assert.equal(row.key, "abc")
  assert.equal(row.amount, 100.5)
  const metric = normalizeRow({ metricKey: "dso", value: 21 })
  assert.equal(metric.key, "dso")
})
