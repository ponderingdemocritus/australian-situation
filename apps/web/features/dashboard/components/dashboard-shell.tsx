"use client";

import { PieBreakdownChart, type PieBreakdownDatum } from "@aus-dash/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_REGION,
  REGIONS,
  STATE_REGIONS,
  type ComparisonBasis,
  type EnergyOverviewResponse,
  type EnergySourceMixView,
  type HousingOverviewResponse,
  type MetadataSourcesResponse,
  type MethodologyMetadataResponse,
  parseEnergyOverviewResponse,
  parseHousingOverviewResponse,
  parseMetadataSourcesResponse,
  parseMethodologyMetadataResponse,
  parseRetailComparisonResponse,
  parseWholesaleComparisonResponse,
  type RetailComparisonResponse,
  type RegionCode,
  type WholesaleComparisonResponse
} from "../lib/overview";
import { DASHBOARD_AREAS, type DashboardAreaId } from "../lib/areas";
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

type ProvenanceRow = {
  sourceId: string;
  detail: string;
};

type RegionEnergyOverviewMap = Partial<Record<RegionCode, EnergyOverviewResponse | null>>;

type SourceMixViewMode = "annual_official" | "operational_nem_wem";

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
const RETAIL_COMPARISON_PEERS = ["US", "DE", "ID", "CN"] as const;
const WHOLESALE_COMPARISON_PEERS = ["US", "DE", "CN"] as const;
const REGION_LABELS: Record<RegionCode, string> = {
  AU: "Australia",
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  SA: "South Australia",
  WA: "Western Australia",
  TAS: "Tasmania",
  ACT: "Australian Capital Territory",
  NT: "Northern Territory"
};

const COUNTRY_LABELS: Record<string, string> = {
  AU: "Australia",
  US: "United States",
  DE: "Germany",
  ID: "Indonesia",
  CN: "China"
};

const COUNTRY_COMPARISON_HINTS: Record<string, string> = {
  CN: "Beijing tariff proxy"
};

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

const SOURCE_MIX_COLORS: Record<string, string> = {
  coal: "#334155",
  gas: "#f97316",
  hydro: "#2563eb",
  wind: "#16a34a",
  solar: "#facc15",
  other_renewables: "#7c3aed",
  oil: "#b45309",
  other: "#64748b"
};

