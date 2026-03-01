"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_REGION,
  REGIONS,
  type ComparisonBasis,
  type EnergyOverviewResponse,
  type HousingOverviewResponse,
  type MethodologyMetadataResponse,
  parseEnergyOverviewResponse,
  parseHousingOverviewResponse,
  parseMethodologyMetadataResponse,
  parseRetailComparisonResponse,
  parseWholesaleComparisonResponse,
  type RetailComparisonResponse,
  type RegionCode,
  type WholesaleComparisonResponse
} from "../lib/overview";
import { AustraliaSectorMap } from "./australia-sector-map";

type DashboardMetricRow = {
  label: string;
  title: string;
  hint: string;
  value: string;
  delta: string;
  deltaNegative?: boolean;
  valueAlert?: boolean;
};

type FeedMetricRow = {
  id: string;
  label: string;
  title: string;
  hint: string;
  value: string;
  previous: string;
  change: string;
  barWidth: number;
  positive: boolean;
};

type DataHealthRow = {
  label: string;
  value: string;
  positive: boolean;
};

type FeedEntry = {
  action: string;
  deltaText: string;
  entity: string;
  lineNumber: number;
  prefix: "" | "+" | "-" | "!";
  timestamp: string;
  variant: "neutral" | "new" | "error";
  volume: number;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

const COMPARISON_COUNTRY = "AU";
const COMPARISON_PEERS = ["US", "DE"] as const;
const SUBJECT_TABS = ["energy", "housing"] as const;
type SubjectTab = (typeof SUBJECT_TABS)[number];

const ENERGY_METRIC_COPY = {
  "live-rrp": {
    title: "Live wholesale price",
    hint: "National spot market, AUD per MWh"
  },
  "retail-mean": {
    title: "Average annual household bill",
    hint: "Market mean from current retail offers"
  },
  "dmo-benchmark": {
    title: "Default market offer benchmark",
    hint: "Reference annual bill benchmark"
  },
  "cpi-period": {
    title: "Electricity CPI period",
    hint: "Latest CPI release and index context"
  }
} as const;

const HOUSING_METRIC_COPY = {
  HVI_INDEX: {
    title: "Housing value index",
    hint: "National housing price index level"
  },
  AVG_LOAN: {
    title: "Average owner-occupier loan",
    hint: "Average approved loan size"
  },
  OO_VARIABLE_RATE: {
    title: "Owner-occupier variable rate",
    hint: "Average variable mortgage rate"
  },
  INVESTOR_LOANS: {
    title: "Investor loan count",
    hint: "Number of investor housing loans"
  }
} as const;

type RetailComparisonByBasis = {
  nominal: RetailComparisonResponse | null;
  ppp: RetailComparisonResponse | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseSubject(raw: string | null | undefined): SubjectTab {
  if (raw === "housing") {
    return "housing";
  }
  return "energy";
}

function resolveInitialSubject(): SubjectTab {
  if (typeof window === "undefined") {
    return "energy";
  }

  return parseSubject(new URLSearchParams(window.location.search).get("subject"));
}

function formatAud(value: number): string {
  return `${Math.round(value)} AUD`;
}

function formatAudMwh(value: number): string {
  return `${value.toFixed(1)} AUD/MWh`;
}

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString("en-AU")}`;
}

function formatCurrencyDelta(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-AU")}`;
}

function formatAestClock(now: Date): string {
  try {
    const time = new Intl.DateTimeFormat("en-AU", {
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Australia/Sydney"
    }).format(now);
    return `AEST ${time}`;
  } catch {
    return "AEST --:--:--";
  }
}

function buildOverviewUrl(path: string, region: RegionCode): string {
  const params = new URLSearchParams({ region });
  return `${API_BASE_URL}${path}?${params.toString()}`;
}

function buildRetailComparisonUrl(basis: ComparisonBasis): string {
  const params = new URLSearchParams({
    country: COMPARISON_COUNTRY,
    peers: COMPARISON_PEERS.join(","),
    basis,
    tax_status: "incl_tax",
    consumption_band: "household_mid"
  });
  return `${API_BASE_URL}/api/v1/energy/compare/retail?${params.toString()}`;
}

function buildWholesaleComparisonUrl(): string {
  const params = new URLSearchParams({
    country: COMPARISON_COUNTRY,
    peers: COMPARISON_PEERS.join(",")
  });
  return `${API_BASE_URL}/api/v1/energy/compare/wholesale?${params.toString()}`;
}

