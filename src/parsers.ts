import * as cheerio from 'cheerio';

export const SITES: Record<string, { domain: string; storePath: string; country: string }> = {
  MLC: { domain: 'www.mercadolibre.cl', storePath: 'tienda', country: 'Chile' },
  MLA: { domain: 'www.mercadolibre.com.ar', storePath: 'tienda', country: 'Argentina' },
  MLM: { domain: 'www.mercadolibre.com.mx', storePath: 'tienda', country: 'México' },
  MLB: { domain: 'www.mercadolivre.com.br', storePath: 'loja', country: 'Brasil' },
  MCO: { domain: 'www.mercadolibre.com.co', storePath: 'tienda', country: 'Colombia' },
  MLU: { domain: 'www.mercadolibre.com.uy', storePath: 'tienda', country: 'Uruguay' },
  MPE: { domain: 'www.mercadolibre.com.pe', storePath: 'tienda', country: 'Perú' },
  MEC: { domain: 'www.mercadolibre.com.ec', storePath: 'tienda', country: 'Ecuador' },
};

/** One tracked listing in a snapshot. Never contains buyer/personal data. */
export interface ItemState {
  itemId: string; title: string | null; price: number | null; previousPrice: number | null; currency: string | null;
  discount: string | null; availableQuantity: number | null; status: string | null; url: string | null;
  /** Store / seller name when known (storefront pages). */
  seller?: string | null;
}
export type Snapshot = Record<string, ItemState>;
export interface Track { price: boolean; stock: boolean; listings: boolean; status: boolean; discount: boolean }

export type ChangeType = 'BASELINE' | 'NEW_LISTING' | 'REMOVED_LISTING' | 'PRICE_CHANGE' | 'DISCOUNT_CHANGE' | 'STOCK_CHANGE' | 'STATUS_CHANGE';
export interface Change {
  changeType: ChangeType; itemId: string; title: string | null; field: string | null;
  oldValue: string | number | null; newValue: string | number | null; changePercent: number | null; currency: string | null;
  source: string; siteId: string; url: string | null; seller?: string | null; detectedAt: string; previousCheckAt: string | null;
}

