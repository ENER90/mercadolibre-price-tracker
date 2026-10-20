import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseStore, parseItemId, parseStorefront, diff, toSnapshot, ItemState } from '../src/parsers.js';
const T = { price: true, discount: true, stock: true, listings: true, status: true };
const ctx = { source: 's', siteId: 'MLC', now: '2026-10-20T00:00:00Z', prevAt: '2026-10-19T00:00:00Z', complete: true };
const it0 = (o: Partial<ItemState>): ItemState => ({ itemId: 'MLC1', title: 't', price: 100, previousPrice: null, currency: 'CLP', discount: null, availableQuantity: 5, status: 'active', url: null, ...o });
describe('inputs', () => {
  it('stores', () => {
    expect(parseStore('samsung', 'MLC').url).toBe('https://www.mercadolibre.cl/tienda/samsung');
    expect(parseStore('https://www.mercadolivre.com.br/loja/samsung', 'MLC')).toMatchObject({ siteId: 'MLB', slug: 'samsung' });
  });
  it('items', () => {
    expect(parseItemId('https://articulo.mercadolibre.cl/MLC-1234567890-tv-_JM', 'MLC')).toBe('MLC1234567890');
    expect(parseItemId('https://www.mercadolibre.cl/x/up/MLCU1?pdp_filters=item_id%3AMLC3990917364', 'MLC')).toBe('MLC3990917364');
    expect(parseItemId('1234567890', 'MLA')).toBe('MLA1234567890');
    expect(() => parseItemId('https://www.mercadolibre.cl/x/p/MLC65503970', 'MLC')).toThrow();
  });
});
describe('storefront', () => {
  it('parses polycards', () => {
    const items = parseStorefront(readFileSync('tests/fixtures/store_samsung_mlc.html', 'utf8'), parseStore('samsung', 'MLC'));
    expect(items.length).toBeGreaterThan(20);
    const tv = items.find((i) => i.itemId === 'MLC3990917376')!;
    expect(tv).toMatchObject({ price: 719990, previousPrice: 1299991, currency: 'CLP', discount: '44% OFF' });
    expect(tv.url).toMatch(/^https:\/\/www\.mercadolibre\.cl\//);
  });
});
describe('diff', () => {
  it('baseline', () => expect(diff(null, [it0({})], T, ctx)[0].changeType).toBe('BASELINE'));
  it('changes', () => {
    const prev = toSnapshot([it0({}), it0({ itemId: 'MLC2' })]);
    const c = diff(prev, [it0({ price: 90, availableQuantity: 4, status: 'paused' }), it0({ itemId: 'MLC3' })], T, ctx);
    expect(c.map((x) => x.changeType).sort()).toEqual(['NEW_LISTING', 'PRICE_CHANGE', 'REMOVED_LISTING', 'STATUS_CHANGE', 'STOCK_CHANGE']);
    expect(c.find((x) => x.changeType === 'PRICE_CHANGE')).toMatchObject({ oldValue: 100, newValue: 90, changePercent: -10 });
  });
  it('no removals on partial fetch', () => expect(diff(toSnapshot([it0({})]), [], T, { ...ctx, complete: false })).toEqual([]));
});
