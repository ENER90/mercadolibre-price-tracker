# Mercado Libre Price Tracker – Official Store Monitor

[![Apify Store](https://img.shields.io/badge/Apify%20Store-live-0F62FE?logo=apify&logoColor=white)](https://apify.com/ener90/mercadolibre-seller-price-monitor)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Crawlee](https://img.shields.io/badge/Crawlee-3-FF4785)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Monitors Mercado Libre official stores and outputs only what changed between runs: price drops/increases, discounts, new and removed products. Charged per detected change.

▶️ **Run it on the Apify Store:** https://apify.com/ener90/mercadolibre-seller-price-monitor

## Tech stack
TypeScript, Node.js 22, Crawlee (got-scraping), Apify SDK (pay-per-event), Vitest.

## Architecture
```
src/
  parsers.ts   # pure, unit-tested parsing/transform logic (no I/O)
  main.ts      # Actor entry: input validation, crawling, retries, output
.actor/        # Apify Actor config: input/output/dataset schemas, Dockerfile, Store README
tests/         # Vitest unit tests + real HTML/JSON fixtures
```
- `parsers.ts`: storefront parser (extracts product cards from an embedded JS payload with a balanced-bracket JSON scanner), input parsing, and a pure `diff()` that produces typed change events.
- `main.ts`: fetches storefronts with `got-scraping`, persists snapshots in a **named key-value store** per monitor, filters (`minChangePercent`, `onlyPriceDrops`) and pushes only changes. Removals are reported only after a complete fetch to avoid false alarms.

Design principles: **reliability first** (session rotation, retries, block detection, clear error messages), **privacy by default** (no personal data is collected), **low cost** (small memory footprint, resource blocking, pay-per-event pricing).

## Run locally
```bash
npm install
npm test            # 6 unit tests (Vitest)
npm run build
# put an input in storage/key_value_stores/default/INPUT.json, then:
npm start           # or: apify run
```
Deploy: `apify login && apify push`.

## Input / output
See [`.actor/input_schema.json`](.actor/input_schema.json), [`.actor/dataset_schema.json`](.actor/dataset_schema.json) and the full user docs in [`.actor/STORE_README.md`](.actor/STORE_README.md) (English & Spanish).

## Legal & privacy
Collects only publicly available data and deliberately drops personal identifiers. Users are responsible for complying with the target site's terms and applicable law.

## License
MIT © René Del Valle Rodríguez
