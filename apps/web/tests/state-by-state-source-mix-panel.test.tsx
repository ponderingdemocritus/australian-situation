import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderHomePage } from "./render-home-page";

const fetchMock = vi.fn();

const OFFICIAL_PRIMARY: Record<
  string,
  { coverage: string; rows: Array<{ sourceKey: string; label: string; sharePct: number }> }
> = {
  AU: {
    coverage: "AU official annual mix",
    rows: [
      { sourceKey: "coal", label: "Coal", sharePct: 47 },
      { sourceKey: "gas", label: "Gas", sharePct: 21 },
      { sourceKey: "wind", label: "Wind", sharePct: 18 },
      { sourceKey: "solar", label: "Solar", sharePct: 14 }
    ]
  },
  NSW: {
    coverage: "NSW official annual mix",
    rows: [
      { sourceKey: "coal", label: "Coal", sharePct: 68 },
      { sourceKey: "gas", label: "Gas", sharePct: 16 },
      { sourceKey: "hydro", label: "Hydro", sharePct: 10 },
      { sourceKey: "wind", label: "Wind", sharePct: 6 }
    ]
  },
  VIC: {
    coverage: "VIC official annual mix",
    rows: [
      { sourceKey: "coal", label: "Coal", sharePct: 63 },
      { sourceKey: "wind", label: "Wind", sharePct: 17 },
      { sourceKey: "gas", label: "Gas", sharePct: 12 },
      { sourceKey: "solar", label: "Solar", sharePct: 8 }
    ]
  },
  QLD: {
    coverage: "QLD official annual mix",
    rows: [
      { sourceKey: "coal", label: "Coal", sharePct: 73 },
      { sourceKey: "gas", label: "Gas", sharePct: 12 },
      { sourceKey: "solar", label: "Solar", sharePct: 9 },
      { sourceKey: "wind", label: "Wind", sharePct: 6 }
    ]
  },
  SA: {
    coverage: "SA official annual mix",
    rows: [
      { sourceKey: "other_renewables", label: "Other renewables", sharePct: 74 },
      { sourceKey: "gas", label: "Gas", sharePct: 16 },
      { sourceKey: "solar", label: "Solar", sharePct: 10 }
    ]
  },
  WA: {
    coverage: "WA official annual mix",
    rows: [
      { sourceKey: "gas", label: "Gas", sharePct: 62 },
      { sourceKey: "coal", label: "Coal", sharePct: 21 },
      { sourceKey: "wind", label: "Wind", sharePct: 9 },
      { sourceKey: "solar", label: "Solar", sharePct: 8 }
    ]
  },
  TAS: {
    coverage: "TAS official annual mix",
    rows: [
      { sourceKey: "hydro", label: "Hydro", sharePct: 79 },
      { sourceKey: "wind", label: "Wind", sharePct: 11 },
      { sourceKey: "gas", label: "Gas", sharePct: 10 }
    ]
  },
  ACT: {
    coverage: "ACT uses NSW official proxy",
    rows: [
      { sourceKey: "coal", label: "Coal", sharePct: 68 },
      { sourceKey: "gas", label: "Gas", sharePct: 16 },
      { sourceKey: "hydro", label: "Hydro", sharePct: 10 },
      { sourceKey: "wind", label: "Wind", sharePct: 6 }
    ]
  },
  NT: {
    coverage: "NT official annual mix",
    rows: [
      { sourceKey: "gas", label: "Gas", sharePct: 84 },
      { sourceKey: "solar", label: "Solar", sharePct: 10 },
      { sourceKey: "other", label: "Other", sharePct: 6 }
    ]
  }
};

const OPERATIONAL_PRIMARY: Record<
  string,
  | { coverage: string; rows: Array<{ sourceKey: string; label: string; sharePct: number }> }
  | null
