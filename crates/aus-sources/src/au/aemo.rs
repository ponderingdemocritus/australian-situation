use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;
use crate::parsers::csv_parser;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AemoWholesalePoint {
    pub settlement_date: String,
    pub region_code: String,
    pub rrp_aud_mwh: f64,
    pub demand_mwh: Option<f64>,
}

fn normalize_aemo_region(region: &str) -> String {
    region.trim_end_matches('1').to_string()
}

pub async fn fetch_wholesale(
    client: &(impl SourceFetch + ?Sized),
) -> Result<Vec<AemoWholesalePoint>, SourceClientError> {
    let url = "https://www.nemweb.com.au/REPORTS/CURRENT/Dispatch_SCADA/";
    let resp = client.get(url, "text/csv,text/plain").await?;

    let rows = csv_parser::parse_csv_rows(&resp.body);
    let mut points = Vec::new();

    for row in rows {
        let region = row.get("REGIONID").cloned().unwrap_or_default();
        let rrp = row
            .get("RRP")
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(0.0);
        let date = row.get("SETTLEMENTDATE").cloned().unwrap_or_default();
        let demand = row.get("TOTALDEMAND").and_then(|v| v.parse::<f64>().ok());

        if !region.is_empty() && !date.is_empty() {
            points.push(AemoWholesalePoint {
                settlement_date: date,
                region_code: normalize_aemo_region(&region),
                rrp_aud_mwh: rrp,
                demand_mwh: demand,
            });
        }
    }

    Ok(points)
}
