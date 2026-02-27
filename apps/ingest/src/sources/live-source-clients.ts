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
