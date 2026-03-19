//! Source catalog, cursors, and references.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// High-level domain that a data source belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum SourceDomain {
    Housing,
    Energy,
    Macro,
    Prices,
}

/// An item in the source catalog.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SourceCatalogItem {
    pub source_id: String,
    pub domain: SourceDomain,
    pub name: String,
    pub url: String,
    pub expected_cadence: String,
}

/// Lightweight reference to a source.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SourceReference {
    pub source_id: String,
    pub name: String,
    pub url: String,
}

/// Cursor tracking ingestion progress for a source.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SourceCursor {
    pub source_id: String,
    pub cursor: String,
    pub updated_at: DateTime<Utc>,
}

/// Status of an ingestion run.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum IngestionStatus {
    Ok,
    Failed,
    Degraded,
}

/// Record of a single ingestion run.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestionRun {
    pub run_id: String,
    pub job: String,
    pub status: IngestionStatus,
    pub started_at: DateTime<Utc>,
    pub finished_at: DateTime<Utc>,
    pub rows_inserted: i32,
    pub rows_updated: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bull_job_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub queue_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attempt: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_mode: Option<String>,
}

/// Raw snapshot captured from a source.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RawSnapshot {
    pub snapshot_id: String,
    pub source_id: String,
    pub checksum_sha256: String,
    pub captured_at: DateTime<Utc>,
    pub content_type: String,
    pub payload: String,
}

/// Result of an upsert operation.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpsertResult {
    pub inserted: i64,
    pub updated: i64,
}

/// Returns the full source catalog.
pub fn source_catalog() -> Vec<SourceCatalogItem> {
    vec![
        SourceCatalogItem {
            source_id: "abs_housing".into(),
            domain: SourceDomain::Housing,
            name: "Australian Bureau of Statistics".into(),
            url: "https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/data-api-user-guide".into(),
            expected_cadence: "monthly|quarterly".into(),
        },
        SourceCatalogItem {
            source_id: "aemo_wholesale".into(),
            domain: SourceDomain::Energy,
            name: "AEMO NEM Wholesale".into(),
            url: "https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem".into(),
            expected_cadence: "5m".into(),
        },
        SourceCatalogItem {
            source_id: "aer_prd".into(),
            domain: SourceDomain::Energy,
            name: "AER Product Reference Data".into(),
            url: "https://www.aer.gov.au/energy-product-reference-data".into(),
            expected_cadence: "daily".into(),
        },
        SourceCatalogItem {
            source_id: "dcceew_generation_mix".into(),
            domain: SourceDomain::Energy,
            name: "DCCEEW Australian electricity generation fuel mix".into(),
            url: "https://www.energy.gov.au/energy-data/australian-electricity-generation-fuel-mix".into(),
            expected_cadence: "annual".into(),
        },
        SourceCatalogItem {
            source_id: "aemo_nem_source_mix".into(),
            domain: SourceDomain::Energy,
            name: "AEMO NEM fuel mix dashboard".into(),
            url: "https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem".into(),
            expected_cadence: "5m".into(),
        },
        SourceCatalogItem {
            source_id: "aemo_wem_source_mix".into(),
            domain: SourceDomain::Energy,
            name: "AEMO WEM fuel mix dashboard".into(),
            url: "https://www.aemo.com.au/energy-systems/electricity/wholesale-electricity-market-wem/data-wem/data-dashboard-wem".into(),
            expected_cadence: "5m".into(),
        },
        SourceCatalogItem {
            source_id: "rba_rates".into(),
            domain: SourceDomain::Housing,
            name: "RBA Interest Rates".into(),
            url: "https://www.rba.gov.au/statistics/interest-rates/".into(),
            expected_cadence: "monthly".into(),
        },
        SourceCatalogItem {
            source_id: "abs_cpi".into(),
            domain: SourceDomain::Macro,
            name: "ABS CPI Electricity".into(),
            url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release".into(),
            expected_cadence: "quarterly".into(),
        },
        SourceCatalogItem {
            source_id: "major_goods_prices".into(),
            domain: SourceDomain::Prices,
            name: "Major Goods Retail Basket".into(),
            url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release".into(),
            expected_cadence: "daily".into(),
        },
        SourceCatalogItem {
            source_id: "eia_electricity".into(),
            domain: SourceDomain::Energy,
            name: "US EIA Electricity".into(),
            url: "https://www.eia.gov/opendata/documentation.php".into(),
            expected_cadence: "hourly|monthly".into(),
        },
        SourceCatalogItem {
            source_id: "eurostat_retail".into(),
            domain: SourceDomain::Energy,
            name: "Eurostat Electricity Prices".into(),
            url: "https://ec.europa.eu/eurostat/cache/metadata/en/nrg_pc_204_sims.htm".into(),
            expected_cadence: "semiannual".into(),
        },
        SourceCatalogItem {
            source_id: "entsoe_wholesale".into(),
            domain: SourceDomain::Energy,
            name: "ENTSO-E Wholesale".into(),
            url: "https://transparency.entsoe.eu/api".into(),
            expected_cadence: "hourly".into(),
        },
        SourceCatalogItem {
            source_id: "pln_tariff".into(),
            domain: SourceDomain::Energy,
            name: "PLN Household Tariffs".into(),
            url: "https://web.pln.co.id/cms/media/2025/12/tarif-listrik/".into(),
            expected_cadence: "quarterly".into(),
        },
        SourceCatalogItem {
            source_id: "beijing_residential_tariff".into(),
            domain: SourceDomain::Energy,
            name: "Beijing Residential Tariff Proxy".into(),
            url: "https://fgw.beijing.gov.cn/bmcx/djcx/jzldj/202110/t20211025_2520169.htm".into(),
            expected_cadence: "ad hoc".into(),
        },
        SourceCatalogItem {
            source_id: "nea_china_wholesale_proxy".into(),
            domain: SourceDomain::Energy,
            name: "NEA China Wholesale Proxy".into(),
            url: "https://fjb.nea.gov.cn/dtyw/gjnyjdt/202309/t20230915_83144.html".into(),
            expected_cadence: "annual".into(),
        },
        SourceCatalogItem {
            source_id: "world_bank_normalization".into(),
            domain: SourceDomain::Macro,
            name: "World Bank Indicators API".into(),
            url: "https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation".into(),
            expected_cadence: "annual".into(),
        },
    ]
}
