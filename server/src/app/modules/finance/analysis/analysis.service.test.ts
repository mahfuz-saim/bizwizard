import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import prisma from '../../../../shared/prisma';
import { analysisService } from './analysis.service';

function stub(t: TestContext, target: object, name: string, implementation: (...args: never[]) => unknown) {
  const original = Reflect.get(target, name);
  Reflect.set(target, name, implementation);
  t.after(() => { Reflect.set(target, name, original); });
}

test('product economics sums quantity-weighted revenue and costs across sale lines', async t => {
  stub(t, prisma.shop, 'findFirst', async () => ({ id: 'shop' }));
  stub(t, prisma.checkoutItem, 'findMany', async () => [
    { variantId: 'rice', productName: 'Rice', quantity: 3, discountedPrice: 100, lotId: 'a', createdAt: new Date() },
    { variantId: 'rice', productName: 'Rice', quantity: 1, discountedPrice: 80, lotId: 'b', createdAt: new Date() },
  ]);
  stub(t, prisma.lot, 'findMany', async () => [{ id: 'a', buyPrice: 60 }, { id: 'b', buyPrice: 50 }]);
  stub(t, prisma.shopVariant, 'findMany', async () => []);
  const [result] = await analysisService.getProductEconomics('tenant', 'shop');
  assert.equal(result.revenue, 380);
  assert.equal(result.cogs, 230);
  assert.equal(result.contribution, 150);
});

test('missing-lot cost estimates remain quantity-weighted', async t => {
  stub(t, prisma.shop, 'findFirst', async () => ({ id: 'shop' }));
  stub(t, prisma.checkoutItem, 'findMany', async () => [
    { variantId: 'rice', productName: 'Rice', quantity: 2, discountedPrice: 100, lotId: null, createdAt: new Date() },
  ]);
  stub(t, prisma.shopVariant, 'findMany', async () => []);
  const [result] = await analysisService.getProductEconomics('tenant', 'shop');
  assert.equal(result.revenue, 200);
  assert.equal(result.cogs, 140);
  assert.equal(result.contribution, 60);
});
