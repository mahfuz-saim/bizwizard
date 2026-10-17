import 'dotenv/config';
/**
 * Finance Copilot seed (PLAN §8). Idempotent:
 *   npm run seed:finance
 * Seeds the 7-provider / 12-product catalog, the four agent mandates, default
 * cash accounts for every existing shop, and ~200 historical AiRun rows so the
 * agent ledger looks alive on first open. Safe to re-run.
 */
import { PrismaClient } from '@prisma/client';
import {
  ensureCatalog,
  ensureDefaultPolicies,
  // eslint-disable-next-line @typescript-eslint/no-var-requires
} from '../src/app/modules/finance/shared/catalog';

const prisma = new PrismaClient();

async function main() {
  const catalog = await ensureCatalog(prisma as never);
  await ensureDefaultPolicies(prisma as never);
  console.log(`Catalog: ${catalog.providers} providers, ${catalog.products} products. Policies: 4 mandates.`);

  const shops = await prisma.shop.findMany({ select: { id: true, tenantID: true } });
  let accounts = 0;
  for (const shop of shops) {
    const existing = await prisma.cashAccount.count({ where: { shopID: shop.id } });
    if (existing) continue;
    await prisma.cashAccount.createMany({
      data: [
        { tenantID: shop.tenantID, shopID: shop.id, name: 'Daily Cash Box', accountType: 'CASH', openingBalance: 0, currentBalance: 0, isPrimary: true },
        { tenantID: shop.tenantID, shopID: shop.id, name: 'bKash Merchant', accountType: 'EWALLET', openingBalance: 0, currentBalance: 0 },
        { tenantID: shop.tenantID, shopID: shop.id, name: 'Bank Account', accountType: 'BANK', openingBalance: 0, currentBalance: 0 },
      ],
    });
    accounts += 3;
  }
  console.log(`Cash accounts created: ${accounts} across ${shops.length} shops.`);

  const runCount = await prisma.aiRun.count();
  if (runCount < 200) {
    const purposes: Array<[string, string]> = [
      ['LENDER_AGENT', 'price_offer'],
      ['BORROWER_AGENT', 'rank_financing_products'],
      ['TREASURER_AGENT', 'choose_treasury_actions'],
      ['ANALYST_AGENT', 'hypothesize_anomalies'],
    ];
    const rows = Array.from({ length: 200 - runCount }, (_, i) => {
      const [agentType, purpose] = purposes[i % purposes.length];
      return {
        agentType,
        purpose,
        model: 'deterministic-fallback',
        promptVersion: 'v1',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs: 40 + ((i * 37) % 300),
        status: 'SUCCESS' as const,
        createdAt: new Date(Date.now() - i * 36e5),
      };
    });
    await prisma.aiRun.createMany({ data: rows });
    console.log(`AiRun history seeded: ${rows.length} rows.`);
  }
  console.log('Tip: POST /api/v1/finance/cashflow/backfill and /run per shop to populate projections.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
