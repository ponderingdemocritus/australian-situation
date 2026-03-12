---
name: use-price-intake-api
description: Use this when an agent has discovered new major-goods price items and needs to submit them through the API, inspect unresolved queue items, or reconcile them into canonical product/category metadata. Covers auth, batch payloads, unresolved queue flow, and the read-only major-goods index endpoint.
---

# Use Price Intake API

Use this skill when the task is to interact with the price intake API, not to change repo code.

This skill is for agents that:

1. discover new price items while scraping
2. submit those items in batches
3. review unresolved queue items
4. reconcile unresolved items into canonical metadata
5. read the published major-goods index

## Auth

All price endpoints use HTTP Basic Auth.

- password: `buildaustralia`
- username: any non-empty string is accepted

Example header:

```text
Authorization: Basic base64("agent:buildaustralia")
```

Example curl:

```bash
curl -u agent:buildaustralia "http://localhost:3001/api/prices/major-goods?region=AU"
```

If auth is missing or wrong, the API returns:

- `401`
- `WWW-Authenticate: Basic realm="AUS Dash Prices"`

## Endpoints

### 1. Submit discovered items in bulk

`POST /api/prices/intake/batches`

Use this when a scraper agent has found one or more candidate items.

Required JSON shape:

```json
{
  "sourceId": "agent_discovery",
  "capturedAt": "2026-03-12T00:00:00Z",
  "items": [
    {
      "observedAt": "2026-03-12T00:00:00Z",
      "merchantName": "Coles",
      "regionCode": "AU",
      "title": "Greek Yogurt 1kg",
      "externalOfferId": "coles-yogurt-1kg",
      "priceAmount": 6.5
    }
  ]
}
```

Useful optional fields on each item:

- `merchantSlug`
- `externalProductId`
- `unitPriceAmount`
- `normalizedQuantity`
- `normalizedUnit`
- `listingUrl`
- `categoryHint`
- `productHint`

Response shape:

```json
{
  "batchId": "...",
  "sourceId": "agent_discovery",
  "queuedCount": 1,
  "unresolvedItemIds": ["..."],
  "rawSnapshotId": "..."
}
```

Rules:

1. Batch related discoveries together.
2. Prefer stable `externalOfferId` values.
3. Fill normalization fields when you know them.
4. Use `categoryHint` and `productHint` only as hints, not as final truth.

### 2. Read the unresolved queue

`GET /api/prices/unresolved-items`

Optional query:

- `status=open`
- `status=reconciled`
- `status=promoted`

Default behavior returns open items.

Use this when an agent is acting as a reconciler.

### 3. Reconcile one unresolved item

`POST /api/prices/unresolved-items/:id/reconcile`

Required JSON shape:

```json
{
  "canonicalCategorySlug": "food",
  "canonicalCategoryName": "Food",
  "canonicalProductSlug": "greek-yogurt-1kg",
  "canonicalProductName": "Greek Yogurt 1kg",
  "notes": "Confirmed by second agent"
}
```

Use this when you are confident about the canonical mapping.

Important:

1. Reconciliation updates queue metadata only.
2. It does not directly publish the item into the index.
3. The queue item remains queryable with status `reconciled`.
4. A separate promotion job can later move it to status `promoted`.

### 4. Read the published index

`GET /api/prices/major-goods?region=AU`

Use this only to inspect the current published outputs.

Do not assume that newly submitted or reconciled queue items are already reflected here.

## Recommended Agent Flow

### Scraper agent

1. Discover items
2. Build one batch payload
3. Submit via `POST /api/prices/intake/batches`
4. Return the `batchId` and `unresolvedItemIds`

### Reconciliation agent

1. Read `GET /api/prices/unresolved-items?status=open`
2. Pick items with enough evidence
3. Reconcile them via `POST /api/prices/unresolved-items/:id/reconcile`
4. Record notes explaining why the mapping is trustworthy

## Minimum Submission Quality

Do not submit items if all you have is a vague product title and no merchant/offer identity.

Try to include:

1. merchant name
2. region
3. product title
4. offer id
5. observed timestamp
6. price
7. listing URL when available
8. unit-price or normalization fields when available

## What This API Does Not Do

It does not:

1. auto-create public series ids
2. auto-assign basket weights
3. auto-publish newly reconciled items into the major-goods index
4. guarantee that agent hints are accepted as canonical truth

Those are downstream ingestion and methodology tasks.

## Scrapling Guidance

Use Scrapling when the target site is JS-heavy, anti-bot protected, or hides useful data until a browser session interacts with the page.

This is especially relevant for Woolworths.

### Installation pattern

The base package is not enough for browser fetchers.

Use:

```bash
python -m pip install --user "scrapling[fetchers]"
~/.local/bin/scrapling install
```

### Effective fetcher choice

Preferred order:

1. `DynamicFetcher`
   Best when you need to click, fill, or inspect rendered DOM state.
2. `StealthyFetcher`
   Good when the page already renders enough content without interaction.

### Woolworths pattern that works

Do not start with anonymous product detail pages.

Better pattern:

1. open a Woolworths search/group page
2. select `Delivery`
3. enter a full address, not just a postcode
4. choose the first matching address option
5. read the rendered product grid cards

Working address example:

```text
1 George St, Sydney 2000
```

Why:

1. anonymous product pages often return `Price: 0`
2. postcode alone was not enough
3. a full delivery address made the search/grid page expose real prices

### Woolworths fields to capture

From each product card, capture:

1. title
2. product URL
3. displayed price
4. unit price if present

The useful DOM region we validated is the product grid card, not the page-level JSON alone.

### Woolworths failure mode to avoid

Do not assume this is enough:

```python
DynamicFetcher.fetch("https://www.woolworths.com.au/shop/productdetails/...")
```

That often fetches the page but still leaves:

- `Price: 0`
- `InstorePrice: 0`

because delivery/store context has not been selected.

### Practical Scrapling workflow

Use a `page_action` callback when interaction is needed.

High-level sequence:

1. fetch the search/group page
2. click the first `Choose` button for delivery address
3. select the `Delivery` radio
4. continue to the address field
5. fill the full address
6. click the first suggestion option
7. wait for the product grid to stabilize
8. extract card text and links

### Extraction heuristics

For Woolworths product grids:

1. ignore blank duplicate links
2. keep the first non-empty product title per product URL
3. use the first `$...` token as the item price
4. use the second `$...` token as unit price when available

### What to persist into the intake API

When turning Scrapling output into API input:

1. set `merchantName` to the retailer
2. set `merchantSlug` to a stable lowercase slug
3. use the retailer product id from the URL when available
4. use a stable `externalOfferId`
5. pass numeric `priceAmount`
6. pass numeric `unitPriceAmount` if you have one
7. always pass the original listing URL

### Reliability rules

1. Prefer group/search pages over detail pages when detail pages hide price.
2. Use a full address when the site asks for delivery context.
3. Reuse the same address string for consistency across runs.
4. Treat origin, AI exposure, and control-group labels as classification-stage metadata, not scrape-stage facts.
