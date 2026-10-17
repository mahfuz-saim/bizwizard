import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

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
