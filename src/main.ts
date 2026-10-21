import { Actor, log } from 'apify';
import { gotScraping } from 'crawlee';
import { SITES, parseStore, parseItemId, parseStorefront, parseItemsApi, diff, toSnapshot, kvKey, Snapshot, ItemState, Track, Change } from './parsers.js';

interface Input {
  officialStores?: string[]; sellers?: string[]; items?: string[]; site?: string;
  trackPrice?: boolean; trackDiscount?: boolean; trackStock?: boolean; trackListings?: boolean; trackStatus?: boolean;
  outputBaseline?: boolean; minChangePercent?: number; onlyPriceDrops?: boolean; monitorName?: string; resetBaseline?: boolean;
  mlClientId?: string; mlClientSecret?: string; mlAccessToken?: string; proxyConfiguration?: any;
}

await Actor.init();
const input = (await Actor.getInput<Input>()) ?? {};
let site = String(input.site || 'MLC').trim().toUpperCase();
if (!SITES[site]) { log.warning(`Unsupported site "${site}" (supported: ${Object.keys(SITES).join(', ')}). Using MLC (Chile).`); site = 'MLC'; }
const inputErrors: { type: 'error'; input: string; error: string }[] = [];
const track: Track = { price: input.trackPrice ?? true, discount: input.trackDiscount ?? false, stock: input.trackStock ?? true, listings: input.trackListings ?? true, status: input.trackStatus ?? true };
const monitor = kvKey(input.monitorName?.trim() || 'default');
const now = new Date().toISOString();
const store = await Actor.openKeyValueStore(`ml-monitor-${monitor}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 63));

const arr = (v: any): string[] => (Array.isArray(v) ? v : []).map((x: any) => String(typeof x === 'object' && x ? x.url ?? '' : x ?? '').trim()).filter(Boolean);
const stores = [], itemIds: string[] = [], sellers = arr(input.sellers);
let demo = false;
if (!arr(input.officialStores).length && !arr(input.items).length && !sellers.length) { log.warning('No officialStores, sellers or items given. Running a short demo with the example official store "samsung". Add your own to monitor them.'); input.officialStores = ['samsung']; demo = true; }
for (const s of arr(input.officialStores)) { try { stores.push(parseStore(s, site)); } catch (e) { log.error((e as Error).message); inputErrors.push({ type: 'error', input: s, error: (e as Error).message }); } }
for (const s of arr(input.items)) { try { itemIds.push(parseItemId(s, site)); } catch (e) { log.error((e as Error).message); inputErrors.push({ type: 'error', input: s, error: (e as Error).message }); } }
if (inputErrors.length) await Actor.pushData(inputErrors);
if (!stores.length && !itemIds.length && !sellers.length) { const m = 'None of the given stores/sellers/items could be recognised. Use an official store slug (e.g. "samsung"), a seller nickname/id, or an item URL/id like MLC123456789.'; log.error(m); await Actor.exit({ statusMessage: m }); }

// ---- optional official API token (never logged) ----
let token = input.mlAccessToken?.trim() || undefined;
if (input.mlClientId && input.mlClientSecret) {
  const r = await fetch('https://api.mercadolibre.com/oauth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: input.mlClientId.trim(), client_secret: input.mlClientSecret.trim() }).toString() });
  const j: any = await r.json().catch(() => ({}));
  if (j.access_token) { token = j.access_token; log.info('Got Mercado Libre API token.'); } else log.error(`Mercado Libre OAuth failed (HTTP ${r.status}: ${j.error ?? 'unknown'}). Check mlClientId / mlClientSecret.`);
}
const api = async (url: string) => {
  const r = await fetch(url, { headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  return { status: r.status, json: await r.json().catch(() => null) as any };
};

const proxy = input.proxyConfiguration?.useApifyProxy || input.proxyConfiguration?.proxyUrls?.length ? await Actor.createProxyConfiguration(input.proxyConfiguration) : undefined;
async function getHtml(url: string): Promise<string> {
  let last = '';
  for (let a = 0; a < 4; a++) {
    try {
      const r: any = await gotScraping({ url, proxyUrl: await proxy?.newUrl(), timeout: { request: 45000 }, headerGeneratorOptions: { browsers: ['chrome'], devices: ['desktop'], locales: ['es-CL', 'es'] } } as any);
      if (/account-verification|suspicious-traffic|tiendas-oficiales\/?$/.test(r.url)) {
        if (/tiendas-oficiales/.test(r.url)) throw new Error(`Store not found (redirected to the official stores list). Check the slug in ${url}.`);
        last = 'blocked by anti-bot page'; continue;
      }
      if (r.statusCode >= 400) { last = `HTTP ${r.statusCode}`; continue; }
      return r.body;
    } catch (e) { if (/Store not found/.test((e as Error).message)) throw e; last = (e as Error).message; }
  }
  throw new Error(`Could not fetch ${url}: ${last}`);
}

interface Source { key: string; label: string; siteId: string; fetch: () => Promise<{ items: ItemState[]; complete: boolean }> }
const sources: Source[] = [];
for (const st of stores) sources.push({ key: `store_${st.siteId}_${st.slug}`, label: `store:${st.siteId}:${st.slug}`, siteId: st.siteId, fetch: async () => {
  const items = parseStorefront(await getHtml(st.url), st);
  if (!items.length) throw new Error(`No products found on ${st.url} (layout change or not an official store).`);
  return { items, complete: true };
} });
if (itemIds.length) sources.push({ key: `items_${site}`, label: 'items', siteId: site, fetch: async () => {
  if (!token) throw new Error('Tracking individual listings needs Mercado Libre API credentials (mlClientId + mlClientSecret, or mlAccessToken): listing pages are behind a login wall.');
  const out: ItemState[] = []; let complete = true;
  for (let i = 0; i < itemIds.length; i += 20) {
    const { status, json } = await api(`https://api.mercadolibre.com/items?ids=${itemIds.slice(i, i + 20).join(',')}&attributes=id,title,price,original_price,currency_id,available_quantity,status,permalink`);
    if (status !== 200) { complete = false; log.error(`/items HTTP ${status}`); continue; }
    out.push(...parseItemsApi(json));
    for (const r of json) if (r?.code === 404) out.push({ itemId: r.body?.id ?? 'unknown', title: null, price: null, previousPrice: null, currency: null, discount: null, availableQuantity: null, status: 'not_found', url: null });
  }
  if (!out.length && !complete) throw new Error('Mercado Libre /items API refused every request (HTTP 403). Your app needs item-read access (or a user OAuth token).');
  return { items: out, complete };
} });
for (const s of sellers) sources.push({ key: `seller_${site}_${kvKey(s)}`, label: `seller:${s}`, siteId: site, fetch: async () => {
  const q = /^\d+$/.test(s) ? `seller_id=${s}` : `nickname=${encodeURIComponent(s)}`;
  const out: ItemState[] = []; let total = Infinity;
  for (let off = 0; off < Math.min(total, 1000); off += 50) {
    const { status, json } = await api(`https://api.mercadolibre.com/sites/${site}/search?${q}&offset=${off}&limit=50`);
    if (status !== 200) throw new Error(`Seller search HTTP ${status}. Mercado Libre restricted public seller search in 2025; tip: if the seller is an official store use "officialStores" instead.`);
    total = json.paging?.total ?? 0;
    for (const r of json.results ?? []) out.push({ itemId: r.id, title: r.title ?? null, price: r.price ?? null, previousPrice: r.original_price ?? null, currency: r.currency_id ?? null, discount: null, availableQuantity: r.available_quantity ?? null, status: 'active', url: r.permalink ?? null });
    if (!json.results?.length) break;
  }
  return { items: out, complete: total <= 1000 };
} });

