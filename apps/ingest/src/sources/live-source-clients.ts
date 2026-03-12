import {
  ENERGY_SOURCE_MIX_KEYS,
  getSourceCatalogItems,
  type EnergySourceMixKey
} from "@aus-dash/shared";

type HttpResponseLike = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
};

export type SourceFetch = (
  url: string,
  init?: {
    headers?: Record<string, string>;
  }
) => Promise<HttpResponseLike>;

export type MajorGoodsPricePoint = {
  observedAt: string;
  merchantSlug: string;
  merchantName: string;
  regionCode: string;
  categorySlug: string;
  categoryName: string;
  productSlug: string;
  canonicalName: string;
  externalProductId: string;
  externalOfferId: string;
  priceAmount: number;
  unitPriceAmount: number;
  normalizedQuantity: number;
  normalizedUnit: string;
  priceType: string;
  listingUrl?: string;
};

type SourceClientErrorOptions = {
  transient: boolean;
  status?: number;
  cause?: unknown;
};

export class SourceClientError extends Error {
  readonly sourceId: string;
  readonly transient: boolean;
  readonly status?: number;

  constructor(sourceId: string, message: string, options: SourceClientErrorOptions) {
    super(message);
    this.name = "SourceClientError";
    this.sourceId = sourceId;
    this.transient = options.transient;
    this.status = options.status;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

function defaultFetch(url: string, init?: { headers?: Record<string, string> }) {
  return fetch(url, init) as Promise<HttpResponseLike>;
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function parseCsvRows(content: string): Record<string, string>[] {
  const lines = content
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const header = lines[0]!.split(",").map((column) => column.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i += 1) {
      row[header[i]!] = values[i] ?? "";
    }
    return row;
  });
}

async function readJsonResponse(
  sourceId: string,
  response: HttpResponseLike
): Promise<unknown> {
  if (!response.ok) {
    throw new SourceClientError(sourceId, `HTTP ${response.status}`, {
      transient: isTransientStatus(response.status),
      status: response.status
    });
  }

  try {
    return await response.json();
  } catch (error) {
    throw new SourceClientError(sourceId, "invalid JSON payload", {
      transient: false,
      cause: error
    });
  }
}

async function readTextResponse(
  sourceId: string,
  response: HttpResponseLike
): Promise<string> {
  if (!response.ok) {
    throw new SourceClientError(sourceId, `HTTP ${response.status}`, {
      transient: isTransientStatus(response.status),
      status: response.status
    });
  }

  try {
    return await response.text();
  } catch (error) {
    throw new SourceClientError(sourceId, "invalid text payload", {
      transient: false,
      cause: error
    });
  }
}

function normalizeAemoRegion(raw: string): string {
  const upper = raw.toUpperCase();
  return upper.endsWith("1") ? upper.slice(0, -1) : upper;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readStringField(
  sourceId: string,
  value: unknown,
  fieldName: string
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SourceClientError(sourceId, `schema drift in ${fieldName}`, {
      transient: false
    });
  }
  return value.trim();
}

function readNumberField(
  sourceId: string,
  value: unknown,
  fieldName: string
): number {
  if (isFiniteNumber(value)) {
    return value;
  }
  throw new SourceClientError(sourceId, `schema drift in ${fieldName}`, {
    transient: false
  });
}

function resolveMajorGoodsFetchUrl(endpoint?: string): string {
  if (endpoint && endpoint.length > 0) {
    return endpoint;
  }

  const configured = process.env.AUS_DASH_MAJOR_GOODS_FETCH_URL;
  if (configured && configured.length > 0) {
    return configured;
  }

  throw new SourceClientError("major_goods_prices", "major goods fetch URL is not configured", {
    transient: false
  });
}

export async function fetchMajorGoodsPriceSnapshot(options: {
  endpoint?: string;
  fetchImpl?: SourceFetch;
} = {}): Promise<{
  sourceId: "major_goods_prices";
  observedAt: string;
  points: MajorGoodsPricePoint[];
  rawPayload: string;
}> {
  const sourceId = "major_goods_prices";
  const endpoint = resolveMajorGoodsFetchUrl(options.endpoint);
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  let response: HttpResponseLike;
  try {
    response = await fetchImpl(endpoint);
  } catch (error) {
    throw new SourceClientError(sourceId, "network failure", {
      transient: true,
      cause: error
    });
  }

  const payload = await readJsonResponse(sourceId, response);
  if (
    !payload ||
    typeof payload !== "object" ||
    !("observed_at" in payload) ||
    !("items" in payload) ||
    !Array.isArray(payload.items)
  ) {
    throw new SourceClientError(sourceId, "schema drift in major goods payload", {
      transient: false
    });
  }

  const observedAt = readStringField(sourceId, payload.observed_at, "major goods observed_at");
  const points = payload.items.map((item) => {
    if (!item || typeof item !== "object") {
      throw new SourceClientError(sourceId, "schema drift in major goods row", {
        transient: false
      });
    }

    const listingUrl =
      "listing_url" in item && typeof item.listing_url === "string"
        ? item.listing_url
        : undefined;

    return {
      observedAt,
      merchantSlug: readStringField(sourceId, item.merchant, "major goods merchant"),
      merchantName: readStringField(sourceId, item.merchant_name, "major goods merchant_name"),
      regionCode: readStringField(sourceId, item.region_code, "major goods region_code"),
      categorySlug: readStringField(sourceId, item.category_slug, "major goods category_slug"),
      categoryName: readStringField(sourceId, item.category_name, "major goods category_name"),
      productSlug: readStringField(sourceId, item.product_slug, "major goods product_slug"),
      canonicalName: readStringField(
        sourceId,
        item.canonical_name,
        "major goods canonical_name"
      ),
      externalProductId: readStringField(
        sourceId,
        item.external_product_id,
        "major goods external_product_id"
      ),
      externalOfferId: readStringField(
        sourceId,
        item.external_offer_id,
        "major goods external_offer_id"
      ),
      priceAmount: readNumberField(sourceId, item.price_amount, "major goods price_amount"),
      unitPriceAmount: readNumberField(
        sourceId,
        item.unit_price_amount,
        "major goods unit_price_amount"
      ),
      normalizedQuantity: readNumberField(
        sourceId,
        item.normalized_quantity,
        "major goods normalized_quantity"
      ),
      normalizedUnit: readStringField(
        sourceId,
        item.normalized_unit,
        "major goods normalized_unit"
      ),
      priceType: readStringField(sourceId, item.price_type, "major goods price_type"),
      listingUrl
    };
  });

  return {
    sourceId,
    observedAt,
    points,
    rawPayload: JSON.stringify(payload)
  };
}

function parseEnergySourceMixKey(
  sourceId: string,
  value: unknown
): EnergySourceMixKey {
  const sourceKey = String(value ?? "").toLowerCase() as EnergySourceMixKey;
  if (!ENERGY_SOURCE_MIX_KEYS.includes(sourceKey)) {
    throw new SourceClientError(sourceId, "schema drift in source mix row", {
      transient: false
    });
  }

  return sourceKey;
}

export type AemoWholesalePoint = {
  regionCode: string;
  timestamp: string;
  rrpAudMwh: number;
  demandMwh: number;
};

export type AemoWholesaleSnapshot = {
  sourceId: "aemo_wholesale";
  endpoint: string;
  rawPayload: string;
  points: AemoWholesalePoint[];
};

export type FetchAemoWholesaleOptions = {
  endpoint?: string;
  fetchImpl?: SourceFetch;
};

export async function fetchAemoWholesaleSnapshot(
  options: FetchAemoWholesaleOptions = {}
): Promise<AemoWholesaleSnapshot> {
  const sourceId = "aemo_wholesale";
  const endpoint =
    options.endpoint ??
    "https://www.nemweb.com.au/REPORTS/CURRENT/Dispatch_SCADA/";
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  let response: HttpResponseLike;
  try {
    response = await fetchImpl(endpoint, {
      headers: {
        accept: "text/csv,text/plain"
      }
    });
  } catch (error) {
    throw new SourceClientError(sourceId, "network failure", {
      transient: true,
      cause: error
    });
  }

  const rawPayload = await readTextResponse(sourceId, response);
  const rows = parseCsvRows(rawPayload);

  const points = rows.map((row) => {
    const timestamp = row.SETTLEMENTDATE;
    const regionId = row.REGIONID;
    const rrp = Number(row.RRP);
    const demand = Number(row.TOTALDEMAND);

    if (!timestamp || !regionId || Number.isNaN(rrp) || Number.isNaN(demand)) {
      throw new SourceClientError(sourceId, "schema drift in AEMO CSV", {
        transient: false
      });
    }

    return {
      regionCode: normalizeAemoRegion(regionId),
      timestamp,
      rrpAudMwh: rrp,
      demandMwh: demand
    };
  });

  return {
    sourceId,
    endpoint,
    rawPayload,
    points
  };
}

export type DccEeewGenerationMixPoint = {
  regionCode: string;
  period: string;
  sourceKey: EnergySourceMixKey;
  generationGwh: number;
  sharePct: number;
};

export type DccEeewGenerationMixSnapshot = {
  sourceId: "dcceew_generation_mix";
  endpoint: string;
  rawPayload: string;
  points: DccEeewGenerationMixPoint[];
};

export type FetchDccEeewGenerationMixOptions = {
  endpoint?: string;
  fetchImpl?: SourceFetch;
};

export async function fetchDccEeewGenerationMixSnapshot(
  options: FetchDccEeewGenerationMixOptions = {}
): Promise<DccEeewGenerationMixSnapshot> {
  const sourceId = "dcceew_generation_mix";
  const endpoint =
    options.endpoint ?? getSourceCatalogItems([sourceId])[0]!.url;
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  let response: HttpResponseLike;
  try {
    response = await fetchImpl(endpoint, {
      headers: {
        accept: "application/json"
      }
    });
  } catch (error) {
    throw new SourceClientError(sourceId, "network failure", {
      transient: true,
      cause: error
    });
  }

  const parsed = await readJsonResponse(sourceId, response);
  const payload = parsed as {
    year?: unknown;
    data?: Array<{
      region_code?: unknown;
      source_key?: unknown;
      generation_gwh?: unknown;
      share_pct?: unknown;
    }>;
  };
  if (typeof payload.year !== "string" || !Array.isArray(payload.data)) {
    throw new SourceClientError(sourceId, "schema drift in DCCEEW payload", {
      transient: false
    });
  }

  const points = payload.data.map((row) => {
    const regionCode = String(row.region_code ?? "");
    const generationGwh = Number(row.generation_gwh);
    const sharePct = Number(row.share_pct);

    if (!regionCode || Number.isNaN(generationGwh) || Number.isNaN(sharePct)) {
      throw new SourceClientError(sourceId, "schema drift in DCCEEW row", {
        transient: false
      });
    }

    return {
      regionCode,
      period: payload.year as string,
      sourceKey: parseEnergySourceMixKey(sourceId, row.source_key),
      generationGwh,
      sharePct
    };
  });

  return {
    sourceId,
    endpoint,
    rawPayload: JSON.stringify(parsed),
    points
  };
}

export type AemoOperationalSourceMixPoint = {
  regionCode: string;
  timestamp: string;
  sourceKey: EnergySourceMixKey;
  generationMw: number;
  sharePct: number;
};

export type AemoOperationalSourceMixSnapshot = {
  sourceId: "aemo_nem_source_mix" | "aemo_wem_source_mix";
  endpoint: string;
  rawPayload: string;
  points: AemoOperationalSourceMixPoint[];
};

type FetchAemoOperationalSourceMixOptions = {
  endpoint?: string;
  fetchImpl?: SourceFetch;
};

async function fetchAemoOperationalSourceMixSnapshot(
  sourceId: "aemo_nem_source_mix" | "aemo_wem_source_mix",
  options: FetchAemoOperationalSourceMixOptions = {}
): Promise<AemoOperationalSourceMixSnapshot> {
  const endpoint =
    options.endpoint ?? getSourceCatalogItems([sourceId])[0]!.url;
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  let response: HttpResponseLike;
  try {
    response = await fetchImpl(endpoint, {
      headers: {
        accept: "application/json"
      }
    });
  } catch (error) {
    throw new SourceClientError(sourceId, "network failure", {
      transient: true,
      cause: error
    });
  }

  const parsed = await readJsonResponse(sourceId, response);
  const payload = parsed as {
    interval_start_utc?: unknown;
    data?: Array<{
      region_code?: unknown;
      source_key?: unknown;
      generation_mw?: unknown;
      share_pct?: unknown;
    }>;
  };
  if (typeof payload.interval_start_utc !== "string" || !Array.isArray(payload.data)) {
    throw new SourceClientError(sourceId, "schema drift in AEMO source mix payload", {
      transient: false
    });
  }

  const points = payload.data.map((row) => {
    const regionCode = String(row.region_code ?? "");
    const generationMw = Number(row.generation_mw);
    const sharePct = Number(row.share_pct);

    if (!regionCode || Number.isNaN(generationMw) || Number.isNaN(sharePct)) {
      throw new SourceClientError(sourceId, "schema drift in AEMO source mix row", {
        transient: false
      });
    }

    return {
      regionCode,
      timestamp: payload.interval_start_utc as string,
      sourceKey: parseEnergySourceMixKey(sourceId, row.source_key),
      generationMw,
      sharePct
    };
  });

  return {
    sourceId,
    endpoint,
    rawPayload: JSON.stringify(parsed),
    points
  };
}

export async function fetchAemoNemSourceMixSnapshot(
  options: FetchAemoOperationalSourceMixOptions = {}
): Promise<AemoOperationalSourceMixSnapshot> {
  return fetchAemoOperationalSourceMixSnapshot("aemo_nem_source_mix", options);
}

export async function fetchAemoWemSourceMixSnapshot(
  options: FetchAemoOperationalSourceMixOptions = {}
): Promise<AemoOperationalSourceMixSnapshot> {
  return fetchAemoOperationalSourceMixSnapshot("aemo_wem_source_mix", options);
}

export type AerRetailPlan = {
  planId: string;
  regionCode: string;
  customerType: string;
  annualBillAud: number;
};

export type AerRetailSnapshot = {
  sourceId: "aer_prd";
  endpoint: string;
  rawPayload: string;
  plans: AerRetailPlan[];
};

export type FetchAerRetailOptions = {
  endpoint?: string;
  fetchImpl?: SourceFetch;
};

export async function fetchAerRetailPlansSnapshot(
  options: FetchAerRetailOptions = {}
): Promise<AerRetailSnapshot> {
  const sourceId = "aer_prd";
  const endpoint = options.endpoint ?? "https://www.aer.gov.au/energy-product-reference-data";
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  let response: HttpResponseLike;
  try {
    response = await fetchImpl(endpoint, {
      headers: {
        accept: "application/json"
      }
    });
  } catch (error) {
    throw new SourceClientError(sourceId, "network failure", {
      transient: true,
      cause: error
    });
  }

  const parsed = await readJsonResponse(sourceId, response);
  const payload = parsed as {
    data?: Array<{
      id?: unknown;
      attributes?: Record<string, unknown>;
    }>;
  };
  if (!Array.isArray(payload.data)) {
    throw new SourceClientError(sourceId, "schema drift in AER payload", {
      transient: false
    });
  }

  const plans = payload.data.map((row) => {
    const regionCode = String(row.attributes?.region_code ?? "");
    const customerType = String(row.attributes?.customer_type ?? "");
    const annualBillAud = Number(row.attributes?.annual_bill_aud);
    const planId = String(row.id ?? "");
    if (!planId || !regionCode || !customerType || Number.isNaN(annualBillAud)) {
      throw new SourceClientError(sourceId, "schema drift in AER plan row", {
        transient: false
      });
    }

    return {
      planId,
      regionCode,
      customerType,
      annualBillAud
    };
  });

  return {
    sourceId,
    endpoint,
    rawPayload: JSON.stringify(parsed),
    plans
  };
}

export type HousingSeriesObservation = {
  seriesId: string;
  regionCode: string;
  date: string;
  value: number;
  unit: string;
};

export type AbsHousingSnapshot = {
  sourceId: "abs_housing";
  endpoint: string;
  rawPayload: string;
  observations: HousingSeriesObservation[];
};

export type FetchAbsHousingOptions = {
  endpoint?: string;
  fetchImpl?: SourceFetch;
};

export async function fetchAbsHousingSnapshot(
  options: FetchAbsHousingOptions = {}
): Promise<AbsHousingSnapshot> {
  const sourceId = "abs_housing";
  const endpoint =
    options.endpoint ??
    "https://data.api.abs.gov.au/rest/data/ABS,HOUSING";
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  let response: HttpResponseLike;
  try {
    response = await fetchImpl(endpoint, {
      headers: {
        accept: "application/json"
      }
    });
  } catch (error) {
    throw new SourceClientError(sourceId, "network failure", {
      transient: true,
      cause: error
    });
  }

  const parsed = await readJsonResponse(sourceId, response);
  const payload = parsed as {
    observations?: Array<{
      series_id?: unknown;
      region_code?: unknown;
      date?: unknown;
      value?: unknown;
      unit?: unknown;
    }>;
  };
  if (!Array.isArray(payload.observations)) {
    throw new SourceClientError(sourceId, "schema drift in ABS payload", {
      transient: false
    });
  }

  const observations = payload.observations.map((row) => {
    const seriesId = String(row.series_id ?? "");
    const regionCode = String(row.region_code ?? "");
    const date = String(row.date ?? "");
    const value = Number(row.value);
    const unit = String(row.unit ?? "");
    if (!seriesId || !regionCode || !date || !unit || Number.isNaN(value)) {
      throw new SourceClientError(sourceId, "schema drift in ABS observation row", {
        transient: false
      });
    }

    return {
      seriesId,
      regionCode,
      date,
      value,
      unit
    };
  });

  return {
    sourceId,
    endpoint,
    rawPayload: JSON.stringify(parsed),
    observations
  };
}

export type AbsCpiObservation = {
  regionCode: string;
  date: string;
  value: number;
  unit: string;
};

export type AbsCpiSnapshot = {
  sourceId: "abs_cpi";
  endpoint: string;
  rawPayload: string;
  observations: AbsCpiObservation[];
};

export type FetchAbsCpiOptions = {
  endpoint?: string;
  fetchImpl?: SourceFetch;
};

export async function fetchAbsCpiSnapshot(
  options: FetchAbsCpiOptions = {}
): Promise<AbsCpiSnapshot> {
  const sourceId = "abs_cpi";
  const endpoint = options.endpoint ?? "https://data.api.abs.gov.au/rest/data/ABS,CPI";
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  let response: HttpResponseLike;
  try {
    response = await fetchImpl(endpoint, {
      headers: {
        accept: "application/json"
      }
    });
  } catch (error) {
    throw new SourceClientError(sourceId, "network failure", {
      transient: true,
      cause: error
    });
  }

  const parsed = await readJsonResponse(sourceId, response);
  const payload = parsed as {
    observations?: Array<{
      region_code?: unknown;
      date?: unknown;
      value?: unknown;
      unit?: unknown;
    }>;
  };
  if (!Array.isArray(payload.observations)) {
    throw new SourceClientError(sourceId, "schema drift in ABS CPI payload", {
      transient: false
    });
  }

  const observations = payload.observations.map((row) => {
    const regionCode = String(row.region_code ?? "");
    const date = String(row.date ?? "");
    const value = Number(row.value);
    const unit = String(row.unit ?? "");
    if (!regionCode || !date || !unit || Number.isNaN(value)) {
      throw new SourceClientError(sourceId, "schema drift in ABS CPI row", {
        transient: false
      });
    }

    return {
      regionCode,
      date,
      value,
      unit
    };
  });

  return {
    sourceId,
    endpoint,
    rawPayload: JSON.stringify(parsed),
    observations
  };
}

export type RbaRatesSnapshot = {
  sourceId: "rba_rates";
  endpoint: string;
  rawPayload: string;
  observations: HousingSeriesObservation[];
};

export type FetchRbaRatesOptions = {
  endpoint?: string;
  fetchImpl?: SourceFetch;
};

export async function fetchRbaRatesSnapshot(
  options: FetchRbaRatesOptions = {}
): Promise<RbaRatesSnapshot> {
  const sourceId = "rba_rates";
  const endpoint = options.endpoint ?? "https://www.rba.gov.au/statistics/csv/f06.csv";
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  let response: HttpResponseLike;
  try {
    response = await fetchImpl(endpoint, {
      headers: {
        accept: "text/csv,text/plain"
      }
    });
  } catch (error) {
    throw new SourceClientError(sourceId, "network failure", {
      transient: true,
      cause: error
    });
  }

  const rawPayload = await readTextResponse(sourceId, response);
  const rows = parseCsvRows(rawPayload);
  if (rows.length === 0) {
    throw new SourceClientError(sourceId, "schema drift in RBA CSV", {
      transient: false
    });
  }

  const observations: HousingSeriesObservation[] = [];
  for (const row of rows) {
    const date = row.date;
    const variable = Number(row.oo_variable_pct);
    const fixed = Number(row.oo_fixed_pct);
    if (!date || Number.isNaN(variable) || Number.isNaN(fixed)) {
      throw new SourceClientError(sourceId, "schema drift in RBA rate row", {
        transient: false
      });
    }

    observations.push(
      {
        seriesId: "rates.oo.variable_pct",
        regionCode: "AU",
        date,
        value: variable,
        unit: "%"
      },
      {
        seriesId: "rates.oo.fixed_pct",
        regionCode: "AU",
        date,
        value: fixed,
        unit: "%"
      }
    );
  }

  return {
    sourceId,
    endpoint,
    rawPayload,
    observations
  };
}

export type EiaRetailPricePoint = {
  countryCode: "US";
  regionCode: string;
  period: string;
  customerType: string;
  priceUsdKwh: number;
};

export type EiaWholesalePricePoint = {
  countryCode: "US";
  regionCode: string;
  intervalStartUtc: string;
  intervalEndUtc: string;
  priceUsdMwh: number;
};

export type EiaElectricitySnapshot = {
  sourceId: "eia_electricity";
  endpoint: string;
  rawPayload: string;
  retailPoints: EiaRetailPricePoint[];
  wholesalePoints: EiaWholesalePricePoint[];
};

export type FetchEiaElectricityOptions = {
  endpoint?: string;
  fetchImpl?: SourceFetch;
};

export async function fetchEiaElectricitySnapshot(
  options: FetchEiaElectricityOptions = {}
): Promise<EiaElectricitySnapshot> {
  const sourceId = "eia_electricity";
  const endpoint = options.endpoint ?? "https://api.eia.gov/v2/electricity";
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  let response: HttpResponseLike;
  try {
    response = await fetchImpl(endpoint, {
      headers: {
        accept: "application/json"
      }
    });
  } catch (error) {
    throw new SourceClientError(sourceId, "network failure", {
      transient: true,
      cause: error
    });
  }

  const parsed = await readJsonResponse(sourceId, response);
  const payload = parsed as {
    retail?: Array<{
      period?: unknown;
      region_code?: unknown;
      customer_type?: unknown;
      price_usd_kwh?: unknown;
    }>;
    wholesale?: Array<{
      interval_start_utc?: unknown;
      interval_end_utc?: unknown;
      region_code?: unknown;
      lmp_usd_mwh?: unknown;
    }>;
  };
  if (!Array.isArray(payload.retail) || !Array.isArray(payload.wholesale)) {
    throw new SourceClientError(sourceId, "schema drift in EIA payload", {
      transient: false
    });
  }

  const retailPoints = payload.retail.map((row) => {
    const period = String(row.period ?? "");
    const regionCode = String(row.region_code ?? "");
    const customerType = String(row.customer_type ?? "");
    const priceUsdKwh = Number(row.price_usd_kwh);

    if (!period || !regionCode || !customerType || Number.isNaN(priceUsdKwh)) {
      throw new SourceClientError(sourceId, "schema drift in EIA retail row", {
        transient: false
      });
    }

    return {
      countryCode: "US" as const,
      regionCode,
      period,
      customerType,
      priceUsdKwh
    };
  });

  const wholesalePoints = payload.wholesale.map((row) => {
    const intervalStartUtc = String(row.interval_start_utc ?? "");
    const intervalEndUtc = String(row.interval_end_utc ?? "");
    const regionCode = String(row.region_code ?? "");
    const priceUsdMwh = Number(row.lmp_usd_mwh);

    if (
      !intervalStartUtc ||
      !intervalEndUtc ||
      !regionCode ||
      Number.isNaN(priceUsdMwh)
    ) {
      throw new SourceClientError(sourceId, "schema drift in EIA wholesale row", {
        transient: false
      });
    }

    return {
      countryCode: "US" as const,
      regionCode,
      intervalStartUtc,
      intervalEndUtc,
      priceUsdMwh
    };
  });

  return {
    sourceId,
    endpoint,
    rawPayload: JSON.stringify(parsed),
    retailPoints,
    wholesalePoints
  };
}

export type EntsoeWholesalePoint = {
  countryCode: string;
  biddingZone: string;
  intervalStartUtc: string;
  intervalEndUtc: string;
  priceEurMwh: number;
};

export type EntsoeWholesaleSnapshot = {
  sourceId: "entsoe_wholesale";
  endpoint: string;
  rawPayload: string;
  points: EntsoeWholesalePoint[];
};

export type FetchEntsoeWholesaleOptions = {
  endpoint?: string;
  fetchImpl?: SourceFetch;
};

export async function fetchEntsoeWholesaleSnapshot(
  options: FetchEntsoeWholesaleOptions = {}
): Promise<EntsoeWholesaleSnapshot> {
  const sourceId = "entsoe_wholesale";
  const endpoint = options.endpoint ?? "https://transparency.entsoe.eu/api";
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  let response: HttpResponseLike;
  try {
    response = await fetchImpl(endpoint, {
      headers: {
        accept: "application/json"
      }
    });
  } catch (error) {
    throw new SourceClientError(sourceId, "network failure", {
      transient: true,
      cause: error
    });
  }

  const parsed = await readJsonResponse(sourceId, response);
  const payload = parsed as {
    data?: Array<{
      country_code?: unknown;
      bidding_zone?: unknown;
      interval_start_utc?: unknown;
      interval_end_utc?: unknown;
      day_ahead_price_eur_mwh?: unknown;
    }>;
  };
  if (!Array.isArray(payload.data)) {
    throw new SourceClientError(sourceId, "schema drift in ENTSO-E payload", {
      transient: false
    });
  }

  const points = payload.data.map((row) => {
    const countryCode = String(row.country_code ?? "");
    const biddingZone = String(row.bidding_zone ?? "");
    const intervalStartUtc = String(row.interval_start_utc ?? "");
    const intervalEndUtc = String(row.interval_end_utc ?? "");
    const priceEurMwh = Number(row.day_ahead_price_eur_mwh);

    if (
      !countryCode ||
      !biddingZone ||
      !intervalStartUtc ||
      !intervalEndUtc ||
      Number.isNaN(priceEurMwh)
    ) {
      throw new SourceClientError(sourceId, "schema drift in ENTSO-E row", {
        transient: false
      });
    }

    return {
      countryCode,
      biddingZone,
      intervalStartUtc,
      intervalEndUtc,
      priceEurMwh
    };
  });

  return {
    sourceId,
    endpoint,
    rawPayload: JSON.stringify(parsed),
    points
  };
}

export type EurostatRetailPricePoint = {
  countryCode: string;
  period: string;
  customerType: string;
  consumptionBand: string;
  taxStatus: string;
  currency: string;
  priceLocalKwh: number;
};

export type EurostatRetailSnapshot = {
  sourceId: "eurostat_retail";
  endpoint: string;
  dataset: string;
  rawPayload: string;
  points: EurostatRetailPricePoint[];
};

export type FetchEurostatRetailOptions = {
  endpoint?: string;
  fetchImpl?: SourceFetch;
};

export async function fetchEurostatRetailSnapshot(
  options: FetchEurostatRetailOptions = {}
): Promise<EurostatRetailSnapshot> {
  const sourceId = "eurostat_retail";
  const endpoint = options.endpoint ?? "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_pc_204";
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  let response: HttpResponseLike;
  try {
    response = await fetchImpl(endpoint, {
      headers: {
        accept: "application/json"
      }
    });
  } catch (error) {
    throw new SourceClientError(sourceId, "network failure", {
      transient: true,
      cause: error
    });
  }

  const parsed = await readJsonResponse(sourceId, response);
  const payload = parsed as {
    dataset?: unknown;
    data?: Array<{
      country_code?: unknown;
      period?: unknown;
      customer_type?: unknown;
      consumption_band?: unknown;
      tax_status?: unknown;
      currency?: unknown;
      price_local_kwh?: unknown;
    }>;
  };
  if (!Array.isArray(payload.data) || typeof payload.dataset !== "string") {
    throw new SourceClientError(sourceId, "schema drift in Eurostat payload", {
      transient: false
    });
  }

  const points = payload.data.map((row) => {
    const countryCode = String(row.country_code ?? "");
    const period = String(row.period ?? "");
    const customerType = String(row.customer_type ?? "");
    const consumptionBand = String(row.consumption_band ?? "");
    const taxStatus = String(row.tax_status ?? "");
    const currency = String(row.currency ?? "");
    const priceLocalKwh = Number(row.price_local_kwh);

    if (
      !countryCode ||
      !period ||
      !customerType ||
      !consumptionBand ||
      !taxStatus ||
      !currency ||
      Number.isNaN(priceLocalKwh)
    ) {
      throw new SourceClientError(sourceId, "schema drift in Eurostat row", {
        transient: false
      });
    }

    return {
      countryCode,
      period,
      customerType,
      consumptionBand,
      taxStatus,
      currency,
      priceLocalKwh
    };
  });

  return {
    sourceId,
    endpoint,
    dataset: payload.dataset,
    rawPayload: JSON.stringify(parsed),
    points
  };
}

export type PlnRetailTariffPoint = {
  countryCode: "ID";
  period: string;
  tariffClass: string;
  customerType: "residential";
  consumptionBand: "household_low" | "household_mid" | "household_high";
  taxStatus: "mixed";
  currency: "IDR";
  priceLocalKwh: number;
};

export type PlnRetailTariffSnapshot = {
  sourceId: "pln_tariff";
  endpoint: string;
  rawPayload: string;
  points: PlnRetailTariffPoint[];
};

export type FetchPlnRetailTariffOptions = {
  endpoint?: string;
  fetchImpl?: SourceFetch;
};

function stripHtmlTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;/g, "-")
    .replace(/&ndash;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePlnCurrency(value: string, sourceId: string): number {
  const match = value.match(/Rp\s*([\d.,]+)/i);
  if (!match) {
    throw new SourceClientError(sourceId, "schema drift in PLN tariff row", {
      transient: false
    });
  }

  const normalized = match[1]!.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) {
    throw new SourceClientError(sourceId, "schema drift in PLN tariff value", {
      transient: false
    });
  }

  return parsed;
}

