//! Time series identifiers and metadata.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Housing series IDs.
pub const HOUSING_SERIES_IDS: &[&str] = &[
    "hvi.value.index",
    "rent.value.index",
    "lending.oo.count",
    "lending.oo.value_aud",
    "lending.investor.count",
    "lending.investor.value_aud",
    "lending.avg_loan_size_aud",
    "rates.oo.variable_pct",
    "rates.oo.fixed_pct",
    "rates.investor.variable_pct",
    "refinance.value_aud",
];

/// Required series for the housing overview.
pub const HOUSING_OVERVIEW_REQUIRED_SERIES_IDS: &[&str] = &[
    "hvi.value.index",
    "lending.oo.count",
    "lending.oo.value_aud",
    "lending.investor.count",
    "lending.investor.value_aud",
    "lending.avg_loan_size_aud",
    "rates.oo.variable_pct",
    "rates.oo.fixed_pct",
];

/// Energy wholesale series IDs.
pub const ENERGY_WHOLESALE_SERIES_IDS: &[&str] = &[
    "energy.wholesale.spot.au.aud_mwh",
    "energy.wholesale.spot.country.usd_mwh",
    "energy.wholesale.spread.au_vs_peer.pct",
    "energy.wholesale.rank.au.percentile",
];

/// Energy retail series IDs.
pub const ENERGY_RETAIL_SERIES_IDS: &[&str] = &[
    "energy.retail.price.country.local_kwh",
    "energy.retail.price.country.usd_kwh_nominal",
    "energy.retail.price.country.usd_kwh_ppp",
    "energy.retail.spread.au_vs_peer.nominal_pct",
    "energy.retail.spread.au_vs_peer.ppp_pct",
    "energy.retail.rank.au.nominal",
    "energy.retail.rank.au.ppp",
];

/// Price index series IDs.
pub const PRICE_INDEX_SERIES_IDS: &[&str] = &[
    "prices.major_goods.overall.index",
    "prices.major_goods.food.index",
    "prices.major_goods.household_supplies.index",
];

/// AI deflation series IDs.
pub const AI_DEFLATION_SERIES_IDS: &[&str] = &[
    "prices.au_made.all.index",
    "prices.au_made.ai_exposed.index",
    "prices.au_made.control.index",
    "prices.imported.matched_control.index",
    "prices.ai_deflation.spread.au_made_vs_control.index",
];

/// Tax status for energy pricing data.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
pub enum TaxStatus {
    #[serde(rename = "incl_tax")]
    InclTax,
    #[serde(rename = "excl_tax")]
    ExclTax,
    #[serde(rename = "mixed")]
    Mixed,
}

/// Consumption band for energy pricing data.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
pub enum ConsumptionBand {
    #[serde(rename = "household_low")]
    Low,
    #[serde(rename = "household_mid")]
    Medium,
    #[serde(rename = "household_high")]
    High,
    #[serde(rename = "non_household_small")]
    Average,
}

/// Energy time window.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
pub enum EnergyWindow {
    #[serde(rename = "5m")]
    FiveMin,
    #[serde(rename = "1h")]
    OneHour,
    #[serde(rename = "24h")]
    TwentyFourHour,
}

/// Basis for energy retail price comparisons.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
pub enum EnergyRetailComparisonBasis {
    #[serde(rename = "nominal")]
    Nominal,
    #[serde(rename = "ppp")]
    Ppp,
}
