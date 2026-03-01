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
