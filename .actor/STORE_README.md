# Mercado Libre Price Tracker & Monitor de Precios – Tiendas Oficiales

🇪🇸 **Español** · 🇬🇧 [English](#english)

Monitorea los precios de las **tiendas oficiales de Mercado Libre** y recibe **solo lo que cambió**: bajadas y subidas de precio, precio anterior, descuentos y productos nuevos o eliminados. Chile, Argentina, México, Brasil, Colombia y más. Sin login.

## 💲 Precio y costos

**US$0,002 por cambio detectado** (US$2 por 1.000). La línea base y las ejecuciones sin cambios no cobran eventos.

| Ejemplo | Cambios al mes | Costo aprox. |
|---|---|---|
| 1 tienda, diario (~3 cambios/día) | ~90 | ~US$0,18 |
| 5 tiendas, diario (~10/día) | ~300 | ~US$0,60 |
| 20 tiendas, cada hora (~100/día) | ~3.000 | ~US$6,00 |

## 🎯 Filtros

- `minChangePercent`: ignora los cambios de precio menores a X % (y no se cobran).
- `onlyPriceDrops`: solo bajadas de precio.
- Vista **Price history** en el dataset.

## ⏰ Uso típico: alertas diarias

1. Guarda tu input como **Task** y crea un **Schedule** (por ejemplo, todos los días a las 9:00).
2. En la Task, agrega una **integración**: Slack, email o webhook "Run succeeded".
3. Solo recibes filas cuando algo cambió.

## 🌎 Sitios disponibles

| Código | País | URL de la tienda |
|---|---|---|
| MLC | Chile | mercadolibre.cl/tienda/<slug> |
| MLA | Argentina | mercadolibre.com.ar/tienda/<slug> |
| MLM | México | mercadolibre.com.mx/tienda/<slug> |
| MLB | Brasil | mercadolivre.com.br/loja/<slug> |
| MCO | Colombia | mercadolibre.com.co/tienda/<slug> |
| MLU / MPE / MEC | Uruguay / Perú / Ecuador | …/tienda/<slug> |

## 🔌 Integraciones

- **n8n / Make / Zapier:** nodo oficial de Apify → *Run Actor* `ener90/mercadolibre-seller-price-monitor` → *Get dataset items* → Slack, Sheets o email.
- **Webhook:** integración "Run succeeded" → tu endpoint recibe el `defaultDatasetId` con los cambios.
- **Agentes de IA (MCP):** agrégalo al servidor [Apify MCP](https://mcp.apify.com) y pregunta "¿qué bajó de precio hoy en la tienda Samsung de Mercado Libre Chile?".

## ❓ Preguntas frecuentes

- **¿Cuál es el slug de una tienda?** Lo que va después de `/tienda/` en la URL (por ejemplo `samsung` o `xiaomi`). También puedes pegar la URL completa.
- **¿Monitorea todo el catálogo?** No: monitorea los productos destacados de la vitrina (normalmente entre 20 y 60).
- **¿Y el stock?** Las vitrinas no muestran stock.
- **¿Puedo seguir publicaciones o vendedores sueltos?** Solo con tu propio acceso OAuth a la API de Mercado Libre, y Mercado Libre puede bloquearlo (HTTP 403).
- **¿Dónde se guarda la foto anterior?** En un key-value store con nombre `ml-monitor-<monitorName>` en tu cuenta.
- **¿Datos personales?** Ninguno; solo datos públicos de productos.

## 📖 Cómo funciona en detalle

Vigila las **tiendas oficiales** de Mercado Libre (productos destacados de la vitrina: precio, precio anterior y descuento; **sin stock**) y, en cada ejecución, entrega **solo lo que cambió** desde la anterior: cambios de precio, de descuento, de stock y de estado, y publicaciones nuevas o eliminadas. Prográmalo (Schedules) a diario o cada hora y conéctalo a email, Slack o un webhook.

**Qué puedes vigilar**
- **Tiendas oficiales** (`officialStores`): slug (`samsung`) o URL (`https://www.mercadolibre.cl/tienda/samsung`). Sigue los productos de la vitrina de la tienda. No necesita credenciales.
- **Avanzado – publicaciones (`items`) y vendedores (`sellers`):** requieren **tu propio acceso OAuth** a la API de Mercado Libre (token de usuario o app con permisos). Mercado Libre bloquea estos endpoints para la mayoría de las apps (HTTP 403), así que pueden no funcionar.

**Precio:** pago por evento, **US$0,002 por cambio detectado** (US$2 por 1.000 cambios). La línea base y las ejecuciones sin cambios no cobran eventos.

Sitios disponibles: MLC (Chile), MLA, MLM, MLB, MCO, MLU, MPE y MEC.

**Cómo funciona**
1. La primera ejecución guarda una *línea base* (con `outputBaseline` en true, además la escribe en el dataset).
2. Las siguientes comparan con la foto anterior, guardada en un key-value store con nombre (`ml-monitor-<monitorName>`), y escriben solo los cambios.
3. Si una fuente falla o se lee solo en parte, no se reportan publicaciones como eliminadas. Así se evitan falsas alarmas.

**Salida** (una fila por cambio): `changeType` (PRICE_CHANGE, DISCOUNT_CHANGE, STOCK_CHANGE, STATUS_CHANGE, NEW_LISTING, REMOVED_LISTING, BASELINE), `itemId`, `title`, `field`, `oldValue`, `newValue`, `changePercent`, `currency`, `source`, `url`, `detectedAt` y `previousCheckAt`. El resumen de la ejecución queda en el registro `OUTPUT`.

**Privacidad:** no se recopilan datos personales, solo datos públicos de las publicaciones.

**Limitaciones:** las vitrinas muestran los productos destacados de la tienda (normalmente entre 20 y 60), no el catálogo completo, y no muestran stock. Las páginas de cada publicación y los listados de búsqueda exigen iniciar sesión, por eso para las publicaciones sueltas se usa la API oficial.

## 🔗 Más scrapers de ener90

- [Mercado Libre Reviews & Preguntas Scraper](https://apify.com/ener90/mercadolibre-reviews-questions) – opiniones y preguntas de Mercado Libre
- [TrustRadius Reviews Scraper](https://apify.com/ener90/software-reviews-scraper) – reseñas de software B2B de TrustRadius
- [Walmart Reviews Scraper](https://apify.com/ener90/walmart-products-reviews) – reseñas y productos de Walmart
- [Product Hunt Scraper](https://apify.com/ener90/product-hunt-launches) – lanzamientos diarios de Product Hunt
- Chile Real Estate Scraper (Portal Inmobiliario + TocToc) (`ener90/chile-real-estate-scraper`, próximamente) – propiedades en venta y arriendo en Chile
- AI Review Insights (`ener90/ai-review-insights`, próximamente) – análisis de reseñas con IA

¿Necesitas un scraper a medida u otro sitio? Escríbeme en la pestaña **Issues** (soporte en español).

## 🧩 API e integraciones: inicio rápido

**cURL (síncrono, devuelve los resultados)**
```bash
curl -X POST "https://api.apify.com/v2/acts/ener90~mercadolibre-seller-price-monitor/run-sync-get-dataset-items?token=TU_TOKEN_APIFY" \
  -H "Content-Type: application/json" -d '{"officialStores":["samsung"],"site":"MLC"}'
```

**Node.js**
```js
import { ApifyClient } from 'apify-client';
const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
const run = await client.actor('ener90/mercadolibre-seller-price-monitor').call({"officialStores":["samsung"],"site":"MLC"});
const { items } = await client.dataset(run.defaultDatasetId).listItems();
```

**Python**
```python
from apify_client import ApifyClient
client = ApifyClient("TU_TOKEN_APIFY")
run = client.actor("ener90/mercadolibre-seller-price-monitor").call(run_input={"officialStores":["samsung"],"site":"MLC"})
items = client.dataset(run["defaultDatasetId"]).list_items().items
```

- **Google Sheets:** agrega la integración *Google Sheets* a una Task guardada, o usa `=IMPORTDATA("https://api.apify.com/v2/datasets/<DATASET_ID>/items?format=csv&clean=1")`.
- **n8n / Make / Zapier:** nodo o app oficial de Apify: *Run Actor* (`ener90/mercadolibre-seller-price-monitor`) → *Get dataset items*.
- **Webhooks:** en una Task, agrega la integración *Run succeeded* → tu URL (recibe el `defaultDatasetId`).
- **Agentes de IA (MCP):** `https://mcp.apify.com?actors=ener90/mercadolibre-seller-price-monitor` funciona en Claude, ChatGPT, Cursor o cualquier cliente MCP.
- **Plan gratis:** funciona en el plan gratuito de Apify; se cobra por cambio detectado (ver Precio). Parte con pocas tiendas para probar.

## 📝 Historial de cambios
- 0.1 (2026-10-19): primera versión pública (monitor de tiendas oficiales, pago por cambio detectado).
- 0.1.8 (2026-10-20): nuevos filtros minChangePercent y onlyPriceDrops, vista Price history, memoria por defecto de 256 MB.

¿Problemas o ideas? Abre un issue en la pestaña **Issues**; normalmente respondemos en menos de 24 h.

---

## English

Monitors Mercado Libre **official stores** (storefront featured products: price, previous price, discount; **no stock**). Each run outputs **only what changed** since the previous one: price, discount, stock and status changes, plus new and removed listings. Schedule it daily or hourly and connect it to email, Slack or a webhook.

**Inputs**
- `officialStores`: a slug or a store URL. No credentials needed.
- Advanced: `items` (listing URLs/IDs) and `sellers` (ID/nickname) need **your own Mercado Libre OAuth access**; Mercado Libre blocks these endpoints for most apps (HTTP 403), so they may not work.

**Pricing:** pay-per-event, **US$0.002 per detected change** (US$2 per 1,000 changes). Baseline and no-change runs charge no events.
- `site`, the `track*` toggles, `outputBaseline`, `monitorName`, `resetBaseline` and `proxyConfiguration`.

**How it works:** the first run saves a baseline. Later runs diff against the snapshot stored in the named key-value store `ml-monitor-<monitorName>` and push only the changes. Removals are reported only after a complete fetch.

**Output:** one row per change, with the fields listed above. Run stats are in `OUTPUT`. No personal data is collected.

**Limitations:** storefront pages expose the featured products only (typically 20 to 60) and no stock. Listing pages and search pages are behind a login wall, so single listings rely on the official API.

### 💲 Pricing & cost examples

| Example | Changes per month | Approx. cost |
|---|---|---|
| 1 store, daily (~3 changes/day) | ~90 | ~US$0.18 |
| 5 stores, daily (~10/day) | ~300 | ~US$0.60 |
| 20 stores, hourly (~100/day) | ~3,000 | ~US$6.00 |

### 🎯 Filters & typical use

- `minChangePercent` ignores price changes below X% (not charged); `onlyPriceDrops` keeps price drops only; **Price history** dataset view.
- Save your input as a Task, add a Schedule and a Slack/email/webhook integration. You only get rows when something changed.

### ❓ FAQ

- **What is a store slug?** The part after `/tienda/`, or paste the full URL.
- **Full catalog?** No: the storefront's featured products (typically 20–60).
- **Stock?** Storefronts don't expose stock.
- **Single listings or sellers?** Only with your own ML OAuth access; ML may block it (HTTP 403).
- **Where is the snapshot stored?** In a named key-value store in your account.
- **Personal data?** None; only public product data.

### 🔗 More scrapers by ener90

- [Mercado Libre Reviews & Questions Scraper](https://apify.com/ener90/mercadolibre-reviews-questions)
- [TrustRadius Reviews Scraper](https://apify.com/ener90/software-reviews-scraper)
- [Walmart Reviews Scraper](https://apify.com/ener90/walmart-products-reviews)
- [Product Hunt Scraper](https://apify.com/ener90/product-hunt-launches)
- Chile Real Estate Scraper (`ener90/chile-real-estate-scraper`, coming soon)
- AI Review Insights (`ener90/ai-review-insights`, coming soon)

Need a custom scraper or a different site? Open an issue in the **Issues** tab.

### 🧩 API & integrations quick start

**cURL (sync, returns items)**
```bash
curl -X POST "https://api.apify.com/v2/acts/ener90~mercadolibre-seller-price-monitor/run-sync-get-dataset-items?token=YOUR_APIFY_TOKEN" \
  -H "Content-Type: application/json" -d '{"officialStores":["samsung"],"site":"MLC"}'
```

**Node.js**
```js
import { ApifyClient } from 'apify-client';
const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
const run = await client.actor('ener90/mercadolibre-seller-price-monitor').call({"officialStores":["samsung"],"site":"MLC"});
const { items } = await client.dataset(run.defaultDatasetId).listItems();
```

**Python**
```python
from apify_client import ApifyClient
client = ApifyClient("YOUR_APIFY_TOKEN")
run = client.actor("ener90/mercadolibre-seller-price-monitor").call(run_input={"officialStores":["samsung"],"site":"MLC"})
items = client.dataset(run["defaultDatasetId"]).list_items().items
```

- **Google Sheets:** add the *Google Sheets* integration to a saved Task, or use `=IMPORTDATA("https://api.apify.com/v2/datasets/<DATASET_ID>/items?format=csv&clean=1")`.
- **n8n / Make / Zapier:** use the official Apify node or app: *Run Actor* (`ener90/mercadolibre-seller-price-monitor`) → *Get dataset items*.
- **Webhooks:** on a Task, add an integration *Run succeeded* → your URL (gets `defaultDatasetId`).
- **AI agents (MCP):** `https://mcp.apify.com?actors=ener90/mercadolibre-seller-price-monitor` works in Claude, ChatGPT, Cursor or any MCP client.
- **Free plan:** works on Apify's free tier; usage is billed per result (see Pricing). Start with small limits to try it out.

### 📝 Changelog
- 0.1 (2026-10-19): first public release (official-store monitor, pay per detected change).
- 0.1.8 (2026-10-20): new minChangePercent and onlyPriceDrops filters, Price history view, default memory 256 MB.

Issues or ideas? Open an issue in the **Issues** tab and we usually reply within 24 h.
