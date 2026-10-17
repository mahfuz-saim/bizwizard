/**
 * Seeded financing catalog (PLAN §8): 7 providers, 12 products with realistic
 * BD parameters. `ensureCatalog` upserts by name so it is safe to call on
 * first use, from the seed script, and in tests with a fake client.
 */
export interface CatalogProvider {
  name: string;
  providerType: string;
  riskAppetite: number;
  baseRate: number;
}
export interface CatalogProduct {
  providerName: string;
  name: string;
  productType: string;
  description: string;
  minAmount: number;
  maxAmount: number;
  minTenorMonths: number;
  maxTenorMonths: number;
  interestRateMin: number;
  interestRateMax: number;
  processingFeePct: number;
  collateralRequired: boolean;
  collateralTypes: string[];
  minBusinessAgeMonths: number;
  minMonthlyRevenue: number;
  maxDebtToRevenue: number;
  requiresBankStatements: boolean;
  requiredDocs: string[];
  sectorFit: string[];
  renewalAllowed: boolean;
}

export const CATALOG_PROVIDERS: CatalogProvider[] = [
  { name: 'Northfield Capital', providerType: 'NBFI', riskAppetite: 0.6, baseRate: 13 },
  { name: 'Padma Bank SME', providerType: 'BANK', riskAppetite: 0.4, baseRate: 11 },
  { name: 'QuickLedger Finance', providerType: 'DIGITAL_FINANCIER', riskAppetite: 0.8, baseRate: 16 },
  { name: 'Delta Factoring Ltd', providerType: 'DFO', riskAppetite: 0.7, baseRate: 15 },
  { name: 'Gram Unnayan Cooperative', providerType: 'COOPERATIVE', riskAppetite: 0.5, baseRate: 12 },
  { name: 'Sonali Gold Finance', providerType: 'GOLD_LENDER', riskAppetite: 0.5, baseRate: 14 },
  { name: 'MerchantCash BD', providerType: 'MCA', riskAppetite: 0.9, baseRate: 20 },
];

