# Mercado Libre Price Tracker – Monitor de Precios

Lo armé para dejar de revisar a mano las tiendas oficiales de Mercado Libre. Cada vez que corre compara con la vez anterior y te entrega solo lo que cambió: precios que subieron o bajaron, descuentos nuevos, y productos que aparecieron o se fueron. Lo programas una vez, diario o cada hora, y te avisa por email, Slack o webhook. No necesita login.

Funciona en Chile, Argentina, México, Brasil, Colombia, Uruguay, Perú y Ecuador.

![Formulario con la tienda oficial de Samsung](https://raw.githubusercontent.com/ENER90/mercadolibre-price-tracker/main/docs/screenshots/01-input.png)

## Qué datos obtienes

Una fila por cada cambio:

| Campo | Ejemplo real | Qué significa |
|---|---|---|
| `changeType` | `PRICE_CHANGE`, `NEW_LISTING`, `REMOVED_LISTING` | Qué tipo de cambio fue |
| `title` | "48 Oled S85h 4k Samsung Vision Ai Smart Tv (2026)" | El producto |
| `field` | `price` | Qué dato cambió |
| `oldValue` → `newValue` | `791989` → `719990` | Antes y ahora |
| `changePercent` | `-9.09` | Cuánto cambió, en % |
| `currency`, `url`, `itemId` | `CLP`, link, `MLC…` | Para ubicar el producto |
| `detectedAt`, `previousCheckAt` | fechas ISO | Entre qué revisiones ocurrió |

Los otros tipos de cambio son `DISCOUNT_CHANGE`, `STOCK_CHANGE`, `STATUS_CHANGE` y `BASELINE`.

![Cambios reales detectados en la tienda Samsung de Mercado Libre Chile](https://raw.githubusercontent.com/ENER90/mercadolibre-price-tracker/main/docs/screenshots/02-output-table.png)

## Cuánto cuesta

US$0,002 por cambio detectado, o sea US$2 por cada 1.000 cambios. La primera ejecución (la foto inicial) y las ejecuciones sin cambios no cobran nada.

| Ejemplo | Cambios al mes | Costo al mes |
|---|---|---|
| 1 tienda, una vez al día, unos 3 cambios diarios | 90 | US$0,18 |
| 5 tiendas, una vez al día, unos 10 cambios diarios | 300 | US$0,60 |
| 20 tiendas, cada hora, unos 100 cambios diarios | 3.000 | US$6,00 |

Con **Min price change %** y **Only price drops** filtras el ruido, y lo que filtras no se cobra. Una revisión real de la tienda Samsung en Chile tardó 4 segundos y encontró 7 cambios, por US$0,014.

## Cómo usarlo

1. Crea una cuenta gratis en Apify y abre este actor.
2. En **Official stores** escribe el slug de la tienda (lo que va después de `/tienda/` en la URL, por ejemplo `samsung`) o pega la URL completa.
3. En **Site / country** elige el país. Si pegaste una URL, el país sale de ahí.
4. Deja marcados **Track price** y **Track new / removed listings**. Si solo te interesan las ofertas, marca **Only price drops** y pon por ejemplo `5` en **Min price change %**.
5. Ponle un nombre en **Monitor name** (por ejemplo `samsung-cl`). Ahí se guarda la foto anterior, así que usa un nombre distinto para cada grupo de tiendas.
6. Aprieta **Start**. La primera vez solo guarda la foto inicial.
7. Guarda el input como **Task** y crea un **Schedule**, por ejemplo todos los días a las 9:00. En la Task agrega una integración de Slack, email o webhook para que te llegue el aviso.

## Ejemplo de entrada

```json
{
  "officialStores": ["samsung"],
  "site": "MLC",
  "monitorName": "samsung-cl",
  "trackPrice": true,
  "trackListings": true,
  "minChangePercent": 5,
  "onlyPriceDrops": true
}
```

## Ejemplo de salida

![Un cambio de precio en JSON](https://raw.githubusercontent.com/ENER90/mercadolibre-price-tracker/main/docs/screenshots/03-output-json.png)

## Para qué sirve

- Si vendes lo mismo que una tienda oficial, te enteras el mismo día de que bajó el precio.
- Si quieres comprar algo, te avisa cuando entra en oferta.
- Puedes armar un historial de precios por tienda para un estudio de mercado. El dataset tiene una vista **Price history**.

## Integraciones

- **Slack, email o webhook:** se agregan en la pestaña Integrations de la Task ("Run succeeded").
- **Make, Zapier y n8n:** app oficial de Apify, "Run Actor" (`ener90/mercadolibre-seller-price-monitor`) y luego "Get dataset items", de ahí a Sheets o donde quieras.
- **API:**

```python
from apify_client import ApifyClient
client = ApifyClient("TU_TOKEN")
run = client.actor("ener90/mercadolibre-seller-price-monitor").call(run_input={"officialStores": ["samsung"], "site": "MLC", "monitorName": "samsung-cl"})
for change in client.dataset(run["defaultDatasetId"]).iterate_items():
    print(change["changeType"], change["title"], change.get("oldValue"), "->", change.get("newValue"))
```

- **Agentes de IA:** agrégalo a [Apify MCP](https://mcp.apify.com) y pregunta "¿qué bajó de precio hoy en la tienda Samsung de Mercado Libre Chile?".

## Limitaciones

- Sigue los productos destacados de la vitrina de la tienda (normalmente entre 20 y 60), no el catálogo completo.
- Las vitrinas no muestran stock, así que **Track stock** solo sirve con las fuentes por API.
- **Listings** y **Sellers** usan la API oficial con tu propio acceso OAuth (**Mercado Libre app ID**, **Mercado Libre app secret** o **Mercado Libre access token**). Mercado Libre bloquea esos endpoints para muchas apps (HTTP 403), así que pueden no funcionar.
- Si una fuente falla o solo se lee una parte, no marca productos como eliminados, para no darte falsas alarmas.

## Preguntas frecuentes

**¿Dónde queda guardada la foto anterior?** En un key-value store de tu cuenta llamado `ml-monitor-<monitorName>`. Si quieres partir de cero, marca **Reset baseline**.

**¿Puedo ver todos los productos la primera vez?** Sí, marca **Output baseline on first run**. Esas filas salen con `changeType: BASELINE`.

**¿Guarda datos personales?** No, solo datos públicos de los productos.

## Otros actores míos

- [Mercado Libre Reviews & Preguntas](https://apify.com/ener90/mercadolibre-reviews-questions): opiniones y preguntas de cualquier producto.
- [Chile Real Estate](https://apify.com/ener90/chile-real-estate-scraper): propiedades de Portal Inmobiliario y TocToc.

In English: this Actor watches Mercado Libre official stores (by slug like `samsung` or by store URL) and, on each run, outputs only what changed since the last one: price changes, discount changes, and new or removed listings. Schedule it daily or hourly and connect Slack, email or a webhook. It costs US$0.002 per detected change, and the first run and runs with no changes are free.
