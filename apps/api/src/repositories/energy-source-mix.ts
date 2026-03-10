import {
  ENERGY_SOURCE_MIX_KEYS,
  energySourceMixSeriesId,
  getSourceReferences,
  type EnergySourceMixKey
} from "@aus-dash/shared";
import type { EnergySourceMixView } from "./live-data-contract";

type SourceMixObservationLike = {
  date: string;
  value: number;
};

type LookupLatestSourceMixPoint = (
  seriesId: string,
  regionCode: string
) => SourceMixObservationLike | null;

const SOURCE_MIX_LABELS: Record<EnergySourceMixKey, string> = {
  coal: "Coal",
  gas: "Gas",
  hydro: "Hydro",
  oil: "Oil",
  other_renewables: "Other renewables"
};

function buildRows(
  view: "official" | "operational",
  regionCode: string,
  lookupLatest: LookupLatestSourceMixPoint
) {
  return ENERGY_SOURCE_MIX_KEYS.map((sourceKey) => {
    const point = lookupLatest(energySourceMixSeriesId(view, sourceKey), regionCode);
    if (!point) {
      return null;
    }

    return {
      sourceKey,
      label: SOURCE_MIX_LABELS[sourceKey],
      sharePct: point.value,
      updatedAt: point.date
    };
  })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => right.sharePct - left.sharePct);
}

function buildOfficialView(
  region: string,
  lookupLatest: LookupLatestSourceMixPoint
): EnergySourceMixView {
  const observationRegion = region === "ACT" ? "NSW" : region;
  const rows = buildRows("official", observationRegion, lookupLatest);

  return {
    viewId: "annual_official",
    title: "Annual official source mix",
    coverageLabel:
      region === "ACT" ? "ACT uses NSW official proxy" : `${region} official annual mix`,
    updatedAt: rows[0]?.updatedAt ?? "unavailable",
    sourceRefs: getSourceReferences(["dcceew_generation_mix"]),
    rows: rows.map(({ updatedAt: _updatedAt, ...row }) => row)
  };
}

function buildOperationalView(
  region: string,
  lookupLatest: LookupLatestSourceMixPoint
): EnergySourceMixView {
  if (region === "NT") {
    return {
      viewId: "operational_nem_wem",
      title: "Operational NEM + WA source mix",
      coverageLabel: "NT operational mix unavailable",
      updatedAt: "unavailable",
      sourceRefs: [],
      rows: []
    };
  }

  const observationRegion = region === "ACT" ? "NSW" : region;
  const sourceIds =
    region === "AU"
      ? ["aemo_nem_source_mix", "aemo_wem_source_mix"]
      : region === "WA"
        ? ["aemo_wem_source_mix"]
        : ["aemo_nem_source_mix"];
  const rows = buildRows("operational", observationRegion, lookupLatest);

  return {
    viewId: "operational_nem_wem",
    title: "Operational NEM + WA source mix",
    coverageLabel:
      region === "AU"
        ? "NEM+WEM operational mix"
        : region === "WA"
          ? "WA WEM operational mix"
          : region === "ACT"
            ? "ACT uses NSW NEM proxy"
            : `${region} NEM operational mix`,
    updatedAt: rows[0]?.updatedAt ?? "unavailable",
    sourceRefs: getSourceReferences(sourceIds),
    rows: rows.map(({ updatedAt: _updatedAt, ...row }) => row)
  };
}

export function buildEnergySourceMixViews(
  region: string,
  lookupLatest: LookupLatestSourceMixPoint
): EnergySourceMixView[] {
  return [buildOfficialView(region, lookupLatest), buildOperationalView(region, lookupLatest)];
}
