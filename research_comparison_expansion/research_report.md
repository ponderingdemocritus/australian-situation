# Comparison Expansion Research Report

## Decision

Implement Indonesia now. Defer India and China.

## Why Indonesia Was Implemented

1. Retail source quality is strong:
   - PLN publishes official household tariffs on a stable public page.
   - The same content is available from a machine-readable WordPress JSON endpoint.
   - The source exposes explicit `Rp/kWh` values and is reviewed quarterly.
2. Repo fit is good:
   - Indonesia can be added to the retail comparison pipeline with one new source client and normalization support.
   - The dashboard can show Indonesia in the retail comparison list without changing the wholesale comparison contract.

Primary sources reviewed:

1. PLN article: https://web.pln.co.id/cms/media/2025/12/tarif-listrik/
2. PLN JSON endpoint: https://web.pln.co.id/cms/wp-json/wp/v2/posts/54823

## Why India Was Deferred

1. Wholesale has a viable official path through the Indian Energy Exchange.
2. Retail is only defensible as a coarse annual proxy from official utility statistics.
3. That would weaken comparability versus the current dashboard’s more current retail sources.

Primary sources reviewed:

1. IEX market snapshot: https://www.iexindia.com/market-data/day-ahead-market/market-snapshot
2. Central Electricity Authority annual book: https://cea.nic.in/wp-content/uploads/fs___a/2024/07/Book_2023.pdf

## Why China Was Deferred

1. Official sources confirm market activity, but this research did not find a stable national public retail tariff dataset suitable for household price comparison.
2. This research also did not find a clean public national wholesale/spot time series suitable for the repo’s current comparison model.
3. Adding China now would require inventing a province-aggregation methodology the repo does not currently support.

Primary sources reviewed:

1. National Bureau of Statistics yearbook: https://www.stats.gov.cn/sj/ndsj/2024/indexeh.htm
2. National Energy Administration market reference: https://obor.nea.gov.cn/detail/21780.html
3. State Grid market platform: https://pmos.sgcc.com.cn/

## Implemented Scope

1. Indonesia added to the retail comparison pipeline.
2. China added as an explicitly labeled proxy:
   - retail uses a Beijing residential tariff proxy
   - wholesale uses an NEA annual market-price proxy
3. Retail peer list expanded in the dashboard to include Indonesia and China.
4. Wholesale peers expanded to include the China proxy.
