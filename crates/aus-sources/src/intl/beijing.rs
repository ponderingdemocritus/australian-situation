use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeijingResidentialTariffPoint {
    pub period: String,
    pub price_local_kwh: f64,
}

pub async fn fetch_tariff(
    client: &(impl SourceFetch + ?Sized),
) -> Result<Vec<BeijingResidentialTariffPoint>, SourceClientError> {
    let url = "https://fgw.beijing.gov.cn/bmcx/djcx/jzldj/202110/t20211025_2520169.htm";
    let resp = client.get(url, "text/html,text/plain").await?;

    let re = regex::Regex::new(
        r"(?is)Residential electricity users[\s\S]{0,120}?less than 1\s*kV[\s\S]{0,120}?([0-9]+\.[0-9]+)",
    )
    .map_err(|e| SourceClientError::permanent(format!("Regex error: {e}")))?;

    let price = re
        .captures(&resp.body)
        .and_then(|c| c[1].parse::<f64>().ok())
        .ok_or_else(|| {
            SourceClientError::permanent("Could not find Beijing tariff price in HTML")
        })?;

    // Extract date from URL
    let date_re = regex::Regex::new(r"t(\d{4})(\d{2})(\d{2})_").unwrap();
    let period = date_re
        .captures(url)
        .map(|c| format!("{}-{}-{}", &c[1], &c[2], &c[3]))
        .unwrap_or_else(|| "2021-10-25".to_string());

    Ok(vec![BeijingResidentialTariffPoint {
        period,
        price_local_kwh: price,
    }])
}
