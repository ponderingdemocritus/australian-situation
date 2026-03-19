use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AemoOperationalMixPoint {
    pub interval_start_utc: String,
    pub region_code: String,
    pub source_key: String,
    pub generation_mw: f64,
    pub share_pct: f64,
}

#[derive(Deserialize)]
struct NemMixResponse {
    interval_start_utc: String,
    data: Vec<NemMixRow>,
}

#[derive(Deserialize)]
struct NemMixRow {
    region_code: String,
    source_key: String,
    generation_mw: f64,
    share_pct: f64,
}

pub async fn fetch_nem_mix(
    client: &(impl SourceFetch + ?Sized),
    url: &str,
) -> Result<Vec<AemoOperationalMixPoint>, SourceClientError> {
    let resp = client.get(url, "application/json").await?;
    let parsed: NemMixResponse = serde_json::from_str(&resp.body)
        .map_err(|e| SourceClientError::permanent(format!("Failed to parse NEM mix: {e}")))?;

    Ok(parsed
        .data
        .into_iter()
        .map(|row| AemoOperationalMixPoint {
            interval_start_utc: parsed.interval_start_utc.clone(),
            region_code: row.region_code,
            source_key: row.source_key,
            generation_mw: row.generation_mw,
            share_pct: row.share_pct,
        })
        .collect())
}
