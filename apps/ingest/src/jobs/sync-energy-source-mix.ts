import {
  ENERGY_SOURCE_MIX_KEYS,
  NEM_OPERATIONAL_SOURCE_MIX_FIXTURE,
  OFFICIAL_SOURCE_MIX_FIXTURE,
  WEM_OPERATIONAL_SOURCE_MIX_FIXTURE,
  energySourceMixSeriesId,
  getSourceCatalogItems,
  type AnnualSourceMixPoint,
  type OperationalSourceMixPoint
} from "@aus-dash/shared";
import {
  fetchAemoNemSourceMixSnapshot,
  fetchAemoWemSourceMixSnapshot,
  fetchDccEeewGenerationMixSnapshot,
  type SourceFetch
} from "../sources/live-source-clients";
import { resolveIngestBackend } from "../repositories/ingest-backend";
import { persistIngestArtifacts } from "../repositories/ingest-persistence";
import {
  buildIngestRunAuditFields,
  type IngestRunAuditOptions
} from "./ingest-run-audit";

type SyncEnergySourceMixOfficialResult = {
  job: "sync-energy-source-mix-official";
  status: "ok";
  pointsIngested: number;
  rowsInserted: number;
  rowsUpdated: number;
  latestPeriod: string;
  syncedAt: string;
};

type SyncEnergySourceMixOperationalResult = {
  job: "sync-energy-source-mix-operational";
  status: "ok";
  pointsIngested: number;
  rowsInserted: number;
  rowsUpdated: number;
  latestTimestamp: string;
  syncedAt: string;
};

type SyncEnergySourceMixOptions = IngestRunAuditOptions & {
  storePath?: string;
  sourceMode?: "fixture" | "live";
  ingestBackend?: "store" | "postgres";
  officialEndpoint?: string;
  nemEndpoint?: string;
  wemEndpoint?: string;
  fetchImpl?: SourceFetch;
};

function officialFixturePayload(points: AnnualSourceMixPoint[]): string {
  return JSON.stringify(
    {
      year: points[0]?.period ?? "unknown",
      data: points.map((point) => ({
        region_code: point.regionCode,
        source_key: point.sourceKey,
        generation_gwh: point.generationGwh,
        share_pct: point.sharePct
      }))
    },
    null,
    2
  );
}

function operationalFixturePayload(points: OperationalSourceMixPoint[]): string {
  return JSON.stringify(
    {
      interval_start_utc: points[0]?.timestamp ?? new Date().toISOString(),
      data: points.map((point) => ({
        region_code: point.regionCode,
        source_key: point.sourceKey,
        generation_mw: point.generationMw,
        share_pct: point.sharePct
      }))
    },
    null,
    2
  );
}

function buildOfficialObservations(
  points: AnnualSourceMixPoint[],
  ingestedAt: string,
  vintage: string
) {
  return points.map((point) => ({
    seriesId: energySourceMixSeriesId("official", point.sourceKey),
    regionCode: point.regionCode,
    countryCode: "AU",
    market: "annual_official",
    metricFamily: "source_mix",
    date: point.period,
    value: point.sharePct,
    unit: "pct",
    sourceName: "DCCEEW",
    sourceUrl: getSourceCatalogItems(["dcceew_generation_mix"])[0]!.url,
    publishedAt: "2025-09-01T00:00:00Z",
    ingestedAt,
    vintage,
    isModeled: false,
    confidence: "official" as const,
    methodologyVersion: "energy-source-mix-v1"
  }));
}

function buildOperationalObservations(
  points: OperationalSourceMixPoint[],
  sourceId: "aemo_nem_source_mix" | "aemo_wem_source_mix",
  ingestedAt: string,
  vintage: string
) {
  const sourceUrl = getSourceCatalogItems([sourceId])[0]!.url;
  const market = sourceId === "aemo_wem_source_mix" ? "WEM" : "NEM";

  return points.map((point) => ({
    seriesId: energySourceMixSeriesId("operational", point.sourceKey),
    regionCode: point.regionCode,
    countryCode: "AU",
    market,
    metricFamily: "source_mix",
    date: point.timestamp,
    intervalStartUtc: point.timestamp,
    intervalEndUtc: point.timestamp,
    value: point.sharePct,
    unit: "pct",
    sourceName: "AEMO",
    sourceUrl,
    publishedAt: point.timestamp,
    ingestedAt,
    vintage,
    isModeled: false,
    confidence: "official" as const,
    methodologyVersion: "energy-source-mix-v1"
  }));
}

