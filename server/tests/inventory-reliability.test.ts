import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProductCategory } from '@prisma/client';
import { productZodSchema } from '../src/app/modules/product/product.validation';
import { cashflowValidation } from '../src/app/modules/finance/cashflow/cashflow.validation';

const line = { shopID: 'shop', variantId: 'variant', category: ProductCategory.PERSONAL_CARE_PRODUCTS,
    lot: { stock: 2, buyPrice: 53.35, sellPrice: 60, mrp: 60, retail: 60, isMRPDefault: true, includeVAT: true } };

test('purchase accepts decimal prices, rejects invalid categories, quantities and cross-shop batches', () => {
    const schema = productZodSchema.purchaseValidation;
    assert(schema.safeParse({ body: { lines: [line] } }).success);
    for (const value of [0, -1, 1.5]) assert(!schema.safeParse({ body: { lines: [{ ...line, lot: { ...line.lot, stock: value } }] } }).success);
    assert(!schema.safeParse({ body: { lines: [{ ...line, category: 'Grocery' }] } }).success);
    assert(!schema.safeParse({ body: { lines: [line, { ...line, shopID: 'other' }] } }).success);
    assert(!schema.safeParse({ body: { lines: [] } }).success);
});

test('expiry can be explicitly cleared and variant pricing rejects negative values or unexpected fields', () => {
    assert(productZodSchema.lotUpdateValidation.safeParse({ body: { expDate: null } }).success);
    assert(productZodSchema.updateProductValidation.safeParse({ body: { sellPrice: 53.35, expDate: null } }).success);
    assert(!productZodSchema.updateProductValidation.safeParse({ body: { sellPrice: -1 } }).success);
    assert(!productZodSchema.updateProductValidation.safeParse({ body: { tenantID: 'other' } }).success);
});

test('alert proposals accept only a recommendation index, never caller-invented money or actions', () => {
    const schema = cashflowValidation.alertRecommendation;
    assert(schema.safeParse({ query: { shopId: 'shop' }, body: { actionIndex: 0 } }).success);
    for (const body of [{ actionIndex: -1 }, { actionIndex: 0.5 }, { actionType: 'COLLECT_DEBT', projectedImpact: 999999 }, { actionIndex: 0, amount: 999 }])
        assert(!schema.safeParse({ query: { shopId: 'shop' }, body }).success);
});
