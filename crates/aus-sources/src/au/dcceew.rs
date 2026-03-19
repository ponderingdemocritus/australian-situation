use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DcceewGenerationMixPoint {
    pub year: String,
    pub region_code: String,
    pub source_key: String,
    pub generation_gwh: f64,
    pub share_pct: f64,
}

#[derive(Deserialize)]
struct DcceewResponse {
    year: String,
    data: Vec<DcceewRow>,
}

#[derive(Deserialize)]
struct DcceewRow {
    region_code: String,
    source_key: String,
    generation_gwh: f64,
    share_pct: f64,
}

pub async fn fetch_generation_mix(
    client: &(impl SourceFetch + ?Sized),
    url: &str,
) -> Result<Vec<DcceewGenerationMixPoint>, SourceClientError> {
    let resp = client.get(url, "application/json").await?;
    let parsed: DcceewResponse = serde_json::from_str(&resp.body)
        .map_err(|e| SourceClientError::permanent(format!("Failed to parse DCCEEW: {e}")))?;

    Ok(parsed
        .data
        .into_iter()
        .map(|row| DcceewGenerationMixPoint {
            year: parsed.year.clone(),
            region_code: row.region_code,
            source_key: row.source_key,
            generation_gwh: row.generation_gwh,
            share_pct: row.share_pct,
        })
        .collect())
}
