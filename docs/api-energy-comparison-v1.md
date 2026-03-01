# API Contract: Energy Comparison V1

Status: Implemented  
Date: 2026-02-28

## Purpose
Provide AU vs global electricity comparison data with explicit methodology metadata so dashboard and external API consumers can benchmark Australia against peers.

## Endpoints

### 1) `GET /api/v1/energy/compare/retail`

Compares AU retail electricity prices against peer countries.

Query params:
- `country` (default `AU`)
- `peers` comma-separated ISO country list (for example `US,DE`)
- `basis` one of `nominal` or `ppp` (default `nominal`)
- `tax_status` (default `incl_tax`)
- `consumption_band` (default `household_mid`)

Success response:

```json
{
  "country": "AU",
  "peers": ["US", "DE"],
  "basis": "nominal",
  "taxStatus": "incl_tax",
  "consumptionBand": "household_mid",
  "auRank": 1,
  "methodologyVersion": "energy-comparison-v1",
  "rows": [
    {
      "countryCode": "AU",
      "date": "2026-02",
      "value": 0.32,
      "methodologyVersion": "energy-comparison-v1",
      "rank": 1
    },
    {
      "countryCode": "DE",
      "date": "2026-02",
      "value": 0.30,
      "methodologyVersion": "energy-comparison-v1",
      "rank": 2
    },
    {
      "countryCode": "US",
      "date": "2026-02",
      "value": 0.18,
      "methodologyVersion": "energy-comparison-v1",
      "rank": 3
    }
  ],
  "comparisons": [
    {
      "peerCountryCode": "US",
      "peerValue": 0.18,
      "gap": 0.14,
      "gapPct": 77.78
    },
    {
      "peerCountryCode": "DE",
      "peerValue": 0.30,
      "gap": 0.02,
      "gapPct": 6.67
    }
  ]
}
```

Error responses:

`400 UNSUPPORTED_BASIS`

```json
{
  "error": {
    "code": "UNSUPPORTED_BASIS",
    "message": "Unsupported basis: fx"
  }
}
```

`404 NO_COMPARABLE_PEER_DATA`

```json
{
  "error": {
    "code": "NO_COMPARABLE_PEER_DATA",
    "message": "No comparable data for peers: ZZ"
  }
}
```

### 2) `GET /api/v1/energy/compare/wholesale`

Compares AU wholesale spot electricity prices against peer countries.

Query params:
- `country` (default `AU`)
- `peers` comma-separated ISO country list (for example `US,DE`)

Success response:

```json
{
  "country": "AU",
  "peers": ["US", "DE"],
  "auRank": 1,
  "auPercentile": 100,
  "methodologyVersion": "energy-comparison-v1",
  "rows": [
    {
      "countryCode": "AU",
      "date": "2026-02-28T01:00:00Z",
      "value": 120,
      "methodologyVersion": "energy-comparison-v1",
      "rank": 1
    },
    {
      "countryCode": "DE",
      "date": "2026-02-28T01:00:00Z",
      "value": 95,
      "methodologyVersion": "energy-comparison-v1",
      "rank": 2
    },
    {
      "countryCode": "US",
      "date": "2026-02-28T01:00:00Z",
      "value": 70,
      "methodologyVersion": "energy-comparison-v1",
      "rank": 3
    }
  ],
  "comparisons": [
    {
      "peerCountryCode": "US",
      "peerValue": 70,
      "gap": 50,
      "gapPct": 71.43
    },
    {
      "peerCountryCode": "DE",
      "peerValue": 95,
      "gap": 25,
      "gapPct": 26.32
    }
  ]
}
```

Error responses:
- `404 NO_COMPARABLE_PEER_DATA` (same shape as retail)

### 3) `GET /api/v1/metadata/methodology`

Returns methodology metadata for a metric key.

Query params:
- `metric` (for example `energy.compare.retail`)

Success response:

```json
{
  "metric": "energy.compare.retail",
  "methodologyVersion": "energy-comparison-v1",
  "description": "Cross-country household retail electricity price comparison with tax and consumption-band filters.",
  "requiredDimensions": [
    "country",
    "peers",
    "basis",
    "tax_status",
    "consumption_band"
  ]
}
```

Error response:

`404 UNKNOWN_METRIC`

```json
{
  "error": {
    "code": "UNKNOWN_METRIC",
    "message": "Unknown metric: energy.compare.unknown"
  }
}
```