function parsePlnPublishedDate(value: string, sourceId: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new SourceClientError(sourceId, "schema drift in PLN publish date", {
      transient: false
    });
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function parsePlnTableRows(content: string, sourceId: string): string[][] {
  const householdSection = content.match(
    /<h3[^>]*>.*?Tarif Listrik Rumah Tangga.*?<\/table>/is
  )?.[0];
  if (!householdSection) {
    throw new SourceClientError(sourceId, "schema drift in PLN household tariff table", {
      transient: false
    });
  }

  return [...householdSection.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis)]
    .map((match) =>
      [...match[1]!.matchAll(/<td[^>]*>(.*?)<\/td>/gis)].map((cellMatch) =>
        stripHtmlTags(cellMatch[1]!)
      )
    )
    .filter((cells) => cells.length >= 3);
}

function findPlnTariffRow(
  rows: string[][],
  predicate: (cells: string[]) => boolean,
  sourceId: string
): string[] {
  const row = rows.find(predicate);
  if (!row) {
    throw new SourceClientError(sourceId, "schema drift in PLN tariff table rows", {
      transient: false
    });
  }
  return row;
}

export async function fetchPlnRetailTariffSnapshot(
  options: FetchPlnRetailTariffOptions = {}
): Promise<PlnRetailTariffSnapshot> {
  const sourceId = "pln_tariff";
  const endpoint =
    options.endpoint ?? "https://web.pln.co.id/cms/wp-json/wp/v2/posts/54823";
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  let response: HttpResponseLike;
  try {
    response = await fetchImpl(endpoint, {
      headers: {
        accept: "application/json"
      }
    });
  } catch (error) {
    throw new SourceClientError(sourceId, "network failure", {
      transient: true,
      cause: error
    });
  }

  const parsed = await readJsonResponse(sourceId, response);
  const payload = parsed as {
    date?: unknown;
    content?: { rendered?: unknown };
  };

  if (
    typeof payload.date !== "string" ||
    typeof payload.content?.rendered !== "string"
  ) {
    throw new SourceClientError(sourceId, "schema drift in PLN tariff payload", {
      transient: false
    });
  }

  const period = parsePlnPublishedDate(payload.date, sourceId);
  const rows = parsePlnTableRows(payload.content.rendered, sourceId);
  const lowRow = findPlnTariffRow(
    rows,
    (cells) => cells[0]?.includes("R-1 (Subsidi)") && cells[1]?.includes("900 VA"),
    sourceId
  );
  const midRow = findPlnTariffRow(
    rows,
    (cells) =>
      cells[0]?.includes("R-1 (Non-Subsidi)") &&
      (cells[1]?.includes("1.300") || cells[1]?.includes("1300")),
    sourceId
  );
  const highRow = findPlnTariffRow(
    rows,
    (cells) => cells[0]?.startsWith("R-2"),
    sourceId
  );

  return {
    sourceId,
    endpoint,
    rawPayload: JSON.stringify(parsed),
    points: [
      {
        countryCode: "ID",
        period,
        tariffClass: lowRow[0]!,
        customerType: "residential",
        consumptionBand: "household_low",
        taxStatus: "mixed",
        currency: "IDR",
        priceLocalKwh: parsePlnCurrency(lowRow[2]!, sourceId)
      },
      {
        countryCode: "ID",
        period,
        tariffClass: midRow[0]!,
        customerType: "residential",
        consumptionBand: "household_mid",
        taxStatus: "mixed",
        currency: "IDR",
        priceLocalKwh: parsePlnCurrency(midRow[2]!, sourceId)
      },
      {
        countryCode: "ID",
        period,
        tariffClass: highRow[0]!,
        customerType: "residential",
        consumptionBand: "household_high",
        taxStatus: "mixed",
        currency: "IDR",
        priceLocalKwh: parsePlnCurrency(highRow[2]!, sourceId)
      }
    ]
  };
}

