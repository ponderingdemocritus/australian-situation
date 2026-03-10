# China Proxy Follow-up

## Bottom line

There is a **defensible China proxy path only in a narrow sense**:

- **Wholesale:** yes, as an **annual regulator-backed market-price proxy** using the National Energy Administration's published national average market transaction price for coal-fired generation.
- **Retail:** only as a **constructed province-weighted regulated-tariff proxy** built from provincial regulator tariff notices plus National Bureau of Statistics weights. That is defensible only if the repo is willing to label it clearly as a proxy rather than an official national tariff series.

I would **not** add China as a normal retail series from official national statistics alone.

## Defensible proxy options

### 1. Preferred near-term option: annual wholesale proxy

Use the NEA's published **national average market transaction price for coal-fired generation units** as an annual China wholesale proxy.

- Why this is defensible: it is a **national, official, regulator-backed number**, not an invented aggregation.
- Limitation: it is an **annual average transaction price**, not a live national spot or day-ahead series.
- Practical fit: acceptable only if the repo can tolerate a coarse `wholesale_proxy` series for China.

Official source:

- NEA press briefing, 2023-02-13: https://www.nea.gov.cn/2023-02/13/c_1310697044.htm

Note: this source explicitly states that in 2022 the **national average market transaction price for coal-fired generation** was `0.449 yuan/kWh`. That is the cleanest official national wholesale-style proxy found in this pass.

### 2. Possible but weaker option: province-weighted regulated residential tariff proxy

If China must be added on the retail side without a published national tariff dataset, the least-bad methodology is:

1. Collect each province's **first-tier residential regulated tariff** from provincial development and reform commission / energy-regulator notices.
2. Weight those tariffs by an **official NBS national weight**, preferably provincial population or household count.
3. Publish the result only as a **`regulated_residential_tariff_proxy`**, not as "China retail electricity price".

Why this is defensible:

- The tariff inputs are regulator-set values.
- The weights can come from official national statistics.
- The method is transparent and reproducible.

Why this is still weak:

- It is **not** an officially published national tariff series.
- It ignores second/third consumption blocks, local surcharges, and realized household bills.
- It will represent a **headline regulated first-block tariff**, not the average price actually paid by households.

Official statistical weight sources:

- China Statistical Yearbook 2024 index: https://www.stats.gov.cn/sj/ndsj/2024/indexeh.htm
- Yearbook table list: https://www.stats.gov.cn/sj/ndsj/2024/left_.htm
- Provincial population table (`2-5 Population at Year-end by Region`): https://www.stats.gov.cn/sj/ndsj/2024/html/E02-05.jpg
- Provincial electricity-consumption table (`9-14 Electricity Consumption by Region`): https://www.stats.gov.cn/sj/ndsj/2024/html/E09-14.jpg

## What is not defensible

These should **not** be used as China price proxies for this repo:

- NBS CPI or electricity-related price indices.
- Household expenditure tables by themselves.
- Broad "residence" or utility expenditure categories.

Reason: those are **indices or spending aggregates**, not tariff or wholesale price levels in `currency/kWh`.

Relevant official statistical pages:

- Household expenditure composition by region: https://www.stats.gov.cn/sj/ndsj/2024/html/E06-21.jpg
- Urban household expenditure composition by region: https://www.stats.gov.cn/sj/ndsj/2024/html/E06-27.jpg
- Rural household expenditure composition by region: https://www.stats.gov.cn/sj/ndsj/2024/html/E06-33.jpg

## Recommendation for this repo

- **If adding China now:** add only an **annual wholesale proxy** sourced from NEA, with explicit metadata that it is a national annual average market transaction price, not a spot feed.
- **For retail:** defer unless the repo is willing to maintain a province-level tariff collection workflow and label the result as a **regulated-tariff proxy**.
- **Do not** add China retail using NBS indices/expenditure tables alone.
