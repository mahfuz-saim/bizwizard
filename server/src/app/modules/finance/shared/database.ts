import { AsyncLocalStorage } from 'node:async_hooks';
import prisma from '../../../../shared/prisma';
import type { CashTransaction, Prisma } from '@prisma/client';

export type SimulationCashRow = Pick<CashTransaction, 'accountID' | 'direction' | 'amount' | 'category' | 'occurredAt' | 'status'>;
type SimulationContext = {
  client: Prisma.TransactionClient;
  asOf: Date;
  cashLedger?: { tenantID: string; shopID: string; rows: SimulationCashRow[] };
};
export const simulationContext = new AsyncLocalStorage<SimulationContext>();

export function simulationCashRows(tenantID: string, shopID: string) {
  const ledger = simulationContext.getStore()?.cashLedger;
  return ledger?.tenantID === tenantID && ledger.shopID === shopID ? ledger.rows : undefined;
}

// Finance work within a simulation must share its transaction and virtual clock.
export default new Proxy(prisma, {
  get(target, key) {
    const client = simulationContext.getStore()?.client ?? target;
    const value = Reflect.get(client, key);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export async function shopClock(tenantID: string, shopID: string): Promise<Date> {
  const active = simulationContext.getStore();
  if (active) return new Date(active.asOf);
  const shop = await prisma.shop.findFirst({
    where: { id: shopID, tenantID }, select: { simulationAsOf: true },
  });
  return shop?.simulationAsOf ?? new Date();
}