function buildOperationalAggregatePoints(
  points: OperationalSourceMixPoint[]
): OperationalSourceMixPoint[] {
  const timestamp = points[0]?.timestamp;
  if (!timestamp) {
    return [];
  }

  const generationBySource = new Map<OperationalSourceMixPoint["sourceKey"], number>();
  for (const sourceKey of ENERGY_SOURCE_MIX_KEYS) {
    generationBySource.set(sourceKey, 0);
  }

  for (const point of points) {
    generationBySource.set(
      point.sourceKey,
      (generationBySource.get(point.sourceKey) ?? 0) + point.generationMw
    );
  }

  const totalGenerationMw = [...generationBySource.values()].reduce(
    (sum, value) => sum + value,
    0
  );

  return ENERGY_SOURCE_MIX_KEYS.map((sourceKey) => {
    const generationMw = generationBySource.get(sourceKey) ?? 0;
    return {
      regionCode: "AU",
      timestamp,
      sourceKey,
      generationMw,
      sharePct:
        totalGenerationMw > 0
          ? Number(((generationMw / totalGenerationMw) * 100).toFixed(1))
          : 0
    };
  });
}

function buildOperationalAggregateObservations(
  points: OperationalSourceMixPoint[],
  ingestedAt: string,
  vintage: string
) {
  const sourceRefs = getSourceCatalogItems([
    "aemo_nem_source_mix",
    "aemo_wem_source_mix"
  ]);

  return points.map((point) => ({
    seriesId: energySourceMixSeriesId("operational", point.sourceKey),
    regionCode: "AU",
    countryCode: "AU",
    market: "NEM+WEM",
    metricFamily: "source_mix",
    date: point.timestamp,
    intervalStartUtc: point.timestamp,
    intervalEndUtc: point.timestamp,
    value: point.sharePct,
    unit: "pct",
    sourceName: "AEMO",
    sourceUrl: sourceRefs.map((source) => source.url).join("|"),
    publishedAt: point.timestamp,
    ingestedAt,
    vintage,
    isModeled: true,
    confidence: "derived" as const,
    methodologyVersion: "energy-source-mix-v1"
  }));
}

export async function syncEnergySourceMixOfficial(
  options: SyncEnergySourceMixOptions = {}
): Promise<SyncEnergySourceMixOfficialResult> {
  const startedAt = new Date().toISOString();
  const ingestedAt = new Date().toISOString();
  const ingestBackend = resolveIngestBackend(
    options.ingestBackend ?? process.env.AUS_DASH_INGEST_BACKEND
  );
  const useLiveSource =
    options.sourceMode === "live" || process.env.AUS_DASH_INGEST_LIVE === "true";

  let sourcePoints = OFFICIAL_SOURCE_MIX_FIXTURE;
  let rawPayload = officialFixturePayload(sourcePoints);
  if (useLiveSource) {
    const snapshot = await fetchDccEeewGenerationMixSnapshot({
      endpoint: options.officialEndpoint,
      fetchImpl: options.fetchImpl
    });
    sourcePoints = snapshot.points;
    rawPayload = snapshot.rawPayload;
  }

  const latestPeriod = [...new Set(sourcePoints.map((point) => point.period))]
    .sort((a, b) => a.localeCompare(b))
    .at(-1);
  if (!latestPeriod) {
    throw new Error("no annual source mix points to ingest");
  }

  const upsertResult = await persistIngestArtifacts({
    backend: ingestBackend,
    storePath: options.storePath,
    sourceCatalog: getSourceCatalogItems(["dcceew_generation_mix"]),
    rawSnapshots: [
      {
        sourceId: "dcceew_generation_mix",
        payload: rawPayload,
        contentType: "application/json",
        capturedAt: ingestedAt
      }
    ],
    observations: buildOfficialObservations(sourcePoints, ingestedAt, latestPeriod),
    sourceCursors: [
      {
        sourceId: "dcceew_generation_mix",
        cursor: latestPeriod
      }
    ],
    ingestionRun: {
      job: "sync-energy-source-mix-official-daily",
      status: "ok",
      startedAt,
      finishedAt: ingestedAt,
      ...buildIngestRunAuditFields(options)
    }
  });

  return {
    job: "sync-energy-source-mix-official",
    status: "ok",
    pointsIngested: sourcePoints.length,
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    latestPeriod,
    syncedAt: ingestedAt
  };
}

