# Changelog

- 0.1 (2026-10-19): first public release (official-store monitor, pay per detected change).
- 0.1.8 (2026-10-20): new minChangePercent and onlyPriceDrops filters, Price history view, default memory 256 MB.
- 0.1.17 (2026-10-28): fixes 0 results on official stores. Mercado Libre changed the store pages to plain HTML (poly-card__content, andes-money-amount, id in the link wid=MLC...); the parser reads title, price, previous price, discount, id, URL, currency and store name from it (old embedded-JSON layout kept as fallback). If no store can be read the run now ends as FAILED with the reason instead of finishing OK with an empty dataset. The first run (baseline) now outputs the listings by default (still free); only detected changes are charged.