function buildMethodologyUrl(metric: string): string {
  const params = new URLSearchParams({ metric });
  return `${API_BASE_URL}/api/v1/metadata/methodology?${params.toString()}`;
}

function formatComparisonValue(value: number, basis: ComparisonBasis): string {
  const unit = basis === "ppp" ? "USD/kWh PPP" : "USD/kWh";
  return `${value.toFixed(3)} ${unit}`;
}

function getSeriesValue(
  overview: HousingOverviewResponse,
  seriesId: string
): number | null {
  const metric = overview.metrics.find((item) => item.seriesId === seriesId);
  return metric?.value ?? null;
}

function buildHousingMetricRows(
  overview: HousingOverviewResponse | null
): DashboardMetricRow[] {
  if (!overview) {
    return [
      {
        label: "HVI_INDEX",
        title: HOUSING_METRIC_COPY.HVI_INDEX.title,
        hint: HOUSING_METRIC_COPY.HVI_INDEX.hint,
        value: "--",
        delta: "WAITING"
      },
      {
        label: "AVG_LOAN",
        title: HOUSING_METRIC_COPY.AVG_LOAN.title,
        hint: HOUSING_METRIC_COPY.AVG_LOAN.hint,
        value: "--",
        delta: "WAITING"
      },
      {
        label: "OO_VARIABLE_RATE",
        title: HOUSING_METRIC_COPY.OO_VARIABLE_RATE.title,
        hint: HOUSING_METRIC_COPY.OO_VARIABLE_RATE.hint,
        value: "--",
        delta: "WAITING"
      },
      {
        label: "INVESTOR_LOANS",
        title: HOUSING_METRIC_COPY.INVESTOR_LOANS.title,
        hint: HOUSING_METRIC_COPY.INVESTOR_LOANS.hint,
        value: "--",
        delta: "WAITING"
      }
    ];
  }

  const hvi = getSeriesValue(overview, "hvi.value.index");
  const avgLoan = getSeriesValue(overview, "lending.avg_loan_size_aud");
  const ooVarRate = getSeriesValue(overview, "rates.oo.variable_pct");
  const investorCount = getSeriesValue(overview, "lending.investor.count");
  const asOf = overview.updatedAt ? `AS_OF ${overview.updatedAt}` : "AS_OF --";

  return [
    {
      label: "HVI_INDEX",
      title: HOUSING_METRIC_COPY.HVI_INDEX.title,
      hint: HOUSING_METRIC_COPY.HVI_INDEX.hint,
      value: hvi !== null ? hvi.toFixed(1) : "--",
      delta: asOf
    },
    {
      label: "AVG_LOAN",
      title: HOUSING_METRIC_COPY.AVG_LOAN.title,
      hint: HOUSING_METRIC_COPY.AVG_LOAN.hint,
      value: avgLoan !== null ? formatCurrency(avgLoan) : "--",
      delta: asOf
    },
    {
      label: "OO_VARIABLE_RATE",
      title: HOUSING_METRIC_COPY.OO_VARIABLE_RATE.title,
      hint: HOUSING_METRIC_COPY.OO_VARIABLE_RATE.hint,
      value: ooVarRate !== null ? `${ooVarRate.toFixed(2)}%` : "--",
      delta: asOf
    },
    {
      label: "INVESTOR_LOANS",
      title: HOUSING_METRIC_COPY.INVESTOR_LOANS.title,
      hint: HOUSING_METRIC_COPY.INVESTOR_LOANS.hint,
      value: investorCount !== null ? Math.round(investorCount).toLocaleString("en-AU") : "--",
      delta: asOf
    }
  ];
}

