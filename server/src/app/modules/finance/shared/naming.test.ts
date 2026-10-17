import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Naming-contract guard (PLAN §2.1): every NEW finance model must use
 * tenantID / shopID / <entity>ID columns — never tenantId / shopId — so a
 * generated validator or where-clause cannot silently mismatch.
 */
test('new finance Prisma models follow the tenantID/shopID contract', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  const section = schema.slice(schema.indexOf('SME FINANCE COPILOT'));
  assert.ok(section.length > 1000, 'finance schema section found');
  const models = section.match(/model\s+\w+\s*\{[^}]*\}/g) ?? [];
  assert.ok(models.length >= 20, `expected 20+ finance models, got ${models.length}`);
  for (const model of models) {
    assert.ok(!/^\s+tenantId\s/m.test(model), `tenantId column leaked into: ${model.slice(0, 60)}`);
    assert.ok(!/^\s+shopId\s/m.test(model), `shopId column leaked into: ${model.slice(0, 60)}`);
  }
  for (const required of ['model FinanceProduct', 'model FinancingOffer', 'model CashTransaction', 'model AiDecision', 'model AgentPerformance', 'model CashFlowProjection', 'model Insight', 'model TreasuryAction'])
    assert.ok(section.includes(required), `${required} present`);
});
