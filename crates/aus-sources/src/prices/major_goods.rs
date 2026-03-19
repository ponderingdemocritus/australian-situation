use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MajorGoodsPriceItem {
    pub merchant: String,
    pub merchant_name: String,
    pub region_code: String,
    pub category_slug: String,
    pub category_name: String,
    pub product_slug: String,
    pub canonical_name: String,
    pub external_product_id: Option<String>,
    pub external_offer_id: String,
    pub price_amount: f64,
    pub unit_price_amount: Option<f64>,
    pub normalized_quantity: Option<f64>,
    pub normalized_unit: Option<String>,
    pub price_type: Option<String>,
    pub listing_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MajorGoodsPriceResponse {
    pub observed_at: String,
    pub items: Vec<MajorGoodsPriceItem>,
}

pub async fn fetch_prices(
    client: &(impl SourceFetch + ?Sized),
    url: &str,
) -> Result<MajorGoodsPriceResponse, SourceClientError> {
    let resp = client.get(url, "application/json").await?;
    let parsed: MajorGoodsPriceResponse = serde_json::from_str(&resp.body)
        .map_err(|e| SourceClientError::permanent(format!("Failed to parse major goods: {e}")))?;
    Ok(parsed)
}
