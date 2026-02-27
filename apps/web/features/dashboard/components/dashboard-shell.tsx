"use client";

import {
  DashboardAlertItem,
  DashboardMetric,
  DashboardNodeRow,
  DashboardPanel,
  DashboardPanelHeader,
  StatusIndicator
} from "@aus-dash/ui";
import { useEffect, useState } from "react";

const REGIONS = ["AU", "NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"] as const;

type RegionCode = (typeof REGIONS)[number];

type DashboardMetricRow = {
  label: string;
  value: string;
  delta: string;
  deltaNegative?: boolean;
  valueAlert?: boolean;
};

type DashboardNode = {
  nodeId: string;
  status: string;
  offline?: boolean;
};

const ALERTS = [
  "WARNING: UNIDENTIFIED SIGNAL DETECTED IN SECTOR 7G",
  "CRITICAL: FIREWALL INTEGRITY AT 45%"
] as const;

const NODES: readonly DashboardNode[] = [
  { nodeId: "SYD-01", status: "ONLINE" },
  { nodeId: "MEL-04", status: "ONLINE" },
  { nodeId: "BNE-09", status: "OFFLINE", offline: true },
  { nodeId: "PER-02", status: "ONLINE" },
  { nodeId: "ADL-01", status: "ONLINE" }
] as const;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

type EnergyOverviewResponse = {
  region: string;
  panels: {
    liveWholesale: {
      valueAudMwh: number;
      valueCKwh: number;
    };
    retailAverage: {
      annualBillAudMean: number;
      annualBillAudMedian: number;
    };
    benchmark: {
      dmoAnnualBillAud: number;
    };
    cpiElectricity: {
      indexValue: number;
      period: string;
    };
  };
  freshness: {
    updatedAt: string;
    status: "fresh" | "stale" | "degraded";
  };
};

type HousingOverviewResponse = {
  region: string;
  metrics: Array<{
    seriesId: string;
    date: string;
    value: number;
  }>;
  missingSeriesIds: string[];
  updatedAt: string | null;
};

function formatAud(value: number): string {
  return `${Math.round(value)} AUD`;
}

