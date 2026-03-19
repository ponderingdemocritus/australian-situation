use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbsObservation {
    pub series_id: String,
    pub region_code: String,
    pub date: String,
    pub value: f64,
    pub unit: String,
}

#[derive(Deserialize)]
struct AbsResponse {
    observations: Vec<AbsObsRow>,
}

#[derive(Deserialize)]
struct AbsObsRow {
    series_id: String,
    region_code: String,
    date: String,
    value: f64,
    unit: String,
}

pub async fn fetch_housing(
    client: &(impl SourceFetch + ?Sized),
) -> Result<Vec<AbsObservation>, SourceClientError> {
    let url = "https://data.api.abs.gov.au/rest/data/ABS,HOUSING";
    let resp = client.get(url, "application/json").await?;
    let parsed: AbsResponse = serde_json::from_str(&resp.body)
        .map_err(|e| SourceClientError::permanent(format!("Failed to parse ABS housing: {e}")))?;

    Ok(parsed
        .observations
        .into_iter()
        .map(|o| AbsObservation {
            series_id: o.series_id,
            region_code: o.region_code,
            date: o.date,
            value: o.value,
            unit: o.unit,
        })
        .collect())
}

pub async fn fetch_cpi(
    client: &(impl SourceFetch + ?Sized),
) -> Result<Vec<AbsObservation>, SourceClientError> {
    let url = "https://data.api.abs.gov.au/rest/data/ABS,CPI";
    let resp = client.get(url, "application/json").await?;
    let parsed: AbsResponse = serde_json::from_str(&resp.body)
        .map_err(|e| SourceClientError::permanent(format!("Failed to parse ABS CPI: {e}")))?;

    Ok(parsed
        .observations
        .into_iter()
        .map(|o| AbsObservation {
            series_id: o.series_id,
            region_code: o.region_code,
            date: o.date,
            value: o.value,
            unit: o.unit,
        })
        .collect())
}
