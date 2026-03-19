use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;
use crate::parsers::csv_parser;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RbaRatePoint {
    pub series_id: String,
    pub date: String,
    pub value: f64,
}

pub async fn fetch_rates(
    client: &(impl SourceFetch + ?Sized),
) -> Result<Vec<RbaRatePoint>, SourceClientError> {
    let url = "https://www.rba.gov.au/statistics/csv/f06.csv";
    let resp = client.get(url, "text/csv,text/plain").await?;
    let rows = csv_parser::parse_csv_rows(&resp.body);
    let mut points = Vec::new();

    for row in rows {
        let date = row
            .get("date")
            .or_else(|| row.get("Date"))
            .cloned()
            .unwrap_or_default();
        if date.is_empty() {
            continue;
        }

        if let Some(v) = row
            .get("oo_variable_pct")
            .or_else(|| row.get("OO_VARIABLE_PCT"))
            .and_then(|v| v.parse::<f64>().ok())
        {
            points.push(RbaRatePoint {
                series_id: "rates.oo.variable_pct".to_string(),
                date: date.clone(),
                value: v,
            });
        }
        if let Some(v) = row
            .get("oo_fixed_pct")
            .or_else(|| row.get("OO_FIXED_PCT"))
            .and_then(|v| v.parse::<f64>().ok())
        {
            points.push(RbaRatePoint {
                series_id: "rates.oo.fixed_pct".to_string(),
                date: date.clone(),
                value: v,
            });
        }
    }

    Ok(points)
}