type RetailComparisonByBasis = {
  nominal: RetailComparisonResponse | null;
  ppp: RetailComparisonResponse | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseSubject(raw: string | null | undefined): DashboardAreaId {
  if (raw === "housing") {
    return "housing";
  }
  return "energy";
}

function resolveInitialSubject(): DashboardAreaId {
  if (typeof window === "undefined") {
    return "energy";
  }

  return parseSubject(new URLSearchParams(window.location.search).get("subject"));
}

function buildDashboardUrl(region: RegionCode, subject: DashboardAreaId): string {
  const path = region === "AU" ? "/" : `/${region}`;
  const params = new URLSearchParams({ subject });
  return `${path}?${params.toString()}`;
}

function parseRegionFromPath(pathname: string): RegionCode | null {
  const segment = pathname.split("/").filter(Boolean)[0]?.toUpperCase();
  if (segment && REGIONS.includes(segment as RegionCode)) {
    return segment as RegionCode;
  }
  return null;
}

function formatAud(value: number): string {
  return `${Math.round(value).toLocaleString("en-AU")} AUD`;
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

function formatRegionLabel(region: RegionCode): string {
  return REGION_LABELS[region] ?? region;
}

function formatCountryLabel(countryCode: string): string {
  return COUNTRY_LABELS[countryCode] ?? countryCode;
}

function formatCountryComparisonHint(countryCode: string): string {
  return COUNTRY_COMPARISON_HINTS[countryCode] ?? "Retail electricity price";
}

function formatReadableDate(value: string | null | undefined): string {
  if (!value) {
    return "Update unavailable";
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  const hasTime = value.includes("T");

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(hasTime
      ? {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "Australia/Sydney"
        }
      : {})
  }).format(new Date(parsed));
}

function formatFreshnessLabel(status: EnergyOverviewResponse["freshness"]["status"] | null | undefined) {
  switch (status) {
    case "fresh":
      return "Up to date";
    case "stale":
      return "Needs refresh";
    case "degraded":
      return "Partially available";
    default:
      return "Waiting for data";
  }
}

function formatReadableToken(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }

  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildOverviewUrl(path: string, region: RegionCode): string {
  const params = new URLSearchParams({ region });
  return `${API_BASE_URL}${path}?${params.toString()}`;
}

function buildRetailComparisonUrl(basis: ComparisonBasis): string {
  const params = new URLSearchParams({
    country: COMPARISON_COUNTRY,
    peers: RETAIL_COMPARISON_PEERS.join(","),
    basis,
    tax_status: "incl_tax",
    consumption_band: "household_mid"
  });
  return `${API_BASE_URL}/api/v1/energy/compare/retail?${params.toString()}`;
}

function buildWholesaleComparisonUrl(): string {
  const params = new URLSearchParams({
    country: COMPARISON_COUNTRY,
    peers: WHOLESALE_COMPARISON_PEERS.join(",")
  });
  return `${API_BASE_URL}/api/v1/energy/compare/wholesale?${params.toString()}`;
}

function buildMethodologyUrl(metric: string): string {
  const params = new URLSearchParams({ metric });
  return `${API_BASE_URL}/api/v1/metadata/methodology?${params.toString()}`;
}

function buildMetadataSourcesUrl(): string {
  return `${API_BASE_URL}/api/metadata/sources`;
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

function buildProvenanceRows(
  energyOverview: EnergyOverviewResponse | null,
  metadataSources: MetadataSourcesResponse | null
): ProvenanceRow[] {
  if (!energyOverview || energyOverview.sourceRefs.length === 0) {
    return [];
  }

  const metadataById = new Map(
    metadataSources?.sources.map((source) => [source.sourceId, source]) ?? []
  );

  return energyOverview.sourceRefs.map((sourceRef) => {
    const metadata = metadataById.get(sourceRef.sourceId);
    return {
      sourceId: sourceRef.sourceId,
      detail: [
        metadata?.name ?? sourceRef.name,
        metadata?.expectedCadence ?? "unknown cadence",
        metadata?.domain ?? "unknown"
      ].join(" · ")
    };
  });
}

function buildStateEnergyRows(
  stateEnergyOverviews: RegionEnergyOverviewMap,
  activeRegion: RegionCode
) {
  return STATE_REGIONS.map((stateRegion) => {
    const overview = stateEnergyOverviews[stateRegion] ?? null;

    return {
      region: stateRegion,
      annualBillLabel: overview
        ? formatCurrency(overview.panels.retailAverage.annualBillAudMean)
        : "--",
      detail: overview
        ? `RRP ${formatAudMwh(overview.panels.liveWholesale.valueAudMwh)}`
        : "WAITING",
      freshness: overview?.freshness.status.toUpperCase() ?? "WAITING",
      isActive: activeRegion === stateRegion
    };
  });
}

function buildSelectedEnergyRow(region: RegionCode, overview: EnergyOverviewResponse | null) {
  if (!overview) {
    return null;
  }

  return {
    region,
    annualBillLabel: formatCurrency(overview.panels.retailAverage.annualBillAudMean),
    detail: `RRP ${formatAudMwh(overview.panels.liveWholesale.valueAudMwh)}`,
    freshness: overview.freshness.status.toUpperCase(),
    isActive: true
  };
}

function findSourceMixView(
  overview: EnergyOverviewResponse | null,
  viewId: SourceMixViewMode
): EnergySourceMixView | null {
  return overview?.sourceMixViews.find((view) => view.viewId === viewId) ?? null;
}

function getSourceMixColor(sourceKey: string): string {
  return SOURCE_MIX_COLORS[sourceKey] ?? "#94a3b8";
}

function buildSourceMixChartData(view: EnergySourceMixView | null): PieBreakdownDatum[] {
  return (
    view?.rows.map((row) => ({
      key: row.sourceKey,
      label: row.label,
      value: row.sharePct,
      color: getSourceMixColor(row.sourceKey)
    })) ?? []
  );
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
  initialMetadataSources?: MetadataSourcesResponse | null;
  initialStateEnergyOverviews?: RegionEnergyOverviewMap;
};

function MetricSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="dashboard-skeleton-row">
          <div>
            <div className="dashboard-skeleton-block dashboard-skeleton-title" />
            <div className="dashboard-skeleton-block dashboard-skeleton-hint" />
          </div>
          <div className="dashboard-skeleton-block dashboard-skeleton-value" />
        </div>
      ))}
    </>
  );
}

