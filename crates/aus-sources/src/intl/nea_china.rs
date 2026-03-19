use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NeaChinaWholesaleProxyPoint {
    pub period: String,
    pub price_cny_kwh: f64,
}

pub async fn fetch_wholesale_proxy(
    client: &(impl SourceFetch + ?Sized),
) -> Result<Vec<NeaChinaWholesaleProxyPoint>, SourceClientError> {
    let url = "https://fjb.nea.gov.cn/dtyw/gjnyjdt/202309/t20230915_83144.html";
    let resp = client.get(url, "text/html,text/plain").await?;

    let re =
        regex::Regex::new(r"(20\d{2})年[^。]{0,120}?市场平均交易价格为\s*([0-9.]+)\s*元/千瓦时")
            .map_err(|e| SourceClientError::permanent(format!("Regex error: {e}")))?;

    let caps = re.captures(&resp.body).ok_or_else(|| {
        SourceClientError::permanent("Could not find NEA China wholesale price in HTML")
    })?;

    let period = caps[1].to_string();
    let price = caps[2]
        .parse::<f64>()
        .map_err(|_| SourceClientError::permanent("Could not parse NEA price"))?;

    Ok(vec![NeaChinaWholesaleProxyPoint {
        period,
        price_cny_kwh: price,
    }])
}
