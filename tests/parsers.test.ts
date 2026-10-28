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
describe('storefront (HTML layout 2026-10)', () => {
  const load = (n: string) => readFileSync(`tests/fixtures/store_${n}_mlc_2026-10-28.html`, 'utf8');
  it.each([['samsung', 40], ['lenovo', 20], ['xiaomi', 40]])('parses %s', (slug, min) => {
    const items = parseStorefront(load(slug), parseStore(slug, 'MLC'));
    expect(items.length).toBeGreaterThanOrEqual(min);
    expect(new Set(items.map((i) => i.itemId)).size).toBe(items.length);
    for (const i of items) {
      expect(i.itemId).toMatch(/^MLC\d{6,}$/);
      expect(i.title).toBeTruthy();
      expect(i.price).toBeGreaterThan(0);
      expect(i.currency).toBe('CLP');
      expect(i.url).toMatch(/^https:\/\/[a-z]+\.mercadolibre\.cl\//);
      expect(i.url).not.toContain('#');
      if (i.previousPrice !== null) expect(i.previousPrice).toBeGreaterThan(i.price!);
    }
  });
  it('reads price, previous price, discount, id and seller', () => {
    const tv = parseStorefront(load('samsung'), parseStore('samsung', 'MLC')).find((i) => i.itemId === 'MLC3990917376')!;
    expect(tv).toMatchObject({ title: '48 Oled S85h 4k Samsung Vision Ai Smart Tv (2026)', price: 719990, previousPrice: 1299991, currency: 'CLP', discount: '44% OFF', seller: 'Samsung' });
  });
  it('card without previous price has null previousPrice and discount', () => {
    const items = parseStorefront(load('samsung'), parseStore('samsung', 'MLC'));
    expect(items.find((i) => i.itemId === 'MLC3625281618')).toMatchObject({ price: 199990, previousPrice: null, discount: null });
  });
  it('returns nothing for pages without products', () => {
    expect(parseStorefront('<html><title>Samsung | Tienda Oficial</title><body>nada</body></html>', parseStore('samsung', 'MLC'))).toEqual([]);
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
