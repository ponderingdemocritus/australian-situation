use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntsoeWholesalePoint {
    pub country_code: String,
    pub bidding_zone: String,
    pub interval_start_utc: String,
    pub interval_end_utc: String,
    pub price_eur_mwh: f64,
}

#[derive(Deserialize)]
struct EntsoeResponse {
    data: Vec<EntsoeRow>,
}

#[derive(Deserialize)]
struct EntsoeRow {
    country_code: String,
    bidding_zone: String,
    interval_start_utc: String,
    interval_end_utc: String,
    day_ahead_price_eur_mwh: f64,
}

pub async fn fetch_wholesale(
    client: &(impl SourceFetch + ?Sized),
    url: &str,
) -> Result<Vec<EntsoeWholesalePoint>, SourceClientError> {
    let resp = client.get(url, "application/json").await?;
    let parsed: EntsoeResponse = serde_json::from_str(&resp.body)
        .map_err(|e| SourceClientError::permanent(format!("Failed to parse ENTSO-E: {e}")))?;

    Ok(parsed
        .data
        .into_iter()
        .map(|r| EntsoeWholesalePoint {
            country_code: r.country_code,
            bidding_zone: r.bidding_zone,
            interval_start_utc: r.interval_start_utc,
            interval_end_utc: r.interval_end_utc,
            price_eur_mwh: r.day_ahead_price_eur_mwh,
        })
        .collect())
}