export type BeijingResidentialTariffPoint = {
  countryCode: "CN";
  period: string;
  tariffClass: "Residential electricity users";
  customerType: "residential";
  consumptionBand: "household_mid";
  taxStatus: "mixed";
  currency: "CNY";
  priceLocalKwh: number;
};

export type BeijingResidentialTariffSnapshot = {
  sourceId: "beijing_residential_tariff";
  endpoint: string;
  rawPayload: string;
  points: BeijingResidentialTariffPoint[];
};

export type FetchBeijingResidentialTariffOptions = {
  endpoint?: string;
  fetchImpl?: SourceFetch;
};

function parseDateFromEndpoint(endpoint: string, sourceId: string): string {
  const match = endpoint.match(/t(\d{4})(\d{2})(\d{2})_/i);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  if (sourceId === "beijing_residential_tariff") {
    return "2021-10-25";
  }

  throw new SourceClientError(sourceId, "schema drift in source URL date", {
    transient: false
  });
}

export async function fetchBeijingResidentialTariffSnapshot(
  options: FetchBeijingResidentialTariffOptions = {}
): Promise<BeijingResidentialTariffSnapshot> {
  const sourceId = "beijing_residential_tariff";
  const endpoint =
    options.endpoint ??
    "https://fgw.beijing.gov.cn/bmcx/djcx/jzldj/202110/t20211025_2520169.htm";
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  let response: HttpResponseLike;
  try {
    response = await fetchImpl(endpoint, {
      headers: {
        accept: "text/html,text/plain"
      }
    });
  } catch (error) {
    throw new SourceClientError(sourceId, "network failure", {
      transient: true,
      cause: error
    });
  }

  const rawPayload = await readTextResponse(sourceId, response);
  const priceMatch = rawPayload.match(
    /Residential electricity users[\s\S]{0,120}?less than 1\s*kV[\s\S]{0,120}?([0-9]+\.[0-9]+)/i
  );
  if (!priceMatch) {
    throw new SourceClientError(sourceId, "schema drift in Beijing tariff page", {
      transient: false
    });
  }

  const priceLocalKwh = Number(priceMatch[1]);
  if (Number.isNaN(priceLocalKwh)) {
    throw new SourceClientError(sourceId, "schema drift in Beijing tariff value", {
      transient: false
    });
  }

  return {
    sourceId,
    endpoint,
    rawPayload,
    points: [
      {
        countryCode: "CN",
        period: parseDateFromEndpoint(endpoint, sourceId),
        tariffClass: "Residential electricity users",
        customerType: "residential",
        consumptionBand: "household_mid",
        taxStatus: "mixed",
        currency: "CNY",
        priceLocalKwh
      }
    ]
  };
}