function buildEnergyMetricRows(overview: EnergyOverviewResponse | null): FeedMetricRow[] {
  if (!overview) {
    return [
      {
        id: "live-rrp",
        label: "LIVE_RRP",
        title: ENERGY_METRIC_COPY["live-rrp"].title,
        hint: ENERGY_METRIC_COPY["live-rrp"].hint,
        value: "--",
        previous: "updated --",
        change: "--",
        barWidth: 50,
        positive: true
      },
      {
        id: "retail-mean",
        label: "RETAIL_MEAN",
        title: ENERGY_METRIC_COPY["retail-mean"].title,
        hint: ENERGY_METRIC_COPY["retail-mean"].hint,
        value: "--",
        previous: "median --",
        change: "--",
        barWidth: 50,
        positive: true
      },
      {
        id: "dmo-benchmark",
        label: "DMO_BENCHMARK",
        title: ENERGY_METRIC_COPY["dmo-benchmark"].title,
        hint: ENERGY_METRIC_COPY["dmo-benchmark"].hint,
        value: "--",
        previous: "mean --",
        change: "--",
        barWidth: 50,
        positive: true
      },
      {
        id: "cpi-period",
        label: "CPI_PERIOD",
        title: ENERGY_METRIC_COPY["cpi-period"].title,
        hint: ENERGY_METRIC_COPY["cpi-period"].hint,
        value: "--",
        previous: "idx --",
        change: "status --",
        barWidth: 50,
        positive: false
      }
    ];
  }

  const liveRrp = overview.panels.liveWholesale.valueAudMwh;
  const retailMean = overview.panels.retailAverage.annualBillAudMean;
  const retailMedian = overview.panels.retailAverage.annualBillAudMedian;
  const benchmark = overview.panels.benchmark.dmoAnnualBillAud;
  const cpiIndex = overview.panels.cpiElectricity.indexValue;
  const freshness = overview.freshness.status.toUpperCase();

  return [
    {
      id: "live-rrp",
      label: "LIVE_RRP",
      title: ENERGY_METRIC_COPY["live-rrp"].title,
      hint: ENERGY_METRIC_COPY["live-rrp"].hint,
      value: formatAudMwh(liveRrp),
      previous: `updated ${overview.freshness.updatedAt}`,
      change: freshness,
      barWidth: clamp((liveRrp / 250) * 100, 18, 95),
      positive: overview.freshness.status === "fresh"
    },
    {
      id: "retail-mean",
      label: "RETAIL_MEAN",
      title: ENERGY_METRIC_COPY["retail-mean"].title,
      hint: ENERGY_METRIC_COPY["retail-mean"].hint,
      value: formatAud(retailMean),
      previous: `median ${formatAud(retailMedian)}`,
      change: `spread ${formatCurrencyDelta(retailMean - retailMedian)}`,
      barWidth: clamp((retailMean / 2600) * 100, 18, 95),
      positive: retailMean <= benchmark
    },
    {
      id: "dmo-benchmark",
      label: "DMO_BENCHMARK",
      title: ENERGY_METRIC_COPY["dmo-benchmark"].title,
      hint: ENERGY_METRIC_COPY["dmo-benchmark"].hint,
      value: formatAud(benchmark),
      previous: `mean ${formatAud(retailMean)}`,
      change: `gap ${formatCurrencyDelta(benchmark - retailMean)}`,
      barWidth: clamp((benchmark / 2600) * 100, 18, 95),
      positive: benchmark > 0
    },
    {
      id: "cpi-period",
      label: "CPI_PERIOD",
      title: ENERGY_METRIC_COPY["cpi-period"].title,
      hint: ENERGY_METRIC_COPY["cpi-period"].hint,
      value: overview.panels.cpiElectricity.period,
      previous: `idx ${cpiIndex.toFixed(1)}`,
      change: `status ${freshness}`,
      barWidth: clamp((cpiIndex / 190) * 100, 18, 95),
      positive: cpiIndex > 0
    }
  ];
}

function buildDataHealthRows(
  energyOverview: EnergyOverviewResponse | null,
  housingOverview: HousingOverviewResponse | null
): DataHealthRow[] {
  return [
    {
      label: "ENERGY_FRESHNESS",
      value: energyOverview ? energyOverview.freshness.status.toUpperCase() : "WAITING",
      positive: energyOverview?.freshness.status === "fresh"
    },
    {
      label: "HOUSING_COVERAGE",
      value: housingOverview ? `missing ${housingOverview.missingSeriesIds.length}` : "WAITING",
      positive: !!housingOverview && housingOverview.missingSeriesIds.length === 0
    }
  ];
}

function formatLogTime(timestamp: string): string {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return "--:--:--";
  }

  return new Date(parsed).toISOString().slice(11, 19);
}

type DashboardShellProps = {
  initialRegion?: RegionCode;
  initialEnergyOverview?: EnergyOverviewResponse | null;
  initialHousingOverview?: HousingOverviewResponse | null;
  initialRetailComparisonNominal?: RetailComparisonResponse | null;
  initialRetailComparisonPpp?: RetailComparisonResponse | null;
  initialWholesaleComparison?: WholesaleComparisonResponse | null;
  initialRetailMethodology?: MethodologyMetadataResponse | null;
};