export async function syncEnergySourceMixOperational(
  options: SyncEnergySourceMixOptions = {}
): Promise<SyncEnergySourceMixOperationalResult> {
  const startedAt = new Date().toISOString();
  const ingestedAt = new Date().toISOString();
  const ingestBackend = resolveIngestBackend(
    options.ingestBackend ?? process.env.AUS_DASH_INGEST_BACKEND
  );
  const useLiveSource =
    options.sourceMode === "live" || process.env.AUS_DASH_INGEST_LIVE === "true";
  const vintage = useLiveSource ? ingestedAt.slice(0, 10) : "2026-02-27";

  let nemPoints = NEM_OPERATIONAL_SOURCE_MIX_FIXTURE;
  let wemPoints = WEM_OPERATIONAL_SOURCE_MIX_FIXTURE;
  let nemRawPayload = operationalFixturePayload(nemPoints);
  let wemRawPayload = operationalFixturePayload(wemPoints);
  if (useLiveSource) {
    const [nemSnapshot, wemSnapshot] = await Promise.all([
      fetchAemoNemSourceMixSnapshot({
        endpoint: options.nemEndpoint,
        fetchImpl: options.fetchImpl
      }),
      fetchAemoWemSourceMixSnapshot({
        endpoint: options.wemEndpoint,
        fetchImpl: options.fetchImpl
      })
    ]);
    nemPoints = nemSnapshot.points;
    wemPoints = wemSnapshot.points;
    nemRawPayload = nemSnapshot.rawPayload;
    wemRawPayload = wemSnapshot.rawPayload;
  }

  const latestTimestamp = [...new Set([...nemPoints, ...wemPoints].map((point) => point.timestamp))]
    .sort((a, b) => a.localeCompare(b))
    .at(-1);
  if (!latestTimestamp) {
    throw new Error("no operational source mix points to ingest");
  }

  const aggregatePoints = buildOperationalAggregatePoints([...nemPoints, ...wemPoints]);
  const observations = [
    ...buildOperationalObservations(
      nemPoints,
      "aemo_nem_source_mix",
      ingestedAt,
      vintage
    ),
    ...buildOperationalObservations(
      wemPoints,
      "aemo_wem_source_mix",
      ingestedAt,
      vintage
    ),
    ...buildOperationalAggregateObservations(aggregatePoints, ingestedAt, vintage)
  ];

  const upsertResult = await persistIngestArtifacts({
    backend: ingestBackend,
    storePath: options.storePath,
    sourceCatalog: getSourceCatalogItems([
      "aemo_nem_source_mix",
      "aemo_wem_source_mix"
    ]),
    rawSnapshots: [
      {
        sourceId: "aemo_nem_source_mix",
        payload: nemRawPayload,
        contentType: "application/json",
        capturedAt: ingestedAt
      },
      {
        sourceId: "aemo_wem_source_mix",
        payload: wemRawPayload,
        contentType: "application/json",
        capturedAt: ingestedAt
      }
    ],
    observations,
    sourceCursors: [
      { sourceId: "aemo_nem_source_mix", cursor: latestTimestamp },
      { sourceId: "aemo_wem_source_mix", cursor: latestTimestamp }
    ],
    ingestionRun: {
      job: "sync-energy-source-mix-operational-5m",
      status: "ok",
      startedAt,
      finishedAt: ingestedAt,
      ...buildIngestRunAuditFields(options)
    }
  });

  return {
    job: "sync-energy-source-mix-operational",
    status: "ok",
    pointsIngested: observations.length,
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    latestTimestamp,
    syncedAt: ingestedAt
  };
}