export type NeaChinaWholesaleProxyPoint = {
  countryCode: "CN";
  period: string;
  priceCnyKwh: number;
};

export type NeaChinaWholesaleProxySnapshot = {
  sourceId: "nea_china_wholesale_proxy";
  endpoint: string;
  rawPayload: string;
  points: NeaChinaWholesaleProxyPoint[];
};

export type FetchNeaChinaWholesaleProxyOptions = {
  endpoint?: string;
  fetchImpl?: SourceFetch;
};

export async function fetchNeaChinaWholesaleProxySnapshot(
  options: FetchNeaChinaWholesaleProxyOptions = {}
): Promise<NeaChinaWholesaleProxySnapshot> {
  const sourceId = "nea_china_wholesale_proxy";
  const endpoint =
    options.endpoint ??
    "https://fjb.nea.gov.cn/dtyw/gjnyjdt/202309/t20230915_83144.html";
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  let response: HttpResponseLike;
  try {
    response = await fetchImpl(endpoint, {
      headers: {
        accept: "text/html,text/plain"
      }
    });
  } catch (error) {
    throw new SourceClientError(sourceId, "network failure", {
      transient: true,
      cause: error
    });
  }

  const rawPayload = await readTextResponse(sourceId, response);
  const match = rawPayload.match(
    /(20\d{2})年[^。]{0,120}?市场平均交易价格为\s*([0-9.]+)\s*元\/千瓦时/u
  );
  if (!match) {
    throw new SourceClientError(sourceId, "schema drift in NEA wholesale proxy page", {
      transient: false
    });
  }

  const priceCnyKwh = Number(match[2]);
  if (Number.isNaN(priceCnyKwh)) {
    throw new SourceClientError(sourceId, "schema drift in NEA wholesale proxy value", {
      transient: false
    });
  }

  return {
    sourceId,
    endpoint,
    rawPayload,
    points: [
      {
        countryCode: "CN",
        period: match[1]!,
        priceCnyKwh
      }
    ]
  };
}

