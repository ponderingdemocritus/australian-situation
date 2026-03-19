use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AerRetailPlan {
    pub plan_id: String,
    pub region_code: String,
    pub customer_type: String,
    pub annual_bill_aud: f64,
}

#[derive(Deserialize)]
struct AerResponse {
    data: Vec<AerDataItem>,
}

#[derive(Deserialize)]
struct AerDataItem {
    id: String,
    attributes: AerAttributes,
}

#[derive(Deserialize)]
struct AerAttributes {
    region_code: String,
    customer_type: String,
    annual_bill_aud: f64,
}

pub async fn fetch_retail_plans(
    client: &(impl SourceFetch + ?Sized),
) -> Result<Vec<AerRetailPlan>, SourceClientError> {
    let url = "https://www.aer.gov.au/energy-product-reference-data";
    let resp = client.get(url, "application/json").await?;
    let parsed: AerResponse = serde_json::from_str(&resp.body)
        .map_err(|e| SourceClientError::permanent(format!("Failed to parse AER: {e}")))?;

    Ok(parsed
        .data
        .into_iter()
        .map(|d| AerRetailPlan {
            plan_id: d.id,
            region_code: d.attributes.region_code,
            customer_type: d.attributes.customer_type,
            annual_bill_aud: d.attributes.annual_bill_aud,
        })
        .collect())
}