> = {
  AU: {
    coverage: "NEM+WEM operational mix",
    rows: [
      { sourceKey: "coal", label: "Coal", sharePct: 54 },
      { sourceKey: "gas", label: "Gas", sharePct: 18 },
      { sourceKey: "wind", label: "Wind", sharePct: 16 },
      { sourceKey: "solar", label: "Solar", sharePct: 12 }
    ]
  },
  NSW: {
    coverage: "NSW NEM operational mix",
    rows: [
      { sourceKey: "coal", label: "Coal", sharePct: 69 },
      { sourceKey: "gas", label: "Gas", sharePct: 14 },
      { sourceKey: "hydro", label: "Hydro", sharePct: 9 },
      { sourceKey: "wind", label: "Wind", sharePct: 8 }
    ]
  },
  VIC: {
    coverage: "VIC NEM operational mix",
    rows: [
      { sourceKey: "coal", label: "Coal", sharePct: 58 },
      { sourceKey: "wind", label: "Wind", sharePct: 18 },
      { sourceKey: "gas", label: "Gas", sharePct: 13 },
      { sourceKey: "solar", label: "Solar", sharePct: 11 }
    ]
  },
  QLD: {
    coverage: "QLD NEM operational mix",
    rows: [
      { sourceKey: "coal", label: "Coal", sharePct: 76 },
      { sourceKey: "gas", label: "Gas", sharePct: 10 },
      { sourceKey: "solar", label: "Solar", sharePct: 8 },
      { sourceKey: "wind", label: "Wind", sharePct: 6 }
    ]
  },
  SA: {
    coverage: "SA NEM operational mix",
    rows: [
      { sourceKey: "other_renewables", label: "Other renewables", sharePct: 72 },
      { sourceKey: "gas", label: "Gas", sharePct: 16 },
      { sourceKey: "solar", label: "Solar", sharePct: 12 }
    ]
  },
  WA: {
    coverage: "WA WEM operational mix",
    rows: [
      { sourceKey: "gas", label: "Gas", sharePct: 62 },
      { sourceKey: "solar", label: "Solar", sharePct: 21 },
      { sourceKey: "wind", label: "Wind", sharePct: 10 },
      { sourceKey: "coal", label: "Coal", sharePct: 7 }
    ]
  },
  TAS: {
    coverage: "TAS NEM operational mix",
    rows: [
      { sourceKey: "hydro", label: "Hydro", sharePct: 81 },
      { sourceKey: "wind", label: "Wind", sharePct: 10 },
      { sourceKey: "gas", label: "Gas", sharePct: 9 }
    ]
  },
  ACT: {
    coverage: "ACT uses NSW NEM proxy",
    rows: [
      { sourceKey: "coal", label: "Coal", sharePct: 69 },
      { sourceKey: "gas", label: "Gas", sharePct: 14 },
      { sourceKey: "hydro", label: "Hydro", sharePct: 9 },
      { sourceKey: "wind", label: "Wind", sharePct: 8 }
    ]
  },
  NT: null
};