let tracked = 0, changes = 0, failed = 0;
const summary: any[] = [];
for (const src of sources) {
  try {
    const prevRec = input.resetBaseline ? null : await store.getValue<{ at: string; items: Snapshot }>(src.key);
    const { items, complete } = await src.fetch();
    const ch: Change[] = diff(prevRec?.items ?? null, items, track, { source: src.label, siteId: src.siteId, now, prevAt: prevRec?.at ?? null, complete });
    const isBaseline = !prevRec;
    const minPct = Math.abs(input.minChangePercent ?? 0);
    const keep = (c: Change) => c.changeType !== 'PRICE_CHANGE' || ((c.changePercent === null || Math.abs(c.changePercent) >= minPct) && (!input.onlyPriceDrops || (c.changePercent ?? 0) < 0));
    ch.splice(0, ch.length, ...ch.filter(keep));
    if (isBaseline) { if (input.outputBaseline) await Actor.pushData(ch); } // baseline rows are free
    else if (ch.length) { await Actor.pushData(ch, 'change-detected'); changes += ch.length; } // charged per change (pay-per-event)
    // Keep items that vanished in a partial fetch so they are not reported as new next time.
    const merged = complete ? toSnapshot(items) : { ...(prevRec?.items ?? {}), ...toSnapshot(items) };
    await store.setValue(src.key, { at: now, items: merged });
    tracked += items.length;
    summary.push({ source: src.label, tracked: items.length, baseline: isBaseline, changes: isBaseline ? 0 : ch.length });
    log.info(`${src.label}: ${items.length} listings, ${isBaseline ? 'baseline saved' : `${ch.length} changes`}.`);
  } catch (e) { failed++; summary.push({ source: src.label, error: (e as Error).message }); log.error(`${src.label}: ${(e as Error).message}`); }
}
await Actor.setValue('OUTPUT', { checkedAt: now, monitorName: monitor, trackedListings: tracked, changesDetected: changes, sources: summary });
if (failed === sources.length) await Actor.exit({ statusMessage: 'No source could be fetched (blocked, not found or layout change). See the log and the error rows; try again later or with a RESIDENTIAL proxy.' });
else await Actor.exit(`${demo ? 'Demo: ' : ''}Tracked ${tracked} listings, ${changes} changes.`);