export interface StoreRef { siteId: string; slug: string; url: string }
/** Official store slug ("samsung") or URL (https://www.mercadolibre.cl/tienda/samsung). */
export function parseStore(input: string, defaultSite: string): StoreRef {
  const s = input.trim();
  const m = s.match(/^https?:\/\/(?:www\.)?([^/]+)\/(?:tienda|loja)\/([^/?#]+)/i);
  if (m) {
    const site = Object.entries(SITES).find(([, v]) => v.domain.replace(/^www\./, '') === m[1].toLowerCase().replace(/^www\./, ''));
    if (!site) throw new Error(`Unknown Mercado Libre domain in "${s}".`);
    return { siteId: site[0], slug: m[2].toLowerCase(), url: `https://${site[1].domain}/${site[1].storePath}/${m[2].toLowerCase()}` };
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(s)) throw new Error(`"${s}" is not a valid official store slug or store URL.`);
  const site = SITES[defaultSite];
  if (!site) throw new Error(`Unsupported site "${defaultSite}". Supported: ${Object.keys(SITES).join(', ')}`);
  return { siteId: defaultSite, slug: s.toLowerCase(), url: `https://${site.domain}/${site.storePath}/${s.toLowerCase()}` };
}

/** Item URL (MLC-123..., ?item_id=MLC123, /p/...?pdp_filters=item_id:MLC123) or raw id. */
export function parseItemId(input: string, defaultSite: string): string {
  const s = decodeURIComponent(input.trim());
  let m = s.match(/item_id[:=]([A-Z]{3})(\d{6,})/i);
  if (m) return m[1].toUpperCase() + m[2];
  if (/\/p\/[A-Z]{3}\d+/i.test(s)) throw new Error(`"${input}" is a catalog product page, not a listing. Open a specific seller's listing or add ?pdp_filters=item_id:...`);
  m = s.match(/\b([A-Z]{3})-?(\d{8,})\b/i);
  if (m) return m[1].toUpperCase() + m[2];
  m = s.match(/^(\d{8,})$/);
  if (m) return defaultSite + m[1];
  throw new Error(`Could not find a listing id in "${input}". Use a listing URL or an id like MLC1234567890 (catalog /p/ URLs need ?pdp_filters=item_id:...).`);
}

function balanced(text: string, start: number): string | null {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

/** Extract every product card from an official-store storefront HTML page (current HTML layout, old embedded-JSON layout as fallback). */
export function parseStorefront(html: string, store: StoreRef): ItemState[] {
  const out = new Map<string, ItemState>();
  for (const it of [...parseStorefrontHtml(html, store), ...parseStorefrontJson(html, store)]) if (!out.has(it.itemId)) out.set(it.itemId, it);
  return [...out.values()];
}

const CURRENCIES: Record<string, string> = { MLC: 'CLP', MLA: 'ARS', MLM: 'MXN', MLB: 'BRL', MCO: 'COP', MLU: 'UYU', MPE: 'PEN', MEC: 'USD' };
/** "1.299.991" / "1.299,50" / "1299991" -> number. Returns null when it is not a number. */
function money(txt: string | undefined | null): number | null {
  if (!txt) return null;
  const t = txt.replace(/[^\d.,]/g, '');
  if (!t) return null;
  const lastComma = t.lastIndexOf(','), lastDot = t.lastIndexOf('.');
  let n: string;
  if (lastComma > lastDot) n = t.replace(/\./g, '').replace(',', '.'); // 1.299,50
  else if (lastDot !== -1 && t.length - lastDot - 1 === 3) n = t.replace(/\./g, ''); // 1.299.991 (thousands)
  else n = t.replace(/,/g, '');
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}
const ariaAmount = (label: string | undefined) => { const m = label?.match(/(\d[\d.,]*)/); return m ? money(m[1]) : null; };

/** Current layout: <a class="poly-component__title" href="...wid=MLC123..."> inside .poly-card__content. */
function parseStorefrontHtml(html: string, store: StoreRef): ItemState[] {
  if (!html.includes('poly-card__content')) return [];
  const $ = cheerio.load(html);
  const seller = ($('title').first().text().split('|')[0] ?? '').trim() || store.slug;
  const currency = CURRENCIES[store.siteId] ?? null;
  const items: ItemState[] = [];
  $('.poly-card__content').each((_, el) => {
    const c = $(el);
    const a = c.find('a.poly-component__title').first();
    const href = (a.attr('href') ?? '').trim();
    const idm = href.match(/[?&#]wid=([A-Z]{3}\d{6,})/i) ?? href.match(/item_id(?:%3A|:|=)([A-Z]{3}\d{6,})/i) ?? href.match(/\b([A-Z]{3})-?(\d{8,})\b/);
    if (!idm) return;
    const itemId = (idm.length === 3 && !/\d{6,}/.test(idm[1]) ? idm[1] + idm[2] : idm[1]).toUpperCase();
    const title = (a.text() || a.attr('title') || '').replace(/\s+/g, ' ').trim() || null;
    const cur = c.find('.poly-price__current .andes-money-amount').first();
    const prev = c.find('.poly-price__previous').first();
    const price = money(cur.find('.andes-money-amount__fraction').first().text()) ?? ariaAmount(cur.attr('aria-label'));
    const prevPrice = prev.length ? money(prev.find('.andes-money-amount__fraction').first().text()) ?? ariaAmount(prev.attr('aria-label')) : null;
    const disc = c.find('.poly-price__disc-label').first().text().replace(/\s+/g, ' ').trim() || null;
    const sym = cur.find('.andes-money-amount__currency-symbol').first().text().trim();
    items.push({
      itemId, title, price, previousPrice: prevPrice, currency: currency ?? (sym === 'US$' ? 'USD' : null), discount: disc,
      availableQuantity: null, status: 'active', url: href ? href.replace(/#.*$/, '').replace(/^http:/, 'https:') : null, seller,
    });
  });
  return items;
}

function parseStorefrontJson(html: string, store: StoreRef): ItemState[] {
  const out = new Map<string, ItemState>();
  const scripts = [...html.matchAll(/_n\.ctx\.s\.q\(("(?:[^"\\]|\\.)*")\)/g)].map((m) => { try { return JSON.parse(m[1]) as string; } catch { return ''; } });
  if (!scripts.length && html.includes('"polycards"')) scripts.push(html);
  for (const text of scripts) {
    let idx = 0;
    while ((idx = text.indexOf('"polycards":[', idx)) !== -1) {
      const arr = balanced(text, idx + '"polycards":'.length);
      idx += 12;
      if (!arr) continue;
      let cards: any[];
      try { cards = JSON.parse(arr.replace(/:\s*u([,}\]])/g, ':null$1')); } catch { continue; }
      for (const c of cards) {
        const id = c?.metadata?.id; if (!id || out.has(id)) continue;
        const comp = (t: string) => (c.components ?? []).find((x: any) => x?.type === t)?.[t];
        const price = comp('price');
        const u = c.metadata.url ? `https://${String(c.metadata.url).replace(/^https?:\/\//, '')}${c.metadata.url_params ?? ''}` : null;
        out.set(id, {
          itemId: id, title: comp('title')?.text ?? null,
          price: num(price?.current_price?.value), previousPrice: num(price?.previous_price?.value),
          currency: price?.current_price?.currency ?? null, discount: price?.discount_label?.text ?? null,
          availableQuantity: null, status: 'active', url: u, seller: store.slug,
        });
      }
    }
  }
  return [...out.values()];
}
const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Official API /items?ids=... multiget body. */
export function parseItemsApi(json: any): ItemState[] {
  if (!Array.isArray(json)) throw new Error('Unexpected /items response (expected an array).');
  return json.filter((r) => r?.code === 200 && r.body?.id).map((r) => ({
    itemId: r.body.id, title: r.body.title ?? null, price: num(r.body.price), previousPrice: num(r.body.original_price),
    currency: r.body.currency_id ?? null, discount: null, availableQuantity: num(r.body.available_quantity),
    status: r.body.status ?? null, url: r.body.permalink ?? null,
  }));
}

export function diff(prev: Snapshot | null, curr: ItemState[], track: Track, ctx: { source: string; siteId: string; now: string; prevAt: string | null; complete: boolean }): Change[] {
  const base = (s: ItemState, t: ChangeType, field: string | null, o: any, n: any, pct: number | null = null): Change => ({
    changeType: t, itemId: s.itemId, title: s.title, field, oldValue: o ?? null, newValue: n ?? null, changePercent: pct, currency: s.currency,
    source: ctx.source, siteId: ctx.siteId, url: s.url, ...(s.seller ? { seller: s.seller } : {}), detectedAt: ctx.now, previousCheckAt: ctx.prevAt,
  });
  if (!prev) return curr.map((s) => base(s, 'BASELINE', null, null, s.price));
  const out: Change[] = [];
  const seen = new Set<string>();
  for (const s of curr) {
    seen.add(s.itemId);
    const p = prev[s.itemId];
    if (!p) { if (track.listings) out.push(base(s, 'NEW_LISTING', null, null, s.price)); continue; }
    if (track.price && s.price !== null && p.price !== null && s.price !== p.price)
      out.push(base(s, 'PRICE_CHANGE', 'price', p.price, s.price, Math.round(((s.price - p.price) / p.price) * 10000) / 100));
    if (track.discount && (s.discount ?? null) !== (p.discount ?? null)) out.push(base(s, 'DISCOUNT_CHANGE', 'discount', p.discount, s.discount));
    if (track.stock && s.availableQuantity !== null && p.availableQuantity !== null && s.availableQuantity !== p.availableQuantity)
      out.push(base(s, 'STOCK_CHANGE', 'availableQuantity', p.availableQuantity, s.availableQuantity));
    if (track.status && s.status && p.status && s.status !== p.status) out.push(base(s, 'STATUS_CHANGE', 'status', p.status, s.status));
  }
  // Only report removals when this source was fetched completely (avoid false alarms after a partial/blocked fetch).
  if (track.listings && ctx.complete) for (const p of Object.values(prev)) if (!seen.has(p.itemId)) out.push(base(p, 'REMOVED_LISTING', null, p.price, null));
  return out;
}

export const toSnapshot = (items: ItemState[]): Snapshot => Object.fromEntries(items.map((i) => [i.itemId, i]));
export const kvKey = (s: string) => s.replace(/[^a-zA-Z0-9!\-_.'()]/g, '_').slice(0, 200);
