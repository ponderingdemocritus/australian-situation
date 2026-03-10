# Retail Electricity Source Findings

Suitability below is judged against this repo's current retail comparison shape: one comparable country/date/value observation, preferably household-focused, with enough metadata to map `consumptionBand` and `taxStatus`, and stable enough publication paths to ingest repeatedly.

| Country | Best official / primary source found | Cadence | Units | Publication form | Repo fit |
| --- | --- | --- | --- | --- | --- |
| India | Central Electricity Authority annual utility-statistics book | Annual | Likely INR per kWh / paise per kWh domestic tariff style values; household-band detail is weak | Official PDF; stable-looking annual publication path, not machine-readable in this pass | Possible, but only as an annual `household_mid`-style proxy |
| China | National Bureau of Statistics yearbook/official statistical publications | Annual | Official stats path found was CPI / expenditure style material, not retail tariff per kWh | HTML frames + JPG tables; no stable national tariff dataset found | Not suitable now |
| Indonesia | PLN official tariff publication for household classes | Quarterly | `Rp/kWh` | Stable public page plus machine-readable WordPress JSON endpoint | Suitable now |

## India

- Best source found: Central Electricity Authority annual publication `Growth of Electricity Sector in India from Utilities 2023`.
- Source URL: https://cea.nic.in/wp-content/uploads/fs___a/2024/07/Book_2023.pdf
- Why it matters: this is the clearest official national publication path I found for retail-style electricity tariff data. It is the right anchor if the repo accepts an annual domestic-consumer proxy rather than current posted residential tariffs.
- Cadence: annual.
- Units: the CEA utility book is the right place for tariff / average-rate utility statistics, but I did not confirm a clean machine-readable export in this pass.
- Machine-readable / stability: publication path looks stable enough for annual scraping/download, but the source is PDF-first and therefore higher-friction than Eurostat/EIA-style feeds.
- Suitability for dashboard: usable only if we accept a coarse annual India series, most likely mapped to `consumptionBand=household_mid` and `taxStatus=mixed`. It is weaker than current peer-country retail sources because household-band comparability and tax treatment are not clearly standardized.
- Recommendation: `defer unless annual/proxy data is acceptable`. India is plausible, but not as clean as Indonesia.

## China

- Official source reviewed: National Bureau of Statistics `China Statistical Yearbook 2024`.
- Source URLs:
  - https://www.stats.gov.cn/sj/ndsj/2024/indexeh.htm
  - https://www.stats.gov.cn/sj/ndsj/2024/left_.htm
- What I found: the official national statistics path exposes yearbook navigation and tables for CPI, prices, and household expenditure, but I did not find a stable national household retail electricity tariff dataset with direct `currency/kWh` values.
- Cadence: annual for the yearbook.
- Units: the official national material surfaced here is oriented to indices / expenditure, not direct household electricity tariff levels.
- Machine-readable / stability: stable official publication, but not machine-readable for this use case and not obviously a tariff dataset.
- Suitability for dashboard: poor. China's primary-source retail tariffs appear to be administered and locally differentiated; without a national regulator dataset or a defensible province-weighted aggregation methodology, adding China would mean inventing a methodology the repo does not currently support.
- Recommendation: `defer`. I would not add China to the comparison dashboard on the current evidence.

## Indonesia

- Best source found: PLN official tariff publication with household classes and per-kWh values.
- Source URLs:
  - Human-readable page: https://web.pln.co.id/cms/media/2025/12/tarif-listrik/
  - Machine-readable JSON: https://web.pln.co.id/cms/wp-json/wp/v2/posts/54823
- What it contains: household tariff classes (`R-1`, `R-2`, `R-3`) with explicit `Rp/kWh` values, including subsidized and non-subsidized residential brackets. The post states tariffs are reviewed every quarter.
- Cadence: quarterly.
- Units: `Rp/kWh`.
- Machine-readable / stability: good by comparison with the other candidates. The public article is stable enough to poll, and the WordPress JSON endpoint exposes the same structured content for extraction.
- Suitability for dashboard: strong. The repo can map Indonesia to household comparison bands without inventing a fake number:
  - `household_low`: `R-1` subsidized 450 VA / 900 VA
  - `household_mid`: `R-1` non-subsidized 1,300-2,200 VA
  - `household_high`: `R-2` / `R-3`
- Caveat: tax treatment is not explicit in the PLN post, so `taxStatus=mixed` is the conservative default unless a clearer ESDM tariff notice is located.
- Recommendation: `add now`.

## Bottom Line

- Add `Indonesia` now. It has the cleanest official publication path, explicit household `Rp/kWh` values, and a workable quarterly cadence.
- `India` is the next-best candidate, but only if the dashboard accepts an annual domestic-tariff proxy with weaker household-band comparability.
- Defer `China` until an official national tariff dataset or a regulator-grade provincial aggregation source is found.
