use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldBankNormalizationPoint {
    pub country_code: String,
    pub year: String,
    pub indicator_code: String,
    pub value: f64,
}

#[derive(Deserialize)]
struct WbResponse {
    data: Vec<WbRow>,
}

#[derive(Deserialize)]
struct WbRow {
    country_code: String,
    year: String,
    indicator_code: String,
    value: f64,
}

pub async fn fetch_normalization(
    client: &(impl SourceFetch + ?Sized),
    url: &str,
) -> Result<Vec<WorldBankNormalizationPoint>, SourceClientError> {
    let resp = client.get(url, "application/json").await?;
    let parsed: WbResponse = serde_json::from_str(&resp.body)
        .map_err(|e| SourceClientError::permanent(format!("Failed to parse World Bank: {e}")))?;

    Ok(parsed
        .data
        .into_iter()
        .map(|r| WorldBankNormalizationPoint {
            country_code: r.country_code,
            year: r.year,
            indicator_code: r.indicator_code,
            value: r.value,
        })
        .collect())
}
