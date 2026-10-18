import prisma from '../../shared/prisma';
import { aiConfig, type AiBudgetGate } from './client';

export const reserveAiBudget: AiBudgetGate = async (tenantID, amount) => {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const key = { tenantID, periodStart };
  const accepted = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`ai-budget:${tenantID}:${periodStart.toISOString()}`}, 0))`;
    const history = await tx.aiRun.aggregate({ where: { tenantID, createdAt: { gte: periodStart } }, _sum: { costUsd: true } });
    await tx.aiBudgetMonth.upsert({ where: { tenantID_periodStart: key }, create: { ...key, spentUsd: history._sum.costUsd ?? 0 }, update: {} });
    const row = await tx.aiBudgetMonth.findUniqueOrThrow({ where: { tenantID_periodStart: key } });
    if (row.spentUsd + row.reservedUsd + amount > aiConfig().monthlyBudgetUsd) return false;
    await tx.aiBudgetMonth.update({ where: { tenantID_periodStart: key }, data: { reservedUsd: { increment: amount } } });
    return true;
  });
  if (!accepted) return null;
  let settled = false;
  return { settle: async actual => {
    if (settled) return;
    await prisma.aiBudgetMonth.update({ where: { tenantID_periodStart: key }, data: { reservedUsd: { decrement: amount }, spentUsd: { increment: actual } } });
    settled = true;
  } };
};