export function DashboardShell({
  initialRegion = DEFAULT_REGION,
  initialEnergyOverview = null,
  initialHousingOverview = null,
  initialRetailComparisonNominal = null,
  initialRetailComparisonPpp = null,
  initialWholesaleComparison = null,
  initialRetailMethodology = null,
  initialMetadataSources = null,
  initialStateEnergyOverviews = {}
}: DashboardShellProps = {}) {
  const [region, setRegionState] = useState<RegionCode>(initialRegion);
  const [subject, setSubject] = useState<DashboardAreaId>(() => resolveInitialSubject());
  const setRegion = useCallback(
    (nextRegion: RegionCode, pushUrl = true) => {
      setRegionState(nextRegion);
      if (pushUrl && typeof window !== "undefined") {
        const subjectParam = parseSubject(
          new URLSearchParams(window.location.search).get("subject")
        );
        window.history.pushState({}, "", buildDashboardUrl(nextRegion, subjectParam));
      }
    },
    []
  );
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
  const [metadataSources, setMetadataSources] =
    useState<MetadataSourcesResponse | null>(initialMetadataSources);
  const [stateEnergyOverviews, setStateEnergyOverviews] = useState<RegionEnergyOverviewMap>(
    initialStateEnergyOverviews
  );
  const [sourceMixView, setSourceMixView] = useState<SourceMixViewMode>("annual_official");
  const [stateEnergyLoading, setStateEnergyLoading] = useState(
    !REGIONS.every((targetRegion) => targetRegion in initialStateEnergyOverviews)
  );
  const [stateEnergyError, setStateEnergyError] = useState<string | null>(null);
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
  const skipInitialMetadataSourcesFetch = useRef(initialMetadataSources !== null);
  const skipInitialStateEnergyFetch = useRef(
    REGIONS.every((targetRegion) => targetRegion in initialStateEnergyOverviews)
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
      } catch {
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
      } catch {
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
    if (skipInitialMetadataSourcesFetch.current) {
      skipInitialMetadataSourcesFetch.current = false;
      return;
    }

    const abortController = new AbortController();

    async function loadMetadataSources() {
      try {
        const response = await fetch(buildMetadataSourcesUrl(), {
          signal: abortController.signal,
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error(`metadata sources request failed with ${response.status}`);
        }

        const payload = parseMetadataSourcesResponse(await response.json());
        if (!payload) {
          throw new Error("invalid metadata sources response");
        }

        setMetadataSources(payload);
      } catch {
        if (!abortController.signal.aborted) {
          setMetadataSources(null);
        }
      }
    }

    void loadMetadataSources();

    return () => {
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    if (skipInitialStateEnergyFetch.current) {
      skipInitialStateEnergyFetch.current = false;
      return;
    }

    const abortController = new AbortController();

    async function loadStateEnergyOverviews() {
      setStateEnergyLoading(true);
      setStateEnergyError(null);

      try {
        const entries = await Promise.all(
          REGIONS.map(async (targetRegion) => {
            const response = await fetch(buildOverviewUrl("/api/energy/overview", targetRegion), {
              signal: abortController.signal,
              cache: "no-store"
            });
            if (!response.ok) {
              return [targetRegion, null] as const;
            }

            return [
              targetRegion,
              parseEnergyOverviewResponse(await response.json())
            ] as const;
          })
        );

        if (abortController.signal.aborted) {
          return;
        }

        setStateEnergyOverviews(
          Object.fromEntries(entries) as RegionEnergyOverviewMap
        );
      } catch {
        if (abortController.signal.aborted) {
          return;
        }

        setStateEnergyError("STATE_DATA_UNAVAILABLE");
      } finally {
        if (!abortController.signal.aborted) {
          setStateEnergyLoading(false);
        }
      }
    }

    void loadStateEnergyOverviews();

    return () => {
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.history.replaceState({}, "", buildDashboardUrl(region, subject));
  }, [subject]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handlePopState() {
      const regionFromPath = parseRegionFromPath(window.location.pathname);
      const nextRegion = regionFromPath ?? DEFAULT_REGION;
      setRegion(nextRegion, false);

      const nextSubject = parseSubject(
        new URLSearchParams(window.location.search).get("subject")
      );
      setSubject(nextSubject);
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [setRegion]);

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
  const provenanceRows = buildProvenanceRows(energyOverview, metadataSources);
  const stateEnergyRows = buildStateEnergyRows(stateEnergyOverviews, region);
  const selectedSourceMixView = findSourceMixView(
    energyOverview ?? stateEnergyOverviews[region] ?? null,
    sourceMixView
  );
  const sourceMixChartData = buildSourceMixChartData(selectedSourceMixView);
  const selectedStateEnergyRows = stateEnergyRows.filter((row) => row.region === region);
  const visibleStateEnergyRows =
    selectedStateEnergyRows.length > 0
      ? selectedStateEnergyRows
      : [
          buildSelectedEnergyRow(region, energyOverview ?? stateEnergyOverviews[region] ?? null)
        ].filter((row): row is NonNullable<typeof row> => row !== null);
  const activeRetailComparison = retailComparisons[comparisonBasis];
  const comparisonMethodologyVersion =
    activeRetailComparison?.methodologyVersion ??
    retailMethodology?.methodologyVersion ??
    "--";
  const comparisonFreshness = energyOverview?.freshness.status.toUpperCase() ?? "UNKNOWN";
  const regionLabel = formatRegionLabel(region);
  const subjectLabel = subject === "energy" ? "Energy" : "Housing";
  const headerSummary =
    subject === "energy"
      ? `Track electricity prices, bills, and the energy mix for ${regionLabel}.`
      : `Track housing values, lending pressure, and loan activity for ${regionLabel}.`;
  const statusRows = [
    {
      label: "Energy data freshness",
      value: formatFreshnessLabel(energyOverview?.freshness.status),
      positive: energyOverview?.freshness.status === "fresh"
    },
    {
      label: "Latest energy update",
      value: formatReadableDate(energyOverview?.freshness.updatedAt),
      positive: !!energyOverview
    },
    {
      label: "Latest housing update",
      value: formatReadableDate(housingOverview?.updatedAt),
      positive: !!housingOverview
    },
    {
      label: "Housing coverage gaps",
      value: housingOverview
        ? housingOverview.missingSeriesIds.length === 0
          ? "No gaps"
          : `${housingOverview.missingSeriesIds.length} missing`
        : "Waiting for data",
      positive: !!housingOverview && housingOverview.missingSeriesIds.length === 0
    }
  ];
  const housingCoverageRows = [
    {
      label: "Selected region",
      value: regionLabel
    },
    {
      label: "Latest housing update",
      value: formatReadableDate(housingOverview?.updatedAt)
    },
    {
      label: "Missing series",
      value: housingOverview
        ? housingOverview.missingSeriesIds.length.toLocaleString("en-AU")
        : "--"
    }
  ];
  return (
    <main className="dashboard-root">
      <div className="dashboard-app-shell">
        <header className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <span className="dashboard-eyebrow">{subjectLabel} overview</span>
            <h1 className="dashboard-page-title">Australia situation dashboard</h1>
            <p className="dashboard-page-summary">{headerSummary}</p>
          </div>
          <div className="dashboard-hero-tabs">
            <div className="dashboard-subject-tabs">
              {DASHBOARD_AREAS.map((area) => {
                const isActive = subject === area.id;
                return (
                  <button
                    key={area.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={["dashboard-subject-tab", isActive ? "is-active" : ""]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setSubject(area.id)}
                  >
                    {area.label}
                  </button>
                );
              })}
            </div>
            <div className="dashboard-freshness-badge">
              {formatFreshnessLabel(energyOverview?.freshness.status)}
            </div>
          </div>
        </header>

        <section className="dashboard-main">
          <div className="dashboard-primary-column">
            <section className="dashboard-panel dashboard-summary-panel">
              <div className="dashboard-panel-header">
                <span>Key indicators</span>
                <span className="dashboard-text-muted">{subjectLabel}</span>
              </div>

              <div className="dashboard-panel-body" aria-live="polite">
                {subject === "energy" ? (
                  <>
                    {energyLoading && !energyOverview ? (
                      <MetricSkeleton rows={4} />
                    ) : null}
                    {energyError ? <div className="dashboard-error-state">{energyError}</div> : null}

                    <div className="dashboard-section-heading">
                      <span>Electricity snapshot</span>
                      <span className="dashboard-text-muted">{regionLabel}</span>
                    </div>

                    {energyRows.map((row) => (
                      <article key={row.id} className="dashboard-metric-row">
                        <div className="dashboard-metric-row-main">
                          <div className="dashboard-metric-copy">
                            <span className="dashboard-metric-title">{row.title}</span>
                            <span className="dashboard-metric-hint">{row.hint}</span>
                          </div>
                          <span
                            className={[
                              "dashboard-metric-value",
                              row.positive ? "dashboard-text-green" : "dashboard-text-primary"
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
                          <span className="dashboard-text-muted">{row.previous}</span>
                          <span
                            className={[
                              "dashboard-metric-change",
                              row.positive ? "dashboard-text-green" : "dashboard-text-muted"
                            ].join(" ")}
                          >
                            {row.change}
                          </span>
                        </div>
                      </article>
                    ))}

                    <div className="dashboard-section-heading">
                      <span>Australia compared with peers</span>
                      <div className="dashboard-comparison-controls" style={{ padding: 0 }}>
                        <button
                          type="button"
                          className={["dashboard-comparison-basis-button", comparisonBasis === "nominal" ? "is-active" : ""].filter(Boolean).join(" ")}
                          onClick={() => setComparisonBasis("nominal")}
                        >
                          Nominal
                        </button>
                        <button
                          type="button"
                          className={["dashboard-comparison-basis-button", comparisonBasis === "ppp" ? "is-active" : ""].filter(Boolean).join(" ")}
                          onClick={() => setComparisonBasis("ppp")}
                        >
                          PPP
                        </button>
                      </div>
                    </div>

                    {comparisonLoading ? (
                      <MetricSkeleton rows={4} />
                    ) : null}
                    {comparisonError ? (
                      <div className="dashboard-warning-state">{comparisonError}</div>
                    ) : null}
                    {comparisonError ? (
                      <div className="dashboard-warning-detail">
                        Some peer data is unavailable for the selected basis. The chart keeps the
                        peers that are currently available.
                      </div>
                    ) : null}

                    <div className="dashboard-comparison-badges">
                      <span className="dashboard-comparison-badge">
                        {formatReadableToken(activeRetailComparison?.taxStatus)}
                      </span>
                      <span className="dashboard-comparison-badge">
                        {formatReadableToken(activeRetailComparison?.consumptionBand)}
                      </span>
                      <span className="dashboard-comparison-badge">
                        {formatReadableToken(comparisonMethodologyVersion)}
                      </span>
                      <span className="dashboard-comparison-badge">
                        {formatFreshnessLabel(energyOverview?.freshness.status)}
                      </span>
                    </div>

                    <div className="dashboard-comparison-summary">
                      <span>
                        Australia ranks {activeRetailComparison?.auRank ?? "--"} of{" "}
                        {activeRetailComparison?.rows.length ?? "--"}.
                      </span>
                      <span>Lower USD/kWh means lower retail power costs.</span>
                    </div>

                    {activeRetailComparison?.rows.map((row) => (
                      <article
                        key={`retail-compare-${row.countryCode}`}
                        className="dashboard-metric-row"
                      >
                        <div className="dashboard-metric-row-main">
                          <div className="dashboard-metric-copy">
                            <span className="dashboard-metric-title">
                              {formatCountryLabel(row.countryCode)}
                            </span>
                            <span className="dashboard-metric-hint">
                              {formatCountryComparisonHint(row.countryCode)}
                            </span>
                          </div>
                          <span className="dashboard-metric-value">
                            {formatComparisonValue(row.value, comparisonBasis)}
                          </span>
                        </div>
                        <div className="dashboard-metric-footer">
                          <span className="dashboard-text-muted">Rank #{row.rank}</span>
                          <span className="dashboard-text-muted">
                            Australia rank {activeRetailComparison.auRank ?? "--"}
                          </span>
                        </div>
                      </article>
                    ))}

                    <div className="dashboard-note-card">
                      <div className="dashboard-note-title">Wholesale price percentile</div>
                      <div className="dashboard-note-value">
                        {wholesaleComparison?.auPercentile ?? "--"}
                      </div>
                      <div className="dashboard-note-copy">
                        Australia’s current wholesale position against the selected peers.
                      </div>
                    </div>

                    {energyOverview?.methodSummary ? (
                      <div className="dashboard-warning-detail">{energyOverview.methodSummary}</div>
                    ) : null}
                    {activeRetailComparison?.rows.some((row) => row.countryCode === "CN") ? (
                      <div className="dashboard-warning-detail">
                        China is shown as a proxy: retail uses a Beijing regulated household tariff
                        proxy and wholesale uses an annual NEA market-price proxy.
                      </div>
                    ) : null}

                    {provenanceRows.length > 0 ? (
                      <>
                        <div className="dashboard-section-heading">
                          <span>Data sources</span>
                          <span className="dashboard-text-muted">
                            {provenanceRows.length} sources
                          </span>
                        </div>

                        {provenanceRows.map((row) => (
                          <div key={row.sourceId} className="dashboard-sector-row">
                            <div className="dashboard-source-copy">
                              <span className="dashboard-metric-title">
                                {row.detail.split(" · ")[0]}
                              </span>
                              <span className="dashboard-metric-hint">
                                {row.detail.split(" · ").slice(1).join(" · ")}
                              </span>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : null}
                  </>
                ) : null}

                {subject === "housing" ? (
                  <>
                    <div className="dashboard-section-heading">
                      <span>Housing snapshot</span>
                      <span className="dashboard-text-muted">{regionLabel}</span>
                    </div>

                    {housingLoading && !housingOverview ? (
                      <MetricSkeleton rows={4} />
                    ) : null}
                    {housingError ? <div className="dashboard-error-state">{housingError}</div> : null}

                    {housingRows.map((row) => (
                      <article key={row.label} className="dashboard-housing-row">
                        <div className="dashboard-metric-row-main">
                          <div className="dashboard-metric-copy">
                            <span className="dashboard-metric-title">{row.title}</span>
                            <span className="dashboard-metric-hint">{row.hint}</span>
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
                          <span className="dashboard-text-muted">{row.delta}</span>
                        </div>
                      </article>
                    ))}

                    <div className="dashboard-note-card">
                      <div className="dashboard-note-title">What this housing view covers</div>
                      <div className="dashboard-note-copy">
                        The housing view focuses on prices, lending activity, and mortgage costs
                        for the selected region.
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </section>

            <section className="dashboard-panel">
              <div className="dashboard-panel-header">
                <span>How current is this data?</span>
                <span className="dashboard-text-muted">{comparisonFreshness}</span>
              </div>

              <div className="dashboard-panel-body">
                {statusRows.map((row) => (
                  <div key={row.label} className="dashboard-sector-row">
                    <span className="dashboard-sector-label">{row.label}</span>
                    <span className={row.positive ? "dashboard-text-green" : "dashboard-text-muted"}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="dashboard-secondary-column">
            <section className="dashboard-panel dashboard-map-panel">
              <div className="dashboard-panel-header">
                <span>Choose a region</span>
                <span className="dashboard-text-muted">{regionLabel}</span>
              </div>

              <div className="dashboard-region-intro">
                Select a state or territory to update the dashboard.
              </div>

              <div className="dashboard-region-picker">
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
              </div>

              <section className="dashboard-map-container" aria-label="Australia sector map">
                <AustraliaSectorMap
                  region={region}
                  onSelectRegion={(nextRegion) => setRegion(nextRegion)}
                />
              </section>

              <div className="dashboard-region-summary">
                <span>Selected region: {regionLabel}</span>
                <span>Energy updated: {formatReadableDate(energyOverview?.freshness.updatedAt)}</span>
                <span>Housing updated: {formatReadableDate(housingOverview?.updatedAt)}</span>
              </div>
            </section>

            {subject === "energy" ? (
              <>
                <section className="dashboard-panel">
                  <div className="dashboard-panel-header">
                    <span>State electricity snapshot</span>
                    <span className="dashboard-text-muted">
                      {stateEnergyLoading ? "Loading" : regionLabel}
                    </span>
                  </div>

                  <div className="dashboard-panel-body">
                    {stateEnergyError ? (
                      <div className="dashboard-warning-state">{stateEnergyError}</div>
                    ) : null}

                    {visibleStateEnergyRows.map((row) => (
                      <button
                        key={row.region}
                        type="button"
                        className="dashboard-state-energy-row"
                        data-active={row.isActive}
                        onClick={() => setRegion(row.region)}
                      >
                        <span className="dashboard-state-energy-label">
                          {formatRegionLabel(row.region)}
                        </span>
                        <span className="dashboard-state-energy-value">{row.annualBillLabel}</span>
                        <span className="dashboard-state-energy-detail">{row.detail}</span>
                        <span
                          className={[
                            "dashboard-state-energy-status",
                            row.freshness === "FRESH"
                              ? "dashboard-text-green"
                              : "dashboard-text-muted"
                          ].join(" ")}
                        >
                          {formatFreshnessLabel(
                            row.freshness === "FRESH"
                              ? "fresh"
                              : row.freshness === "WAITING"
                                ? undefined
                                : "stale"
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="dashboard-panel">
                  <div className="dashboard-panel-header">
                    <span>Electricity mix by source</span>
                    <span className="dashboard-text-muted">{regionLabel}</span>
                  </div>

                  <div className="dashboard-panel-body">
                    <div className="dashboard-source-mix-toggle" aria-label="Source mix view">
                      <button
                        type="button"
                        className="dashboard-source-mix-button"
                        data-active={sourceMixView === "annual_official"}
                        onClick={() => setSourceMixView("annual_official")}
                      >
                        Official annual
                      </button>
                      <button
                        type="button"
                        className="dashboard-source-mix-button"
                        data-active={sourceMixView === "operational_nem_wem"}
                        onClick={() => setSourceMixView("operational_nem_wem")}
                      >
                        Operational NEM + WA
                      </button>
                    </div>

                    {stateEnergyError ? (
                      <div className="dashboard-warning-state">{stateEnergyError}</div>
                    ) : null}

                    {sourceMixChartData.length > 0 ? (
                      <div className="dashboard-source-mix-card">
                        <div className="dashboard-source-mix-card-header">
                          <span className="dashboard-metric-title">{regionLabel}</span>
                          <span className="dashboard-text-muted">
                            {sourceMixView === "annual_official"
                              ? formatReadableDate(selectedSourceMixView?.updatedAt)
                              : "Live operational view"}
                          </span>
                        </div>

                        <PieBreakdownChart
                          ariaLabel={`${region} source mix chart`}
                          data={sourceMixChartData}
                          centerLabel={region}
                          className="dashboard-source-mix-breakdown"
                          chartClassName="dashboard-source-mix-chart"
                          hideLegend
                        />

                        <div className="dashboard-source-mix-meta">
                          <span className="dashboard-text-muted">
                            {selectedSourceMixView?.coverageLabel ?? "Waiting for breakdown"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="dashboard-warning-detail">No source mix breakdown available.</div>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                  <span>Housing coverage</span>
                  <span className="dashboard-text-muted">{regionLabel}</span>
                </div>

                <div className="dashboard-panel-body">
                  {housingCoverageRows.map((row) => (
                    <div key={row.label} className="dashboard-sector-row">
                      <span className="dashboard-sector-label">{row.label}</span>
                      <span className="dashboard-text-primary">{row.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
