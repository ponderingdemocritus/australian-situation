use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EurostatRetailPricePoint {
    pub country_code: String,
    pub period: String,
    pub customer_type: String,
    pub consumption_band: String,
    pub tax_status: String,
    pub currency: String,
    pub price_local_kwh: f64,
}

#[derive(Deserialize)]
struct EurostatResponse {
    data: Vec<EurostatRow>,
}

#[derive(Deserialize)]
struct EurostatRow {
    country_code: String,
    period: String,
    customer_type: String,
    consumption_band: String,
    tax_status: String,
    currency: String,
    price_local_kwh: f64,
}

pub async fn fetch_retail(
    client: &(impl SourceFetch + ?Sized),
    url: &str,
) -> Result<Vec<EurostatRetailPricePoint>, SourceClientError> {
    let resp = client.get(url, "application/json").await?;
    let parsed: EurostatResponse = serde_json::from_str(&resp.body)
        .map_err(|e| SourceClientError::permanent(format!("Failed to parse Eurostat: {e}")))?;

    Ok(parsed
        .data
        .into_iter()
        .map(|r| EurostatRetailPricePoint {
            country_code: r.country_code,
            period: r.period,
            customer_type: r.customer_type,
            consumption_band: r.consumption_band,
            tax_status: r.tax_status,
            currency: r.currency,
            price_local_kwh: r.price_local_kwh,
        })
        .collect())
}