function createEnergyPayload(region: string) {
  const official = OFFICIAL_PRIMARY[region] ?? OFFICIAL_PRIMARY.AU;
  const operational = OPERATIONAL_PRIMARY[region];

  return {
    region,
    methodSummary: "Regional energy snapshot.",
    sourceRefs: [
      {
        sourceId: "aer_prd",
        name: "AER Product Reference Data",
        url: "https://www.aer.gov.au/energy-product-reference-data"
      }
    ],
    panels: {
      liveWholesale: {
        valueAudMwh: region === "NSW" ? 120 : region === "VIC" ? 100 : 118,
        valueCKwh: region === "NSW" ? 12 : region === "VIC" ? 10 : 11.8
      },
      retailAverage: {
        annualBillAudMean: 2000,
        annualBillAudMedian: 1980
      },
      benchmark: {
        dmoAnnualBillAud: 2055
      },
      cpiElectricity: {
        indexValue: 150.2,
        period: "2025-Q4"
      }
    },
    sourceMixViews: [
      {
        viewId: "annual_official",
        title: "Annual official source mix",
        coverageLabel: official.coverage,
        updatedAt: "2024",
        sourceRefs: [
          {
            sourceId: "dcceew_generation_mix",
            name: "DCCEEW Australian electricity generation fuel mix",
            url: "https://www.energy.gov.au/energy-data/australian-electricity-generation-fuel-mix"
          }
        ],
        rows: official.rows
      },
      {
        viewId: "operational_nem_wem",
        title: "Operational NEM + WA source mix",
        coverageLabel: operational?.coverage ?? "NT operational mix unavailable",
        updatedAt: "2026-02-27T02:00:00Z",
        sourceRefs:
          region === "WA"
            ? [
                {
                  sourceId: "aemo_wem_source_mix",
                  name: "AEMO WEM fuel mix dashboard",
                  url: "https://www.aemo.com.au/energy-systems/electricity/wholesale-electricity-market-wem/data-wem/data-dashboard-wem"
                }
              ]
            : [
                {
                  sourceId: "aemo_nem_source_mix",
                  name: "AEMO NEM fuel mix dashboard",
                  url: "https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem"
                }
              ],
        rows: operational?.rows ?? []
      }
    ],
    freshness: {
      updatedAt: "2026-02-27T02:00:00Z",
      status: "fresh"
    }
  };
}

function createHousingPayload(region: string) {
  return {
    region,
    requiredSeriesIds: [],
    missingSeriesIds: [],
    metrics: [],
    updatedAt: "2026-02-27"
  };
}

describe("state-by-state source mix panel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      const regionMatch = /region=([A-Z]+)/.exec(url);
      const region = regionMatch?.[1] ?? "AU";

      if (url.includes("/api/energy/overview")) {
        return {
          ok: true,
          status: 200,
          json: async () => createEnergyPayload(region)
        };
      }

      if (url.includes("/api/housing/overview")) {
        return {
          ok: true,
          status: 200,
          json: async () => createHousingPayload(region)
        };
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({})
      };
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("renders the full selected region source mix breakdown and switches views in place", async () => {
    await renderHomePage("WA");

    await waitFor(() => {
      const panel = within(screen.getByLabelText("State by state source mix"));
      expect(panel.getByText("STATE_BY_STATE_SOURCE_MIX")).toBeDefined();
      expect(panel.getByText("WA official annual mix")).toBeDefined();
      expect(panel.getByLabelText("WA source mix chart")).toBeDefined();
      expect(panel.getByText("Gas")).toBeDefined();
      expect(panel.getByText("62%")).toBeDefined();
      expect(panel.getByText("Coal")).toBeDefined();
      expect(panel.getByText("21%")).toBeDefined();
      expect(panel.getByText("Wind")).toBeDefined();
      expect(panel.getByText("9%")).toBeDefined();
      expect(panel.getByText("Solar")).toBeDefined();
      expect(panel.getByText("8%")).toBeDefined();
      expect(panel.queryByText("AU")).toBeNull();
      expect(panel.queryByText("NT")).toBeNull();
    });

    screen.getByRole("button", { name: "Operational NEM + WA" }).click();

    await waitFor(() => {
      const panel = within(screen.getByLabelText("State by state source mix"));
      expect(panel.getByText("WA WEM operational mix")).toBeDefined();
      expect(panel.getByText("Gas")).toBeDefined();
      expect(panel.getByText("62%")).toBeDefined();
      expect(panel.getByText("Solar")).toBeDefined();
      expect(panel.getByText("21%")).toBeDefined();
      expect(panel.getByText("Wind")).toBeDefined();
      expect(panel.getByText("10%")).toBeDefined();
      expect(panel.getByText("Coal")).toBeDefined();
      expect(panel.getByText("7%")).toBeDefined();
      expect(panel.queryByText("AU")).toBeNull();
      expect(panel.queryByText("NT")).toBeNull();
    });
  });
});