const DOCS = ['Last 3 months sales data', 'KYC of proprietor', 'Trade licence'];
export const CATALOG_PRODUCTS: CatalogProduct[] = [
  { providerName: 'Padma Bank SME', name: 'SME Term Loan – 24m', productType: 'TERM_LOAN', description: 'General-purpose term loan for established shops with bank history.', minAmount: 100000, maxAmount: 2000000, minTenorMonths: 6, maxTenorMonths: 24, interestRateMin: 11, interestRateMax: 16, processingFeePct: 1, collateralRequired: true, collateralTypes: ['INVENTORY', 'LAND'], minBusinessAgeMonths: 12, minMonthlyRevenue: 150000, maxDebtToRevenue: 0.4, requiresBankStatements: true, requiredDocs: [...DOCS, '12 months bank statements'], sectorFit: ['*'], renewalAllowed: false },
  { providerName: 'Northfield Capital', name: 'Working Capital – 90 day', productType: 'WORKING_CAPITAL', description: 'Short working-capital line to bridge stock purchases and receivables.', minAmount: 50000, maxAmount: 1000000, minTenorMonths: 3, maxTenorMonths: 12, interestRateMin: 13, interestRateMax: 19, processingFeePct: 1.5, collateralRequired: false, collateralTypes: [], minBusinessAgeMonths: 6, minMonthlyRevenue: 80000, maxDebtToRevenue: 0.5, requiresBankStatements: true, requiredDocs: DOCS, sectorFit: ['*'], renewalAllowed: true },
  { providerName: 'QuickLedger Finance', name: 'Instant Stock Finance', productType: 'WORKING_CAPITAL', description: 'Fast digital stock finance scored on sales history, minimal paperwork.', minAmount: 20000, maxAmount: 500000, minTenorMonths: 2, maxTenorMonths: 9, interestRateMin: 16, interestRateMax: 24, processingFeePct: 2, collateralRequired: false, collateralTypes: [], minBusinessAgeMonths: 3, minMonthlyRevenue: 40000, maxDebtToRevenue: 0.6, requiresBankStatements: false, requiredDocs: ['KYC of proprietor', 'Trade licence'], sectorFit: ['*'], renewalAllowed: true },
  { providerName: 'Delta Factoring Ltd', name: 'Invoice Discounting – 30/60', productType: 'INVOICE_DISCOUNTING', description: 'Advance against unpaid B2B invoices from known buyers.', minAmount: 30000, maxAmount: 1500000, minTenorMonths: 1, maxTenorMonths: 4, interestRateMin: 15, interestRateMax: 21, processingFeePct: 1.5, collateralRequired: true, collateralTypes: ['RECEIVABLES'], minBusinessAgeMonths: 6, minMonthlyRevenue: 60000, maxDebtToRevenue: 0.5, requiresBankStatements: false, requiredDocs: ['Outstanding invoices', 'KYC of proprietor'], sectorFit: ['*'], renewalAllowed: true },
  { providerName: 'Delta Factoring Ltd', name: 'Receivables Financing Plus', productType: 'INVOICE_FINANCING', description: 'Financing secured on the whole receivables ledger with buyer-level checks.', minAmount: 50000, maxAmount: 1000000, minTenorMonths: 2, maxTenorMonths: 6, interestRateMin: 14, interestRateMax: 20, processingFeePct: 1, collateralRequired: true, collateralTypes: ['RECEIVABLES'], minBusinessAgeMonths: 9, minMonthlyRevenue: 100000, maxDebtToRevenue: 0.45, requiresBankStatements: true, requiredDocs: [...DOCS, 'Receivables aging report'], sectorFit: ['*'], renewalAllowed: true },
  { providerName: 'Northfield Capital', name: 'Equipment Lease – Machinery', productType: 'EQUIPMENT_LEASE', description: 'Lease for freezers, ovens, POS and light machinery; asset is the security.', minAmount: 80000, maxAmount: 1500000, minTenorMonths: 12, maxTenorMonths: 36, interestRateMin: 12, interestRateMax: 17, processingFeePct: 1, collateralRequired: true, collateralTypes: ['EQUIPMENT'], minBusinessAgeMonths: 12, minMonthlyRevenue: 120000, maxDebtToRevenue: 0.4, requiresBankStatements: true, requiredDocs: [...DOCS, 'Equipment quotation'], sectorFit: ['*'], renewalAllowed: false },
  { providerName: 'Gram Unnayan Cooperative', name: 'MUDRA-style Micro Loan', productType: 'MUDRA_MICRO', description: 'Small-ticket micro enterprise loan for very small shops.', minAmount: 10000, maxAmount: 200000, minTenorMonths: 6, maxTenorMonths: 18, interestRateMin: 12, interestRateMax: 18, processingFeePct: 0.5, collateralRequired: false, collateralTypes: [], minBusinessAgeMonths: 3, minMonthlyRevenue: 25000, maxDebtToRevenue: 0.6, requiresBankStatements: false, requiredDocs: ['KYC of proprietor', 'Trade licence'], sectorFit: ['*'], renewalAllowed: true },
  { providerName: 'Gram Unnayan Cooperative', name: 'Micro Enterprise Growth', productType: 'MICRO_FINANCE', description: 'Group-lending backed micro finance for rural and peri-urban traders.', minAmount: 15000, maxAmount: 300000, minTenorMonths: 6, maxTenorMonths: 24, interestRateMin: 13, interestRateMax: 20, processingFeePct: 1, collateralRequired: false, collateralTypes: [], minBusinessAgeMonths: 6, minMonthlyRevenue: 30000, maxDebtToRevenue: 0.55, requiresBankStatements: false, requiredDocs: ['KYC of proprietor'], sectorFit: ['*'], renewalAllowed: true },
  { providerName: 'MerchantCash BD', name: 'Merchant Cash Advance', productType: 'TERM_LOAN', description: 'Advance repaid from daily sales; fastest approval, highest cost.', minAmount: 25000, maxAmount: 600000, minTenorMonths: 2, maxTenorMonths: 8, interestRateMin: 20, interestRateMax: 30, processingFeePct: 3, collateralRequired: false, collateralTypes: [], minBusinessAgeMonths: 2, minMonthlyRevenue: 50000, maxDebtToRevenue: 0.7, requiresBankStatements: false, requiredDocs: ['KYC of proprietor', 'Last 3 months sales data'], sectorFit: ['*'], renewalAllowed: true },
  { providerName: 'Padma Bank SME', name: 'Trade Credit Line', productType: 'TRADE_CREDIT', description: 'Revolving line for supplier payments with 45-day interest-free window.', minAmount: 60000, maxAmount: 800000, minTenorMonths: 3, maxTenorMonths: 12, interestRateMin: 11, interestRateMax: 15, processingFeePct: 0.75, collateralRequired: false, collateralTypes: [], minBusinessAgeMonths: 12, minMonthlyRevenue: 130000, maxDebtToRevenue: 0.35, requiresBankStatements: true, requiredDocs: [...DOCS, 'Supplier list'], sectorFit: ['*'], renewalAllowed: true },
  { providerName: 'Sonali Gold Finance', name: 'Gold-backed Loan', productType: 'GOLD_LOAN', description: 'Secured loan against gold ornaments with same-day disbursement.', minAmount: 20000, maxAmount: 1000000, minTenorMonths: 3, maxTenorMonths: 12, interestRateMin: 14, interestRateMax: 19, processingFeePct: 1, collateralRequired: true, collateralTypes: ['GOLD'], minBusinessAgeMonths: 0, minMonthlyRevenue: 0, maxDebtToRevenue: 0.8, requiresBankStatements: false, requiredDocs: ['KYC of proprietor', 'Gold valuation certificate'], sectorFit: ['*'], renewalAllowed: true },
  { providerName: 'QuickLedger Finance', name: 'Revolving Credit – Sales-linked', productType: 'REVOLVING_CREDIT', description: 'Draw-as-needed revolving credit linked to daily sales collections.', minAmount: 30000, maxAmount: 700000, minTenorMonths: 3, maxTenorMonths: 12, interestRateMin: 15, interestRateMax: 22, processingFeePct: 1.5, collateralRequired: false, collateralTypes: [], minBusinessAgeMonths: 4, minMonthlyRevenue: 60000, maxDebtToRevenue: 0.55, requiresBankStatements: false, requiredDocs: ['KYC of proprietor', 'Trade licence'], sectorFit: ['*'], renewalAllowed: true },
];