function formatAudMwh(value: number): string {
  return `${value.toFixed(1)} AUD/MWh`;
}

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString("en-AU")}`;
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

export function DashboardShell() {
  const [region, setRegion] = useState<RegionCode>("AU");
  const [energyOverview, setEnergyOverview] =
    useState<EnergyOverviewResponse | null>(null);
  const [energyLoading, setEnergyLoading] = useState(true);
  const [energyError, setEnergyError] = useState<string | null>(null);
  const [housingOverview, setHousingOverview] =
    useState<HousingOverviewResponse | null>(null);
  const [housingLoading, setHousingLoading] = useState(true);
  const [housingError, setHousingError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadEnergyOverview() {
      setEnergyLoading(true);
      setEnergyError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/energy/overview?region=${region}`,
          {
            signal: abortController.signal,
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error(`energy overview request failed with ${response.status}`);
        }

        const payload = (await response.json()) as EnergyOverviewResponse;
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
    const abortController = new AbortController();

    async function loadHousingOverview() {
      setHousingLoading(true);
      setHousingError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/housing/overview?region=${region}`,
          {
            signal: abortController.signal,
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error(`housing overview request failed with ${response.status}`);
        }

        const payload = (await response.json()) as HousingOverviewResponse;
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

  return (
    <main className="dashboard-root">
      <div className="dashboard-noise" aria-hidden />
      <div className="dashboard-crt-overlay" aria-hidden />

      <div className="dashboard-grid">
        <header className="dashboard-header-bar">
          <div className="dashboard-system-status">
            <h1 className="dashboard-title">SITUATIONAL DASHBOARD</h1>
            <StatusIndicator label="SYS_ONLINE" />
            <StatusIndicator label="NET_UNSTABLE" alert />
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
            <span className="dashboard-clock">00:00:00 UTC</span>
          </div>
        </header>

        <DashboardPanel className="dashboard-energy-panel">
          <DashboardPanelHeader title="ENERGY_OVERVIEW" channel={region} />
          <div className="dashboard-energy-container" aria-live="polite">
            {energyLoading && !energyOverview ? (
              <div className="dashboard-energy-loading">SYNCING...</div>
            ) : null}
            {energyError ? (
              <div className="dashboard-energy-error">{energyError}</div>
            ) : null}
            {energyOverview ? (
              <>
                <div className="dashboard-energy-row">
                  <span className="dashboard-energy-label">LIVE_RRP</span>
                  <span className="dashboard-energy-value">
                    {formatAudMwh(energyOverview.panels.liveWholesale.valueAudMwh)}
                  </span>
                </div>
                <div className="dashboard-energy-row">
                  <span className="dashboard-energy-label">RETAIL_MEAN</span>
                  <span className="dashboard-energy-value">
                    {formatAud(energyOverview.panels.retailAverage.annualBillAudMean)}
                  </span>
                </div>
                <div className="dashboard-energy-row">
                  <span className="dashboard-energy-label">DMO_BENCHMARK</span>
                  <span className="dashboard-energy-value">
                    {formatAud(energyOverview.panels.benchmark.dmoAnnualBillAud)}
                  </span>
                </div>
                <div className="dashboard-energy-row">
                  <span className="dashboard-energy-label">CPI_PERIOD</span>
                  <span className="dashboard-energy-value">
                    {energyOverview.panels.cpiElectricity.period}
                  </span>
                </div>
                <div className="dashboard-energy-freshness">
                  FRESHNESS: {energyOverview.freshness.status.toUpperCase()}
                </div>
              </>
            ) : null}
          </div>
        </DashboardPanel>

        <section className="dashboard-map-container" aria-label="Australia sector map">
          <div className="dashboard-map-overlay">
            <h2 className="dashboard-glitch-text" data-text="SECTOR: AUSTRALIA">
              SECTOR: AUSTRALIA
            </h2>
            <div className="dashboard-map-mode">VISUALIZATION_MODE: TOPOGRAPHY</div>
          </div>

          <div className="dashboard-map-coords">
            <div>LAT: -25.2744</div>
            <div>LNG: 133.7751</div>
            <div>ALT: 1500KM</div>
          </div>

          <div className="dashboard-map-region" aria-live="polite">
            <div>Housing region: {region}</div>
            <div>Energy region: {region}</div>
          </div>

          <div className="dashboard-map-mesh" aria-hidden />
        </section>

        <DashboardPanel className="dashboard-metrics-panel">
          <DashboardPanelHeader title="HOUSING_OVERVIEW" channel={region} />
          {housingLoading && !housingOverview ? (
            <div className="dashboard-housing-loading">SYNCING...</div>
          ) : null}
          {housingError ? (
            <div className="dashboard-housing-error">{housingError}</div>
          ) : null}
          <div className="dashboard-metrics-grid">
            {buildHousingMetricRows(housingOverview).map((metric) => (
              <DashboardMetric
                key={metric.label}
                label={metric.label}
                value={metric.value}
                delta={metric.delta}
                deltaNegative={metric.deltaNegative}
                valueAlert={metric.valueAlert}
              />
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel className="dashboard-alerts-panel">
          <DashboardPanelHeader
            title="PRIORITY_ALERTS"
            channel="///"
            titleClassName="dashboard-priority-title"
            channelClassName="dashboard-blink"
          />
          <div className="dashboard-alert-feed">
            {ALERTS.map((alert) => (
              <DashboardAlertItem key={alert}>{alert}</DashboardAlertItem>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel className="dashboard-nodes-panel">
          <DashboardPanelHeader title="REGIONAL_NODES" />
          <div className="dashboard-node-list">
            {NODES.map((node) => (
              <DashboardNodeRow
                key={node.nodeId}
                nodeId={node.nodeId}
                status={node.status}
                offline={node.offline}
              />
            ))}
          </div>
        </DashboardPanel>
      </div>
    </main>
  );
}
