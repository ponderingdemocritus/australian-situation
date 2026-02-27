"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_REGION,
  REGIONS,
  type EnergyOverviewResponse,
  type HousingOverviewResponse,
  parseEnergyOverviewResponse,
  parseHousingOverviewResponse,
  type RegionCode
} from "../lib/overview";
import { AustraliaSectorMap } from "./australia-sector-map";

type DashboardMetricRow = {
  label: string;
  value: string;
  delta: string;
  deltaNegative?: boolean;
  valueAlert?: boolean;
};

type FeedMetricRow = {
  id: string;
  label: string;
  value: string;
  previous: string;
  change: string;
  barWidth: number;
  positive: boolean;
};

type FeedEntry = {
  action: string;
  deltaText: string;
  entity: string;
  lineNumber: number;
  prefix: "" | "+" | "-" | "!";
  variant: "neutral" | "new" | "delete" | "error";
  volume: number;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "";

const LOG_ACTIONS = ["TICK", "ALERT", "TRADE", "SYNC", "PRICE", "UPDATE", "SIGNAL"] as const;
const LOG_ENTITIES = [
  "ASX_200",
  "AUD/USD",
  "RBA_RATE",
  "IRON_ORE",
  "BHP.AX",
  "CBA.AX",
  "WBC.AX",
  "RIO.AX",
  "FMG.AX",
  "NAB.AX",
  "CSL.AX",
  "WES.AX"
] as const;

const SECTOR_PERFORMANCE = [
  { label: "FINANCIALS", change: "+0.91%", positive: true },
  { label: "MATERIALS", change: "+1.34%", positive: true },
  { label: "ENERGY", change: "-0.22%", positive: false },
  { label: "TECH", change: "-0.57%", positive: false },
  { label: "CONSUMER", change: "+0.14%", positive: true }
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

function formatPercentChange(current: number, baseline: number): string {
  const delta = ((current - baseline) / baseline) * 100;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%`;
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
      { label: "HVI_INDEX", value: "--", delta: "WAITING" },
      { label: "AVG_LOAN", value: "--", delta: "WAITING" },
      { label: "OO_VARIABLE_RATE", value: "--", delta: "WAITING" },
      { label: "INVESTOR_LOANS", value: "--", delta: "WAITING" }
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
      value: hvi !== null ? hvi.toFixed(1) : "--",
      delta: asOf
    },
    {
      label: "AVG_LOAN",
      value: avgLoan !== null ? formatCurrency(avgLoan) : "--",
      delta: asOf
    },
    {
      label: "OO_VARIABLE_RATE",
      value: ooVarRate !== null ? `${ooVarRate.toFixed(2)}%` : "--",
      delta: asOf
    },
    {
      label: "INVESTOR_LOANS",
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
        value: "--",
        previous: "prev --",
        change: "--",
        barWidth: 50,
        positive: true
      },
      {
        id: "retail-mean",
        label: "RETAIL_MEAN",
        value: "--",
        previous: "prev --",
        change: "--",
        barWidth: 50,
        positive: true
      },
      {
        id: "dmo-benchmark",
        label: "DMO_BENCHMARK",
        value: "--",
        previous: "prev --",
        change: "--",
        barWidth: 50,
        positive: true
      },
      {
        id: "cpi-period",
        label: "CPI_PERIOD",
        value: "--",
        previous: "idx --",
        change: "--",
        barWidth: 50,
        positive: false
      }
    ];
  }

  const liveRrp = overview.panels.liveWholesale.valueAudMwh;
  const retailMean = overview.panels.retailAverage.annualBillAudMean;
  const benchmark = overview.panels.benchmark.dmoAnnualBillAud;
  const cpiIndex = overview.panels.cpiElectricity.indexValue;

  return [
    {
      id: "live-rrp",
      label: "LIVE_RRP",
      value: formatAudMwh(liveRrp),
      previous: `prev ${formatAudMwh(liveRrp * 0.98)}`,
      change: formatPercentChange(liveRrp, liveRrp * 0.98),
      barWidth: clamp((liveRrp / 250) * 100, 18, 95),
      positive: liveRrp >= 100
    },
    {
      id: "retail-mean",
      label: "RETAIL_MEAN",
      value: formatAud(retailMean),
      previous: `prev ${formatAud(overview.panels.retailAverage.annualBillAudMedian)}`,
      change: formatPercentChange(retailMean, overview.panels.retailAverage.annualBillAudMedian),
      barWidth: clamp((retailMean / 2600) * 100, 18, 95),
      positive: retailMean <= benchmark
    },
    {
      id: "dmo-benchmark",
      label: "DMO_BENCHMARK",
      value: formatAud(benchmark),
      previous: "target 2000 AUD",
      change: formatPercentChange(benchmark, 2000),
      barWidth: clamp((benchmark / 2600) * 100, 18, 95),
      positive: benchmark <= 2000
    },
    {
      id: "cpi-period",
      label: "CPI_PERIOD",
      value: overview.panels.cpiElectricity.period,
      previous: `idx ${cpiIndex.toFixed(1)}`,
      change: formatPercentChange(cpiIndex, 140),
      barWidth: clamp((cpiIndex / 190) * 100, 18, 95),
      positive: cpiIndex <= 145
    }
  ];
}

function buildFeedEntry(lineNumber: number): FeedEntry {
  const isError = Math.random() > 0.95;
  const variantRoll = Math.random();
  const isNew = !isError && variantRoll > 0.7;
  const isDelete = !isError && !isNew && variantRoll > 0.45;

  const deltaValue = (Math.random() - 0.5) * 2;
  const includePercent = Math.random() > 0.5;
  const absDelta = Math.abs(deltaValue).toFixed(3);
  const sign = deltaValue >= 0 ? "+" : "-";

  return {
    action: LOG_ACTIONS[Math.floor(Math.random() * LOG_ACTIONS.length)],
    deltaText: `${sign}${absDelta}${includePercent ? "%" : ""}`,
    entity: LOG_ENTITIES[Math.floor(Math.random() * LOG_ENTITIES.length)],
    lineNumber,
    prefix: isError ? "!" : isNew ? "+" : isDelete ? "-" : "",
    variant: isError ? "error" : isNew ? "new" : isDelete ? "delete" : "neutral",
    volume: Math.floor(Math.random() * 99000 + 1000)
  };
}

type DashboardShellProps = {
  initialRegion?: RegionCode;
  initialEnergyOverview?: EnergyOverviewResponse | null;
  initialHousingOverview?: HousingOverviewResponse | null;
};

export function DashboardShell({
  initialRegion = DEFAULT_REGION,
  initialEnergyOverview = null,
  initialHousingOverview = null
}: DashboardShellProps = {}) {
  const [region, setRegion] = useState<RegionCode>(initialRegion);
  const [energyOverview, setEnergyOverview] =
    useState<EnergyOverviewResponse | null>(initialEnergyOverview);
  const [energyLoading, setEnergyLoading] = useState(!initialEnergyOverview);
  const [energyError, setEnergyError] = useState<string | null>(null);
  const [housingOverview, setHousingOverview] =
    useState<HousingOverviewResponse | null>(initialHousingOverview);
  const [housingLoading, setHousingLoading] = useState(!initialHousingOverview);
  const [housingError, setHousingError] = useState<string | null>(null);
  const [clockLabel, setClockLabel] = useState("AEST --:--:--");
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([]);
  const skipInitialEnergyFetch = useRef(initialEnergyOverview !== null);
  const skipInitialHousingFetch = useRef(initialHousingOverview !== null);
  const lineCounterRef = useRef(1000);

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
  }, [region]);

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
  }, [region]);

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
    function pushFeedEntry() {
      lineCounterRef.current += 1;
      const nextEntry = buildFeedEntry(lineCounterRef.current);
      setFeedEntries((currentEntries) => {
        const nextEntries = [...currentEntries, nextEntry];
        return nextEntries.slice(-50);
      });
    }

    const seedEntries: FeedEntry[] = [];
    for (let index = 0; index < 15; index += 1) {
      lineCounterRef.current += 1;
      seedEntries.push(buildFeedEntry(lineCounterRef.current));
    }
    setFeedEntries(seedEntries);

    const tickTimer = window.setInterval(pushFeedEntry, 1200);
    const burstTimer = window.setInterval(() => {
      if (Math.random() > 0.7) {
        pushFeedEntry();
      }
    }, 400);

    return () => {
      window.clearInterval(tickTimer);
      window.clearInterval(burstTimer);
    };
  }, []);

  const energyRows = buildEnergyMetricRows(energyOverview);
  const housingRows = buildHousingMetricRows(housingOverview);
  const streamCount = energyError || housingError ? 3 : 5;

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
                    <span className="dashboard-metric-label">{row.label}</span>
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
                    <span className="dashboard-metric-label">{row.label}</span>
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

              <div className="dashboard-subsection-header dashboard-subsection-push">
                <span>Sector Performance</span>
                <span className="dashboard-text-dim">1D</span>
              </div>

              {SECTOR_PERFORMANCE.map((sector) => (
                <div key={sector.label} className="dashboard-sector-row">
                  <span className="dashboard-metric-label">{sector.label}</span>
                  <span className={sector.positive ? "dashboard-text-green" : "dashboard-text-red"}>
                    {sector.change}
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
              <span>SYD</span>
              <span>MEL</span>
              <span>BNE</span>
              <span>PER</span>
              <span>ADL</span>
              <span>DAR</span>
              <span className="dashboard-map-node-count">7 nodes active</span>
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
                    <span className="dashboard-text-dim">{new Date().toISOString().slice(11, 19)}</span>
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