export type WorldBankNormalizationPoint = {
  countryCode: string;
  year: string;
  indicatorCode: string;
  value: number;
};

export type WorldBankNormalizationSnapshot = {
  sourceId: "world_bank_normalization";
  endpoint: string;
  rawPayload: string;
  points: WorldBankNormalizationPoint[];
};

export type FetchWorldBankNormalizationOptions = {
  endpoint?: string;
  fetchImpl?: SourceFetch;
};

export async function fetchWorldBankNormalizationSnapshot(
  options: FetchWorldBankNormalizationOptions = {}
): Promise<WorldBankNormalizationSnapshot> {
  const sourceId = "world_bank_normalization";
  const endpoint = options.endpoint ?? "https://api.worldbank.org/v2/country/all/indicator";
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  let response: HttpResponseLike;
  try {
    response = await fetchImpl(endpoint, {
      headers: {
        accept: "application/json"
      }
    });
  } catch (error) {
    throw new SourceClientError(sourceId, "network failure", {
      transient: true,
      cause: error
    });
  }

  const parsed = await readJsonResponse(sourceId, response);
  const payload = parsed as {
    data?: Array<{
      country_code?: unknown;
      year?: unknown;
      indicator_code?: unknown;
      value?: unknown;
    }>;
  };
  if (!Array.isArray(payload.data)) {
    throw new SourceClientError(sourceId, "schema drift in World Bank payload", {
      transient: false
    });
  }

  const points = payload.data.map((row) => {
    const countryCode = String(row.country_code ?? "");
    const year = String(row.year ?? "");
    const indicatorCode = String(row.indicator_code ?? "");
    const value = Number(row.value);

    if (!countryCode || !year || !indicatorCode || Number.isNaN(value)) {
      throw new SourceClientError(sourceId, "schema drift in World Bank row", {
        transient: false
      });
    }

    return {
      countryCode,
      year,
      indicatorCode,
      value
    };
  });

  return {
    sourceId,
    endpoint,
    rawPayload: JSON.stringify(parsed),
    points
  };
}
