import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

test('the payment SDK uses patched multipart headers without changing normal fields', () => {
    const paymentRequire = createRequire(require.resolve('sslcommerz-lts'));
    const FormData = paymentRequire('form-data') as new () => {
        append(name: string, value: string): void;
        getBuffer(): Buffer;
    };
    const form = new FormData();
    form.append('store_id', 'test-store');
    form.append('field"\r\nInjected: yes', 'test-value');
    const body = form.getBuffer().toString();
    assert.ok(body.includes('name="store_id"'));
    assert.ok(body.includes('test-store'));
    assert.ok(body.includes('field%22%0D%0AInjected: yes'));
    assert.equal(body.includes('\r\nInjected: yes'), false);
});

test('the Express query parser still handles normal filters after its security update', () => {
    const expressRequire = createRequire(require.resolve('express'));
    const qs = expressRequire('qs') as {
        parse(input: string): unknown;
        stringify(input: unknown, options: Record<string, unknown>): string;
    };
    assert.deepEqual(qs.parse('shopId=test-shop&page=2&filter[status]=OPEN'), {
        shopId: 'test-shop', page: '2', filter: { status: 'OPEN' },
    });
    assert.doesNotThrow(() => qs.stringify({ values: [null, undefined] }, {
        arrayFormat: 'comma', encodeValuesOnly: true,
    }));
});
