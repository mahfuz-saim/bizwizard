-- SME Finance Copilot: additive migration (all new tables; no existing table is altered).
-- Generated to match prisma/schema.prisma; regenerate authoritatively with:
--   npm run prisma:migrate -- --name finance_copilot

CREATE TYPE "FinanceProviderType" AS ENUM ('BANK', 'NBFI', 'MCA', 'DFO', 'DIGITAL_FINANCIER', 'COOPERATIVE', 'GOLD_LENDER');
CREATE TYPE "FinanceProductType" AS ENUM ('TERM_LOAN', 'WORKING_CAPITAL', 'INVOICE_FINANCING', 'INVOICE_DISCOUNTING', 'EQUIPMENT_LEASE', 'MICRO_FINANCE', 'TRADE_CREDIT', 'GOLD_LOAN', 'REVOLVING_CREDIT', 'MUDRA_MICRO');
CREATE TYPE "EligibilityStatus" AS ENUM ('ELIGIBLE', 'NEAR_MISS', 'INELIGIBLE');
CREATE TYPE "OfferIssuedBy" AS ENUM ('AI_AGENT', 'HUMAN');
CREATE TYPE "FinancingOfferStatus" AS ENUM ('DRAFT', 'ISSUED', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');
CREATE TYPE "NegotiationParty" AS ENUM ('LENDER_AGENT', 'BORROWER_AGENT', 'OWNER');
CREATE TYPE "FinancingApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSED', 'REPAID', 'DEFAULTED');
CREATE TYPE "LoanInstallmentStatus" AS ENUM ('DUE', 'PAID', 'PARTIAL', 'OVERDUE');
CREATE TYPE "CashAccountType" AS ENUM ('CASH', 'BANK', 'EWALLET', 'CARD', 'CREDIT_LINE');
CREATE TYPE "CashDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "CashCategory" AS ENUM ('SALES_COLLECTION', 'INVOICE_PAYMENT', 'PRODUCT_PURCHASE', 'OPERATING_EXPENSE', 'SALARY', 'RENT', 'UTILITY', 'TAX', 'LOAN_REPAYMENT', 'LOAN_DISBURSEMENT', 'FINANCING_FEE', 'OWNER_DRAWING', 'TRANSFER', 'OTHER');
CREATE TYPE "CashTransactionSource" AS ENUM ('MANUAL', 'SALE', 'PURCHASE', 'EXPENSE', 'DEBT_PAYMENT', 'LOAN', 'TRANSFER', 'AI_SUGGESTED', 'BACKFILL');
CREATE TYPE "CashTransactionStatus" AS ENUM ('PENDING', 'CLEARED');
CREATE TYPE "CommitmentRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
CREATE TYPE "CommitmentSource" AS ENUM ('MANUAL', 'IMPORTED_FROM_NOTE', 'AI_EXTRACTED', 'DERIVED_FROM_RECURRING');
CREATE TYPE "ProjectionMethod" AS ENUM ('STATISTICAL', 'STATISTICAL_AI_ADJUSTED');
CREATE TYPE "CashAlertType" AS ENUM ('SHORTFALL_PREDICTED', 'BUFFER_BELOW_TARGET', 'DEBT_OVERDUE', 'DEBT_DUE_SOON', 'COMMITMENT_DUE_SOON', 'LARGE_IDLE_CASH', 'REVENUE_DECLINE', 'EXPENSE_SPIKE', 'EXPENSED_SPIKE', 'NO_DATA');
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "CashAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');
CREATE TYPE "TreasuryActionType" AS ENUM ('SWEEP_IDLE_CASH', 'COLLECT_DEBT', 'DEFER_OUTFLOW', 'RENEGOTIATE_SUPPLIER', 'RELEASE_RESERVE', 'HOLD_CASH', 'ESCALATE');
CREATE TYPE "TreasuryActionStatus" AS ENUM ('PROPOSED', 'APPROVED', 'EXECUTED', 'REJECTED', 'SKIPPED', 'RECONCILED');
CREATE TYPE "InsightType" AS ENUM ('ANOMALY', 'MARGIN_LEAK', 'CONCENTRATION_RISK', 'DEBT_RISK', 'EFFICIENCY', 'STRENGTH', 'WORKING_CAPITAL');
CREATE TYPE "InsightSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REFUTED');
CREATE TYPE "InsightStatus" AS ENUM ('NEW', 'READ', 'ACTIONED', 'DISMISSED');
CREATE TYPE "CapitalDecisionType" AS ENUM ('LIQUIDATE_STOCK', 'PUSH_PRODUCT', 'STOP_SERVING_CUSTOMER', 'RENEGOTIATE_SUPPLIER', 'PRICE_CHANGE', 'COLLECT_FAST', 'HOLD');
CREATE TYPE "CapitalDecisionStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'EXECUTING', 'MEASURED');
CREATE TYPE "ScenarioCreatedBy" AS ENUM ('AI', 'OWNER');
CREATE TYPE "ForecastTarget" AS ENUM ('REVENUE', 'NET_CASH_FLOW', 'PROFIT');
CREATE TYPE "AiAgentType" AS ENUM ('LENDER_AGENT', 'BORROWER_AGENT', 'TREASURER_AGENT', 'ANALYST_AGENT');
CREATE TYPE "AiGuardResult" AS ENUM ('PASSED', 'REJECTED_BY_GUARD', 'REJECTED_BY_OWNER', 'NO_GUARD_REQUIRED');
CREATE TYPE "AiDecisionStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'EXECUTED', 'RECONCILED', 'SUPERSEDED');
CREATE TYPE "AiRunStatus" AS ENUM ('SUCCESS', 'SCHEMA_FAIL', 'GUARD_FAIL', 'TIMEOUT', 'RATE_LIMIT');
CREATE TYPE "FinancingMarketStatus" AS ENUM ('OPEN', 'MATCHED', 'CLOSED');
CREATE TYPE "FinancingPurpose" AS ENUM ('WORKING_CAPITAL', 'INVENTORY', 'EXPANSION', 'EQUIPMENT', 'DEBT_CONSOLIDATION', 'EMERGENCY');

CREATE TABLE "finance_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerType" "FinanceProviderType" NOT NULL,
    "logoUrl" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BD',
    "riskAppetite" DOUBLE PRECISION NOT NULL,
    "baseRate" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "finance_providers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "finance_products" (
    "id" TEXT NOT NULL,
    "providerID" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productType" "FinanceProductType" NOT NULL,
    "description" TEXT NOT NULL,
    "minAmount" DOUBLE PRECISION NOT NULL,
    "maxAmount" DOUBLE PRECISION NOT NULL,
    "minTenorMonths" INTEGER NOT NULL,
    "maxTenorMonths" INTEGER NOT NULL,
    "interestRateMin" DOUBLE PRECISION NOT NULL,
    "interestRateMax" DOUBLE PRECISION NOT NULL,
    "processingFeePct" DOUBLE PRECISION NOT NULL,
    "collateralRequired" BOOLEAN NOT NULL,
    "collateralTypes" TEXT[] NOT NULL,
    "minBusinessAgeMonths" INTEGER NOT NULL,
    "minMonthlyRevenue" DOUBLE PRECISION NOT NULL,
    "maxDebtToRevenue" DOUBLE PRECISION NOT NULL,
    "requiresGSTIN" BOOLEAN NOT NULL DEFAULT false,
    "requiresBankStatements" BOOLEAN NOT NULL DEFAULT false,
    "requiredDocs" TEXT[] NOT NULL,
    "eligibilityRules" JSONB,
    "sectorFit" TEXT[] NOT NULL,
    "renewalAllowed" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "finance_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_financial_profiles" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "cogs" DOUBLE PRECISION NOT NULL,
    "grossProfit" DOUBLE PRECISION NOT NULL,
    "grossMargin" DOUBLE PRECISION NOT NULL,
    "opex" DOUBLE PRECISION NOT NULL,
    "ebitda" DOUBLE PRECISION NOT NULL,
    "netProfit" DOUBLE PRECISION NOT NULL,
    "burnRate" DOUBLE PRECISION NOT NULL,
    "avgDailyRevenue" DOUBLE PRECISION NOT NULL,
    "avgDailySpend" DOUBLE PRECISION NOT NULL,
    "currentCash" DOUBLE PRECISION NOT NULL,
    "receivables" DOUBLE PRECISION NOT NULL,
    "payables" DOUBLE PRECISION NOT NULL,
    "inventoryValue" DOUBLE PRECISION NOT NULL,
    "dso" DOUBLE PRECISION NOT NULL,
    "dio" DOUBLE PRECISION NOT NULL,
    "dpo" DOUBLE PRECISION NOT NULL,
    "cashConversionCycle" DOUBLE PRECISION NOT NULL,
    "debtOutstanding" DOUBLE PRECISION NOT NULL,
    "debtToRevenue" DOUBLE PRECISION NOT NULL,
    "interestCoverage" DOUBLE PRECISION,
    "avgTransactionValue" DOUBLE PRECISION NOT NULL,
    "salesVolatility" DOUBLE PRECISION NOT NULL,
    "businessAgeMonths" INTEGER NOT NULL,
    "dataCompleteness" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_financial_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financing_market_states" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "requestedAmount" DOUBLE PRECISION NOT NULL,
    "purpose" "FinancingPurpose" NOT NULL,
    "preferredTenorMonths" INTEGER,
    "maxRate" DOUBLE PRECISION,
    "maxCollateral" DOUBLE PRECISION,
    "status" "FinancingMarketStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "financing_market_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financing_matches" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "profileID" TEXT NOT NULL,
    "financeProductID" TEXT NOT NULL,
    "eligibilityStatus" "EligibilityStatus" NOT NULL,
    "failedRules" TEXT[] NOT NULL,
    "deterministicScore" DOUBLE PRECISION NOT NULL,
    "aiScore" DOUBLE PRECISION,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "aiRationale" TEXT NOT NULL,
    "aiTradeoffs" TEXT[] NOT NULL,
    "aiConfidence" DOUBLE PRECISION NOT NULL,
    "aiModel" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "maxAffordableAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financing_matches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financing_offers" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "financeProductID" TEXT NOT NULL,
    "providerID" TEXT NOT NULL,
    "offeredAmount" DOUBLE PRECISION NOT NULL,
    "offeredRate" DOUBLE PRECISION NOT NULL,
    "tenorMonths" INTEGER NOT NULL,
    "advanceRate" DOUBLE PRECISION NOT NULL,
    "effectiveApr" DOUBLE PRECISION NOT NULL,
    "totalRepayment" DOUBLE PRECISION NOT NULL,
    "collateralRequired" BOOLEAN NOT NULL,
    "collateralTypes" TEXT[] NOT NULL,
    "conditions" TEXT[] NOT NULL,
    "rationale" TEXT NOT NULL,
    "issuedBy" "OfferIssuedBy" NOT NULL,
    "status" "FinancingOfferStatus" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "aiModel" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "financing_offers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financing_negotiations" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "offerID" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "fromParty" "NegotiationParty" NOT NULL,
    "toParty" "NegotiationParty" NOT NULL,
    "proposedAmount" DOUBLE PRECISION NOT NULL,
    "proposedRate" DOUBLE PRECISION NOT NULL,
    "proposedTenorMonths" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financing_negotiations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financing_applications" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "financeProductID" TEXT NOT NULL,
    "offerID" TEXT NOT NULL,
    "requestedAmount" DOUBLE PRECISION NOT NULL,
    "requestedTenorMonths" INTEGER NOT NULL,
    "status" "FinancingApplicationStatus" NOT NULL,
    "submittedDocs" TEXT[] NOT NULL,
    "ownerApproved" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "firstRepaymentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "financing_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "loan_schedules" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "applicationID" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "principalDue" DOUBLE PRECISION NOT NULL,
    "interestDue" DOUBLE PRECISION NOT NULL,
    "totalDue" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "LoanInstallmentStatus" NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "loan_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_accounts" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "CashAccountType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "openingBalance" DOUBLE PRECISION NOT NULL,
    "currentBalance" DOUBLE PRECISION NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cash_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_transactions" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "accountID" TEXT NOT NULL,
    "direction" "CashDirection" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" "CashCategory" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "source" "CashTransactionSource" NOT NULL,
    "sourceRefID" TEXT,
    "status" "CashTransactionStatus" NOT NULL,
    "aiCategorized" BOOLEAN NOT NULL DEFAULT false,
    "categoryConfidence" DOUBLE PRECISION,
    "isBackfilled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cash_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_commitments" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CashCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "recurrence" "CommitmentRecurrence" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "source" "CommitmentSource" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cash_commitments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_flow_projections" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "horizonDays" INTEGER NOT NULL DEFAULT 90,
    "dailyBuckets" JSONB NOT NULL,
    "expectedInflows" DOUBLE PRECISION NOT NULL,
    "expectedOutflows" DOUBLE PRECISION NOT NULL,
    "closingBalance" DOUBLE PRECISION NOT NULL,
    "minProjectedBalance" DOUBLE PRECISION NOT NULL,
    "troughDate" TIMESTAMP(3),
    "shortfallDate" TIMESTAMP(3),
    "shortfallAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "daysOfBuffer" DOUBLE PRECISION NOT NULL,
    "method" "ProjectionMethod" NOT NULL,
    "aiNarrative" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "model" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_flow_projections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_alerts" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "alertType" "CashAlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "aiNarrative" TEXT,
    "recommendedActions" JSONB,
    "triggerRule" TEXT NOT NULL,
    "metricSnapshot" JSONB NOT NULL,
    "projectedShortfall" DOUBLE PRECISION,
    "status" "CashAlertStatus" NOT NULL,
    "snoozedUntil" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "notificationID" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "treasury_actions" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "agentPolicyID" TEXT NOT NULL,
    "actionType" "TreasuryActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "fromAccountID" TEXT,
    "toAccountID" TEXT,
    "targetRefID" TEXT,
    "expectedDaysToEffect" INTEGER NOT NULL DEFAULT 7,
    "projectedImpact" DOUBLE PRECISION NOT NULL,
    "realizedImpact" DOUBLE PRECISION,
    "status" "TreasuryActionStatus" NOT NULL,
    "requiresOwnerApproval" BOOLEAN NOT NULL DEFAULT true,
    "executedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "treasury_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial_metric_snapshots" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "scope" TEXT,
    "period" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "previousValue" DOUBLE PRECISION,
    "delta" DOUBLE PRECISION,
    "benchmark" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_metric_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "insights" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "insightType" "InsightType" NOT NULL,
    "severity" "InsightSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metricSnapshot" JSONB NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "candidates" JSONB NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL,
    "verifiedMetrics" JSONB,
    "aiConfidence" DOUBLE PRECISION NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" "InsightStatus" NOT NULL,
    "linkedActionID" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "capital_decisions" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "insightID" TEXT,
    "decisionType" "CapitalDecisionType" NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "capitalReleased" DOUBLE PRECISION NOT NULL,
    "projectedProfitImpact" DOUBLE PRECISION NOT NULL,
    "realizedProfitImpact" DOUBLE PRECISION,
    "status" "CapitalDecisionStatus" NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "measuredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "capital_decisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assumptions" JSONB NOT NULL,
    "projected" JSONB NOT NULL,
    "aiRecommendation" TEXT,
    "expectedValue" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "createdBy" "ScenarioCreatedBy" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forecasts" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "target" "ForecastTarget" NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "series" JSONB NOT NULL,
    "method" TEXT NOT NULL,
    "backtestMAPE" DOUBLE PRECISION,
    "aiNarrative" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forecasts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_agent_policies" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT,
    "shopID" TEXT,
    "agentType" "AiAgentType" NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "riskAppetite" DOUBLE PRECISION NOT NULL,
    "maxExposure" DOUBLE PRECISION,
    "minMargin" DOUBLE PRECISION,
    "requiredReturn" DOUBLE PRECISION,
    "bufferTargetDays" INTEGER,
    "budget" DOUBLE PRECISION,
    "config" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_agent_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_decisions" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "agentType" "AiAgentType" NOT NULL,
    "decisionType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "projectedImpact" DOUBLE PRECISION NOT NULL,
    "realizedImpact" DOUBLE PRECISION,
    "guardResult" "AiGuardResult" NOT NULL,
    "guardReason" TEXT,
    "humanOverride" BOOLEAN NOT NULL DEFAULT false,
    "status" "AiDecisionStatus" NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reconciledAt" TIMESTAMP(3),
    CONSTRAINT "ai_decisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_performance" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "agentType" "AiAgentType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "decisionsCount" INTEGER NOT NULL DEFAULT 0,
    "executedCount" INTEGER NOT NULL DEFAULT 0,
    "guardRejects" INTEGER NOT NULL DEFAULT 0,
    "projectedImpactSum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "realizedImpactSum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avoidedShortfallAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "forecastMAPE" DOUBLE PRECISION,
    "offerAcceptanceRate" DOUBLE PRECISION,
    "costSavedVsBaseline" DOUBLE PRECISION,
    "benchmarkImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alpha" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "benchmarkPolicyVersion" TEXT NOT NULL DEFAULT 'pinned-v1',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_performance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_runs" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT,
    "shopID" TEXT,
    "agentType" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "status" "AiRunStatus" NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "finance_products" ADD CONSTRAINT "finance_products_providerID_fkey" FOREIGN KEY ("providerID") REFERENCES "finance_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "business_financial_profiles_shopID_periodEnd_key" ON "business_financial_profiles"("shopID", "periodEnd");
CREATE INDEX "finance_products_providerID_idx" ON "finance_products"("providerID");
CREATE INDEX "finance_products_productType_isActive_idx" ON "finance_products"("productType", "isActive");
CREATE INDEX "business_financial_profiles_tenantID_shopID_idx" ON "business_financial_profiles"("tenantID", "shopID");
CREATE INDEX "financing_market_states_tenantID_shopID_idx" ON "financing_market_states"("tenantID", "shopID");
CREATE INDEX "financing_matches_tenantID_shopID_idx" ON "financing_matches"("tenantID", "shopID");
CREATE INDEX "financing_matches_financeProductID_idx" ON "financing_matches"("financeProductID");
CREATE INDEX "financing_offers_tenantID_shopID_idx" ON "financing_offers"("tenantID", "shopID");
CREATE INDEX "financing_offers_financeProductID_idx" ON "financing_offers"("financeProductID");
CREATE INDEX "financing_negotiations_offerID_idx" ON "financing_negotiations"("offerID");
CREATE INDEX "financing_negotiations_tenantID_shopID_idx" ON "financing_negotiations"("tenantID", "shopID");
CREATE INDEX "financing_applications_tenantID_shopID_idx" ON "financing_applications"("tenantID", "shopID");
CREATE INDEX "financing_applications_offerID_idx" ON "financing_applications"("offerID");
CREATE INDEX "loan_schedules_applicationID_idx" ON "loan_schedules"("applicationID");
CREATE INDEX "loan_schedules_tenantID_shopID_idx" ON "loan_schedules"("tenantID", "shopID");
CREATE INDEX "cash_accounts_tenantID_shopID_idx" ON "cash_accounts"("tenantID", "shopID");
CREATE INDEX "cash_transactions_tenantID_shopID_occurredAt_idx" ON "cash_transactions"("tenantID", "shopID", "occurredAt");
CREATE INDEX "cash_transactions_accountID_idx" ON "cash_transactions"("accountID");
CREATE INDEX "cash_transactions_sourceRefID_idx" ON "cash_transactions"("sourceRefID");
CREATE INDEX "cash_commitments_tenantID_shopID_dueDate_idx" ON "cash_commitments"("tenantID", "shopID", "dueDate");
CREATE INDEX "cash_flow_projections_tenantID_shopID_asOf_idx" ON "cash_flow_projections"("tenantID", "shopID", "asOf");
CREATE INDEX "cash_alerts_tenantID_shopID_status_idx" ON "cash_alerts"("tenantID", "shopID", "status");
CREATE INDEX "treasury_actions_tenantID_shopID_status_idx" ON "treasury_actions"("tenantID", "shopID", "status");
CREATE INDEX "treasury_actions_agentPolicyID_idx" ON "treasury_actions"("agentPolicyID");
CREATE INDEX "financial_metric_snapshots_tenantID_shopID_metricKey_idx" ON "financial_metric_snapshots"("tenantID", "shopID", "metricKey");
CREATE INDEX "insights_tenantID_shopID_verificationStatus_idx" ON "insights"("tenantID", "shopID", "verificationStatus");
CREATE INDEX "capital_decisions_tenantID_shopID_status_idx" ON "capital_decisions"("tenantID", "shopID", "status");
CREATE INDEX "scenarios_tenantID_shopID_idx" ON "scenarios"("tenantID", "shopID");
CREATE INDEX "forecasts_tenantID_shopID_target_idx" ON "forecasts"("tenantID", "shopID", "target");
CREATE INDEX "ai_agent_policies_agentType_isActive_idx" ON "ai_agent_policies"("agentType", "isActive");
CREATE INDEX "ai_agent_policies_tenantID_shopID_idx" ON "ai_agent_policies"("tenantID", "shopID");
CREATE INDEX "ai_decisions_tenantID_shopID_agentType_idx" ON "ai_decisions"("tenantID", "shopID", "agentType");
CREATE INDEX "agent_performance_tenantID_shopID_agentType_idx" ON "agent_performance"("tenantID", "shopID", "agentType");
CREATE INDEX "ai_runs_tenantID_createdAt_idx" ON "ai_runs"("tenantID", "createdAt");