export const DEFAULT_POLICIES = [
  { agentType: 'LENDER_AGENT', name: 'Lender — balanced risk', objective: 'Maximise risk-adjusted spread within exposure caps.', riskAppetite: 0.6, maxExposure: 5000000, minMargin: 2, bufferTargetDays: null as number | null, config: { maxRounds: 3 } },
  { agentType: 'BORROWER_AGENT', name: "Borrower's advocate — cost minimiser", objective: 'Minimise effective cost of capital subject to cash-flow feasibility.', riskAppetite: 0.4, maxExposure: null as number | null, minMargin: null as number | null, bufferTargetDays: null, config: { maxInstallmentShareOfFcf: 0.35, maxRounds: 3 } },
  { agentType: 'TREASURER_AGENT', name: 'Treasurer — 14-day buffer', objective: 'Keep buffer ≥ target, earn yield on idle cash, avoid emergency funding.', riskAppetite: 0.3, maxExposure: 500000, minMargin: null, bufferTargetDays: 14, config: { annualYieldPct: 8, allowedActions: ['SWEEP_IDLE_CASH', 'COLLECT_DEBT', 'DEFER_OUTFLOW', 'RENEGOTIATE_SUPPLIER', 'RELEASE_RESERVE', 'HOLD_CASH', 'ESCALATE'] } },
  { agentType: 'ANALYST_AGENT', name: 'Analyst — release trapped capital', objective: 'Find and release trapped capital; kill margin leaks.', riskAppetite: 0.5, maxExposure: null, minMargin: null, bufferTargetDays: null, config: { verificationResidualPct: 10 } },
];

/** Minimal structural client so this works with Prisma and with test fakes. */
export interface CatalogClient {
  financeProvider: {
    upsert: (args: unknown) => Promise<{ id: string; name: string }>;
    findMany: (args?: unknown) => Promise<Array<{ id: string; name: string }>>;
  };
  financeProduct: {
    upsert: (args: unknown) => Promise<unknown>;
    count: (args?: unknown) => Promise<number>;
  };
  aiAgentPolicy: { upsert: (args: unknown) => Promise<unknown>; count: (args?: unknown) => Promise<number> };
}

export async function ensureCatalog(db: CatalogClient): Promise<{ providers: number; products: number }> {
  const providerIds = new Map<string, string>();
  for (const p of CATALOG_PROVIDERS) {
    const row = await db.financeProvider.upsert({
      where: { id: `catalog-provider-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` },
      update: { riskAppetite: p.riskAppetite, baseRate: p.baseRate, isActive: true },
      create: {
        id: `catalog-provider-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: p.name,
        providerType: p.providerType,
        country: 'BD',
        riskAppetite: p.riskAppetite,
        baseRate: p.baseRate,
      },
    });
    providerIds.set(p.name, row.id);
  }
  // If providers already existed under generated ids, resolve by name.
  if (providerIds.size < CATALOG_PROVIDERS.length) {
    const all = await db.financeProvider.findMany();
    for (const r of all) providerIds.set(r.name, r.id);
  }
  let products = 0;
  for (const p of CATALOG_PRODUCTS) {
    const providerID = providerIds.get(p.providerName);
    if (!providerID) continue;
    const id = `catalog-product-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const data = { ...p, providerID, requiresGSTIN: false, eligibilityRules: undefined };
    delete (data as Record<string, unknown>).providerName;
    await db.financeProduct.upsert({
      where: { id },
      update: { ...data, providerID, isActive: true },
      create: { id, ...data, providerID },
    });
    products++;
  }
  return { providers: providerIds.size, products };
}

export async function ensureDefaultPolicies(db: CatalogClient): Promise<void> {
  for (const p of DEFAULT_POLICIES) {
    const id = `policy-${p.agentType.toLowerCase().replace(/_/g, '-')}`;
    await db.aiAgentPolicy.upsert({
      where: { id },
      update: { isActive: true },
      create: {
        id,
        agentType: p.agentType,
        name: p.name,
        objective: p.objective,
        riskAppetite: p.riskAppetite,
        maxExposure: p.maxExposure,
        minMargin: p.minMargin,
        bufferTargetDays: p.bufferTargetDays,
        config: p.config,
      },
    });
  }
}
