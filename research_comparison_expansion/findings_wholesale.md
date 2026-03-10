# Wholesale / Spot Electricity Source Findings

## Summary

For this repo's wholesale comparison dashboard, India is the only defensible near-term addition from this pass. China has official spot-market institutions, but I did not locate a stable public national spot-price time series from official sources in this pass. Indonesia does not appear to have a public exchange-style wholesale/spot price dataset suitable for country-level comparison.

## Country Notes

| Country | Official / primary source | What exists | Cadence | Units | Access method | Dashboard fit |
| --- | --- | --- | --- | --- | --- | --- |
| India | Indian Energy Exchange (IEX) Day Ahead Market snapshot: https://www.iexindia.com/market-data/day-ahead-market/market-snapshot | Official exchange page exposes day-ahead cleared records by quarter-hour block with fields including `mcp`, `mcv`, purchase/sell bid, and daily summary. Search result text also labels DAM price as `Rs/MWh`. | 15-minute market intervals, daily market publication; page supports current and date-scoped snapshots. | Price: INR/MWh (`Rs/MWh`); volume: MWh / MW in summaries. | Public web page / SPA payload; usable for scraper ingestion. UI also exposes export controls. | Good. This is a real wholesale market price series with clear units and regular cadence. Best candidate for repo expansion. |
| China | National Energy Administration article: https://obor.nea.gov.cn/detail/21780.html ; State Grid national power market platform: https://pmos.sgcc.com.cn/ | Official sources confirm China has spot markets and a national power trading platform. However, this pass did not find a stable public national spot-price dataset or clear unauthenticated export/API for a country-level time series. Public visibility appears fragmented and platform-driven rather than a simple open dataset. | Spot markets exist, but public cadence for a reusable national price series was not established from official sources in this pass. | Not established from a reusable official public dataset in this pass. | Public web platform exists, but not as a straightforward open time-series feed from the sources reviewed. | Weak for now. China is not a clean country-level wholesale comparison source unless the scope is narrowed to one pilot/provincial market with a stable official publication path. |
| Indonesia | PT PLN official site: https://www.pln.co.id/ ; Ministry of Energy and Mineral Resources statistics handbook: https://www.esdm.go.id/assets/media/content/content-handbook-of-energy-and-economic-statistics-of-indonesia-2021.pdf | Official public data found in this pass is utility/tariff/statistics oriented, not exchange-cleared wholesale or spot market prices. PLN presents itself as the public electricity provider; I did not find a public market-operator spot price series. | Public official statistics are periodic, mostly annual / administrative, not market-interval pricing. | Sector statistics and tariff information, not a comparable spot price series. | Web pages and PDFs; no machine-readable public spot feed identified. | Poor. Not suitable for the repo's wholesale comparison dashboard without changing the metric away from market wholesale prices. |

## Comparability Assessment

- India is the closest match to the repo's existing wholesale comparison concept: exchange-cleared prices, explicit price units, and regular publication.
- China has real spot-market activity, but country-level comparability is weak because official public publication does not appear centralized into a simple national spot dataset.
- Indonesia is not comparable on a wholesale-market basis from official public sources reviewed here; it would require a different metric family.

## Recommendation

- Add India first for wholesale comparison.
- Defer China until an official province-level or national public price feed is confirmed and normalization rules are clear.
- Exclude Indonesia from wholesale/spot comparison for now.

## Source Notes

- India evidence came from the official IEX market snapshot page payload and market snapshot UI text surfaced in search results.
- China conclusion is based on official NEA confirmation that spot markets exist plus the publicly reachable State Grid market platform, combined with the absence of a clean public national spot time series in this pass.
- Indonesia conclusion is based on official PLN and ESDM sources showing public electricity information exists, but not as an exchange-style wholesale/spot dataset.