export function DashboardShell({
  initialRegion = DEFAULT_REGION,
  initialEnergyOverview = null,
  initialHousingOverview = null,
  initialRetailComparisonNominal = null,
  initialRetailComparisonPpp = null,
  initialWholesaleComparison = null,
  initialRetailMethodology = null
}: DashboardShellProps = {}) {
  const [region, setRegion] = useState<RegionCode>(initialRegion);
  const [subject, setSubject] = useState<SubjectTab>(() => resolveInitialSubject());
  const [energyOverview, setEnergyOverview] =
    useState<EnergyOverviewResponse | null>(initialEnergyOverview);
  const [energyLoading, setEnergyLoading] = useState(!initialEnergyOverview);
  const [energyError, setEnergyError] = useState<string | null>(null);
  const [housingOverview, setHousingOverview] =
    useState<HousingOverviewResponse | null>(initialHousingOverview);
  const [housingLoading, setHousingLoading] = useState(!initialHousingOverview);
  const [housingError, setHousingError] = useState<string | null>(null);
  const [comparisonBasis, setComparisonBasis] = useState<ComparisonBasis>("nominal");
  const [retailComparisons, setRetailComparisons] = useState<RetailComparisonByBasis>({
    nominal: initialRetailComparisonNominal,
    ppp: initialRetailComparisonPpp
  });
  const [wholesaleComparison, setWholesaleComparison] =
    useState<WholesaleComparisonResponse | null>(initialWholesaleComparison);
  const [retailMethodology, setRetailMethodology] =
    useState<MethodologyMetadataResponse | null>(initialRetailMethodology);
  const [comparisonLoading, setComparisonLoading] = useState(
    !(
      initialRetailComparisonNominal &&
      initialRetailComparisonPpp &&
      initialWholesaleComparison &&
      initialRetailMethodology
    )
  );
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [clockLabel, setClockLabel] = useState("AEST --:--:--");
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([]);
  const skipInitialEnergyFetch = useRef(initialEnergyOverview !== null);
  const skipInitialHousingFetch = useRef(initialHousingOverview !== null);
  const skipInitialComparisonFetch = useRef(
    initialRetailComparisonNominal !== null &&
      initialRetailComparisonPpp !== null &&
      initialWholesaleComparison !== null &&
      initialRetailMethodology !== null
  );
  const lineCounterRef = useRef(1000);
  const latestEnergyFeedKeyRef = useRef<string | null>(null);
  const latestHousingFeedKeyRef = useRef<string | null>(null);

  const appendFeedEntry = useCallback((entry: Omit<FeedEntry, "lineNumber">) => {
    const lineNumber = lineCounterRef.current + 1;
    lineCounterRef.current = lineNumber;
    setFeedEntries((currentEntries) => {
      const nextEntries = [...currentEntries, { ...entry, lineNumber }];
      return nextEntries.slice(-50);
    });
  }, []);

  useEffect(() => {
    if (skipInitialEnergyFetch.current) {
      skipInitialEnergyFetch.current = false;
      return;
    }

    const abortController = new AbortController();

    async function loadEnergyOverview() {
      setEnergyLoading(true);
      setEnergyError(null);
      setEnergyOverview(null);

      try {
        const response = await fetch(buildOverviewUrl("/api/energy/overview", region), {
          signal: abortController.signal,
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`energy overview request failed with ${response.status}`);
        }

        const payload = parseEnergyOverviewResponse(await response.json());
        if (!payload) {
          throw new Error("invalid energy overview response");
        }
        setEnergyOverview(payload);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        setEnergyError("DATA_UNAVAILABLE");
        appendFeedEntry({
          action: "ENERGY_OVERVIEW",
          deltaText: "DATA_UNAVAILABLE",
          entity: region,
          prefix: "!",
          timestamp: new Date().toISOString(),
          variant: "error",
          volume: 0
        });
      } finally {
        if (!abortController.signal.aborted) {
          setEnergyLoading(false);
        }
      }
    }

    void loadEnergyOverview();

    return () => {
      abortController.abort();
    };
  }, [appendFeedEntry, region]);

  useEffect(() => {
    if (skipInitialHousingFetch.current) {
      skipInitialHousingFetch.current = false;
      return;
    }

    const abortController = new AbortController();

    async function loadHousingOverview() {
      setHousingLoading(true);
      setHousingError(null);
      setHousingOverview(null);

      try {
        const response = await fetch(buildOverviewUrl("/api/housing/overview", region), {
          signal: abortController.signal,
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`housing overview request failed with ${response.status}`);
        }

        const payload = parseHousingOverviewResponse(await response.json());
        if (!payload) {
          throw new Error("invalid housing overview response");
        }
        setHousingOverview(payload);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        setHousingError("DATA_UNAVAILABLE");
        appendFeedEntry({
          action: "HOUSING_OVERVIEW",
          deltaText: "DATA_UNAVAILABLE",
          entity: region,
          prefix: "!",
          timestamp: new Date().toISOString(),
          variant: "error",
          volume: 0
        });
      } finally {
        if (!abortController.signal.aborted) {
          setHousingLoading(false);
        }
      }
    }

    void loadHousingOverview();

    return () => {
      abortController.abort();
    };
  }, [appendFeedEntry, region]);

  useEffect(() => {
    if (skipInitialComparisonFetch.current) {
      skipInitialComparisonFetch.current = false;
      return;
    }

    const abortController = new AbortController();

    async function loadComparisons() {
      setComparisonLoading(true);
      setComparisonError(null);

      const [nominalResult, pppResult, wholesaleResult, methodologyResult] =
        await Promise.allSettled([
          fetch(buildRetailComparisonUrl("nominal"), {
            signal: abortController.signal,
            cache: "no-store"
          }),
          fetch(buildRetailComparisonUrl("ppp"), {
            signal: abortController.signal,
            cache: "no-store"
          }),
          fetch(buildWholesaleComparisonUrl(), {
            signal: abortController.signal,
            cache: "no-store"
          }),
          fetch(buildMethodologyUrl("energy.compare.retail"), {
            signal: abortController.signal,
            cache: "no-store"
          })
        ]);

      if (abortController.signal.aborted) {
        return;
      }

      let hasPartialFailure = false;

      const nominal =
        nominalResult.status === "fulfilled" && nominalResult.value.ok
          ? parseRetailComparisonResponse(await nominalResult.value.json())
          : null;
      if (!nominal) {
        hasPartialFailure = true;
      }

      const ppp =
        pppResult.status === "fulfilled" && pppResult.value.ok
          ? parseRetailComparisonResponse(await pppResult.value.json())
          : null;
      if (!ppp) {
        hasPartialFailure = true;
      }

      const wholesale =
        wholesaleResult.status === "fulfilled" && wholesaleResult.value.ok
          ? parseWholesaleComparisonResponse(await wholesaleResult.value.json())
          : null;
      if (!wholesale) {
        hasPartialFailure = true;
      }

      const methodology =
        methodologyResult.status === "fulfilled" && methodologyResult.value.ok
          ? parseMethodologyMetadataResponse(await methodologyResult.value.json())
          : null;
      if (!methodology) {
        hasPartialFailure = true;
      }

      setRetailComparisons({
        nominal,
        ppp
      });
      setWholesaleComparison(wholesale);
      setRetailMethodology(methodology);
      setComparisonError(hasPartialFailure ? "PARTIAL_COMPARISON_DATA" : null);
      setComparisonLoading(false);
    }

    void loadComparisons();

    return () => {
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("subject") === subject) {
      return;
    }

    params.set("subject", subject);
    const search = params.toString();
    const nextUrl = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, [subject]);

  useEffect(() => {
    function syncClock() {
      setClockLabel(formatAestClock(new Date()));
    }

    syncClock();
    const timer = window.setInterval(syncClock, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!energyOverview) {
      return;
    }

    const feedKey = [
      energyOverview.region,
      energyOverview.freshness.updatedAt,
      energyOverview.panels.liveWholesale.valueAudMwh
    ].join("|");
    if (latestEnergyFeedKeyRef.current === feedKey) {
      return;
    }
    latestEnergyFeedKeyRef.current = feedKey;

    appendFeedEntry({
      action: "ENERGY_OVERVIEW",
      deltaText: formatAudMwh(energyOverview.panels.liveWholesale.valueAudMwh),
      entity: energyOverview.region,
      prefix: "+",
      timestamp: energyOverview.freshness.updatedAt,
      variant: "new",
      volume: Math.max(1, Math.round(energyOverview.panels.liveWholesale.valueCKwh))
    });
  }, [appendFeedEntry, energyOverview]);

  useEffect(() => {
    if (!housingOverview) {
      return;
    }

    const feedKey = [
      housingOverview.region,
      housingOverview.updatedAt ?? "none",
      housingOverview.metrics.length,
      housingOverview.missingSeriesIds.length
    ].join("|");
    if (latestHousingFeedKeyRef.current === feedKey) {
      return;
    }
    latestHousingFeedKeyRef.current = feedKey;

    appendFeedEntry({
      action: "HOUSING_OVERVIEW",
      deltaText: `metrics:${housingOverview.metrics.length}`,
      entity: housingOverview.region,
      prefix: "+",
      timestamp: housingOverview.updatedAt ?? new Date().toISOString(),
      variant: housingOverview.missingSeriesIds.length === 0 ? "new" : "neutral",
      volume: housingOverview.metrics.length
    });
  }, [appendFeedEntry, housingOverview]);

  const energyRows = buildEnergyMetricRows(energyOverview);
  const housingRows = buildHousingMetricRows(housingOverview);
  const dataHealthRows = buildDataHealthRows(energyOverview, housingOverview);
  const activeRetailComparison = retailComparisons[comparisonBasis];
  const comparisonMethodologyVersion =
    activeRetailComparison?.methodologyVersion ??
    retailMethodology?.methodologyVersion ??
    "--";
  const comparisonFreshness = energyOverview?.freshness.status.toUpperCase() ?? "UNKNOWN";
  const streamCount =
    (energyOverview ? 4 : 0) +
    (housingOverview ? housingOverview.metrics.length : 0) +
    (activeRetailComparison ? activeRetailComparison.rows.length : 0);

  return (
    <main className="dashboard-root">
      <div className="dashboard-app-container">
        <header className="dashboard-header-bar">
          <div className="dashboard-breadcrumbs" aria-label="Breadcrumb">
            <span className="dashboard-breadcrumb-item">sys</span>
            <span className="dashboard-breadcrumb-item">dashboard</span>
            <span className="dashboard-breadcrumb-item is-active">australia_live / econ</span>
          </div>

          <div className="dashboard-header-tools">
            <label htmlFor="region-select" className="dashboard-region-label">
              Region
            </label>
            <select
              id="region-select"
              value={region}
              onChange={(event) => setRegion(event.target.value as RegionCode)}
              className="dashboard-region-select"
            >
              {REGIONS.map((regionCode) => (
                <option key={regionCode} value={regionCode}>
                  {regionCode}
                </option>
              ))}
            </select>
            <span className="dashboard-streams-label">{streamCount} data streams active</span>
            <span className="dashboard-clock">{clockLabel}</span>
            <div className="dashboard-status-pill" role="status" aria-live="polite">
              <span className="dashboard-status-dot" aria-hidden />
              <span>ONLINE</span>
            </div>
          </div>
        </header>

        <section className="dashboard-main">
          <section className="dashboard-panel dashboard-economic-panel">
            <div className="dashboard-panel-header">
              <span>Economic Feed</span>
              <span className="dashboard-text-dim">{clockLabel}</span>
            </div>

            <div className="dashboard-panel-content" aria-live="polite">
              <div className="dashboard-subject-tabs" role="tablist" aria-label="Subject">
                {SUBJECT_TABS.map((tab) => {
                  const isActive = subject === tab;
                  const label = tab === "energy" ? "Energy" : "Housing";
                  return (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={[
                        "dashboard-subject-tab",
                        isActive ? "is-active" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setSubject(tab)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSubject(tab);
                        }
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {subject === "energy" ? (
                <>
                  {energyLoading && !energyOverview ? (
                    <div className="dashboard-loading-state">SYNCING...</div>
                  ) : null}
                  {energyError ? <div className="dashboard-error-state">{energyError}</div> : null}

                  <div className="dashboard-subsection-header">
                    <span>ENERGY_OVERVIEW</span>
                    <span className="dashboard-text-dim">{region}</span>
                  </div>

                  {energyRows.map((row) => (
                    <article key={row.id} className="dashboard-metric-row">
                      <div className="dashboard-metric-row-main">
                        <div className="dashboard-metric-copy">
                          <span className="dashboard-metric-title">{row.title}</span>
                          <span className="dashboard-metric-hint">{row.hint}</span>
                          <span className="dashboard-metric-label">{row.label}</span>
                        </div>
                        <span
                          className={[
                            "dashboard-metric-value",
                            row.positive ? "dashboard-text-green" : "dashboard-text-red"
                          ].join(" ")}
                        >
                          {row.value}
                        </span>
                      </div>
                      <div className="dashboard-metric-bar" aria-hidden>
                        <div
                          className={[
                            "dashboard-metric-fill",
                            row.positive ? "is-positive" : "is-negative"
                          ].join(" ")}
                          style={{ width: `${row.barWidth}%` }}
                        />
                      </div>
                      <div className="dashboard-metric-footer">
                        <span className="dashboard-text-dim">{row.previous}</span>
                        <span
                          className={[
                            "dashboard-metric-change",
                            row.positive ? "dashboard-text-green" : "dashboard-text-red"
                          ].join(" ")}
                        >
                          {row.change}
                        </span>
                      </div>
                    </article>
                  ))}

                  <div className="dashboard-subsection-header">
                    <span>AU_VS_GLOBAL_COMPARISON</span>
                    <span className="dashboard-text-dim">{COMPARISON_COUNTRY}</span>
                  </div>

                  <div className="dashboard-comparison-controls">
                    <button
                      type="button"
                      className={[
                        "dashboard-comparison-basis-button",
                        comparisonBasis === "nominal" ? "is-active" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setComparisonBasis("nominal")}
                    >
                      Nominal
                    </button>
                    <button
                      type="button"
                      className={[
                        "dashboard-comparison-basis-button",
                        comparisonBasis === "ppp" ? "is-active" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setComparisonBasis("ppp")}
                    >
                      PPP
                    </button>
                  </div>

                  {comparisonLoading ? (
                    <div className="dashboard-loading-state">COMPARISON_SYNCING...</div>
                  ) : null}
                  {comparisonError ? (
                    <div className="dashboard-warning-state">{comparisonError}</div>
                  ) : null}
                  {comparisonError ? (
                    <div className="dashboard-warning-detail">
                      Some peer data is unavailable for the selected basis. Values shown below
                      are the peers currently available.
                    </div>
                  ) : null}

                  <div className="dashboard-comparison-badges">
                    <span className="dashboard-comparison-badge">
                      {activeRetailComparison?.taxStatus ?? "--"}
                    </span>
                    <span className="dashboard-comparison-badge">
                      {activeRetailComparison?.consumptionBand ?? "--"}
                    </span>
                    <span className="dashboard-comparison-badge">
                      {comparisonMethodologyVersion}
                    </span>
                    <span className="dashboard-comparison-badge">{comparisonFreshness}</span>
                  </div>

                  <div className="dashboard-comparison-summary">
                    <span>
                      AU retail rank: {activeRetailComparison?.auRank ?? "--"} /{" "}
                      {activeRetailComparison?.rows.length ?? "--"}
                    </span>
                    <span>Lower USD/kWh is better</span>
                  </div>

                  {activeRetailComparison?.rows.map((row) => (
                    <article
                      key={`retail-compare-${row.countryCode}`}
                      className="dashboard-metric-row"
                    >
                      <div className="dashboard-metric-row-main">
                        <div className="dashboard-metric-copy">
                          <span className="dashboard-metric-title">{row.countryCode}</span>
                          <span className="dashboard-metric-hint">Peer market</span>
                          <span className="dashboard-metric-label">PEER_MARKET</span>
                        </div>
                        <span className="dashboard-metric-value">
                          {formatComparisonValue(row.value, comparisonBasis)}
                        </span>
                      </div>
                      <div className="dashboard-metric-footer">
                        <span className="dashboard-text-dim">rank #{row.rank}</span>
                        <span className="dashboard-text-dim">
                          au rank {activeRetailComparison.auRank ?? "--"}
                        </span>
                      </div>
                    </article>
                  ))}

                  <div className="dashboard-sector-row">
                    <span className="dashboard-metric-label">AU_WHOLESALE_PERCENTILE</span>
                    <span className="dashboard-text-primary">
                      {wholesaleComparison?.auPercentile ?? "--"}
                    </span>
                  </div>
                </>
              ) : null}

              {subject === "housing" ? (
                <>
                  <div className="dashboard-subsection-header">
                    <span>HOUSING_OVERVIEW</span>
                    <span className="dashboard-text-dim">{region}</span>
                  </div>

                  {housingLoading && !housingOverview ? (
                    <div className="dashboard-loading-state">SYNCING...</div>
                  ) : null}
                  {housingError ? <div className="dashboard-error-state">{housingError}</div> : null}

                  {housingRows.map((row) => (
                    <article key={row.label} className="dashboard-housing-row">
                      <div className="dashboard-metric-row-main">
                        <div className="dashboard-metric-copy">
                          <span className="dashboard-metric-title">{row.title}</span>
                          <span className="dashboard-metric-hint">{row.hint}</span>
                          <span className="dashboard-metric-label">{row.label}</span>
                        </div>
                        <span
                          className={[
                            "dashboard-metric-value",
                            row.valueAlert ? "dashboard-text-red" : "dashboard-text-primary"
                          ].join(" ")}
                        >
                          {row.value}
                        </span>
                      </div>
                      <div className="dashboard-housing-meta">
                        <span className="dashboard-text-dim">{row.delta}</span>
                      </div>
                    </article>
                  ))}
                </>
              ) : null}

              <div className="dashboard-subsection-header dashboard-subsection-push">
                <span>DATA_HEALTH</span>
                <span className="dashboard-text-dim">LIVE</span>
              </div>

              {dataHealthRows.map((row) => (
                <div key={row.label} className="dashboard-sector-row">
                  <span className="dashboard-metric-label">{row.label}</span>
                  <span className={row.positive ? "dashboard-text-green" : "dashboard-text-red"}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="dashboard-map-column">
            <div className="dashboard-map-topbar">
              <span>Australia / Geospatial</span>
              <span className="dashboard-text-dim">SVG | LIVE</span>
            </div>

            <section className="dashboard-map-container" aria-label="Australia sector map">
              <AustraliaSectorMap
                region={region}
                onSelectRegion={(nextRegion) => setRegion(nextRegion)}
              />
            </section>

            <div className="dashboard-map-bottombar">
              <span>Energy: {energyOverview?.freshness.status ?? "--"}</span>
              <span>Energy as_of: {energyOverview?.freshness.updatedAt ?? "--"}</span>
              <span>Housing as_of: {housingOverview?.updatedAt ?? "--"}</span>
              <span className="dashboard-map-node-count">
                Missing series: {housingOverview?.missingSeriesIds.length ?? "--"}
              </span>
            </div>

            <div className="dashboard-region-sync" aria-live="polite">
              <span>Housing region: {region}</span>
              <span>Energy region: {region}</span>
            </div>
          </section>

          <section className="dashboard-panel dashboard-live-feed-panel" aria-label="Live feed logs">
            <div className="dashboard-panel-header">
              <span>Live Feed</span>
              <span className="dashboard-text-dim">tail -f</span>
            </div>

            <div className="dashboard-panel-content dashboard-log-feed" id="log-feed-container">
              {feedEntries.map((entry) => (
                <div
                  key={entry.lineNumber}
                  className={[
                    "dashboard-log-entry",
                    entry.variant === "new" ? "is-new" : "",
                    entry.variant === "error" ? "is-error" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="dashboard-log-line-number">{entry.lineNumber}</div>
                  <div className="dashboard-log-line-content">
                    <span
                      className={[
                        "dashboard-log-prefix",
                        entry.prefix === "+"
                          ? "is-positive"
                          : entry.prefix === "-" || entry.prefix === "!"
                            ? "is-negative"
                            : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {entry.prefix || " "}
                    </span>
                    <span className="dashboard-text-dim">{formatLogTime(entry.timestamp)}</span>
                    <span className="dashboard-token-key">{entry.action}</span>
                    <span className="dashboard-text-dim">:</span>
                    <span className="dashboard-token-value">{entry.entity}</span>
                    <span className="dashboard-text-dim">-&gt;</span>
                    <span
                      className={
                        entry.variant === "error"
                          ? "dashboard-text-red"
                          : entry.variant === "new"
                            ? "dashboard-text-green"
                            : "dashboard-text-secondary"
                      }
                    >
                      {entry.deltaText}
                    </span>
                    <span className="dashboard-text-dim">vol:{entry.volume}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <div className="dashboard-input-bar">
          <div className="dashboard-input-wrapper">
            <span className="dashboard-input-icon" aria-hidden>
              &gt;
            </span>
            <input
              type="text"
              placeholder="Filter logs or execute command..."
              spellCheck={false}
              aria-label="Filter logs or execute command"
            />
          </div>
        </div>

        <footer className="dashboard-footer">
          <span className="dashboard-shortcut">
            <span className="dashboard-key">/</span>search
          </span>
          <span className="dashboard-shortcut">
            <span className="dashboard-key">esc</span>clear
          </span>
          <span className="dashboard-shortcut">
            <span className="dashboard-key">m</span>map view
          </span>
          <span className="dashboard-footer-version">v2.4.0-stable</span>
        </footer>
      </div>
    </main>
  );
}
