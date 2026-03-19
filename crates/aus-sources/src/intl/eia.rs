use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EiaRetailPricePoint {
    pub period: String,
    pub region_code: String,
    pub customer_type: String,
    pub price_usd_kwh: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EiaWholesalePricePoint {
    pub interval_start_utc: String,
    pub interval_end_utc: String,
    pub region_code: String,
    pub price_usd_mwh: f64,
}

#[derive(Deserialize)]
struct EiaResponse {
    retail: Option<Vec<EiaRetailRow>>,
    wholesale: Option<Vec<EiaWholesaleRow>>,
}

#[derive(Deserialize)]
struct EiaRetailRow {
    period: String,
    region_code: String,
    customer_type: String,
    price_usd_kwh: f64,
}

#[derive(Deserialize)]
struct EiaWholesaleRow {
    interval_start_utc: String,
    interval_end_utc: String,
    region_code: String,
    lmp_usd_mwh: f64,
}

pub async fn fetch_electricity(
    client: &(impl SourceFetch + ?Sized),
    url: &str,
) -> Result<(Vec<EiaRetailPricePoint>, Vec<EiaWholesalePricePoint>), SourceClientError> {
    let resp = client.get(url, "application/json").await?;
    let parsed: EiaResponse = serde_json::from_str(&resp.body)
        .map_err(|e| SourceClientError::permanent(format!("Failed to parse EIA: {e}")))?;

    let retail = parsed
        .retail
        .unwrap_or_default()
        .into_iter()
        .map(|r| EiaRetailPricePoint {
            period: r.period,
            region_code: r.region_code,
            customer_type: r.customer_type,
            price_usd_kwh: r.price_usd_kwh,
        })
        .collect();

    let wholesale = parsed
        .wholesale
        .unwrap_or_default()
        .into_iter()
        .map(|w| EiaWholesalePricePoint {
            interval_start_utc: w.interval_start_utc,
            interval_end_utc: w.interval_end_utc,
            region_code: w.region_code,
            price_usd_mwh: w.lmp_usd_mwh,
        })
        .collect();

    Ok((retail, wholesale))
}
