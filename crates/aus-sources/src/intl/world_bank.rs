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

/// Fetch normalization indicators from the World Bank API v2.
///
/// The API returns: [ {page info}, [ {indicator, country, date, value, ...}, ... ] ]
pub async fn fetch_normalization(
    client: &(impl SourceFetch + ?Sized),
    _url: &str, // ignored - we use real API URLs
) -> Result<Vec<WorldBankNormalizationPoint>, SourceClientError> {
    let indicators = [
        ("PA.NUS.FCRF", "FX rate"),
        ("PA.NUS.PPP", "PPP factor"),
    ];
    let countries = "AUS;USA;GBR;DEU;JPN;NZL;SGP;IDN;CHN";

    let mut all_points = Vec::new();

    for (indicator, label) in &indicators {
        let url = format!(
            "https://api.worldbank.org/v2/country/{countries}/indicator/{indicator}?format=json&date=2018:2026&per_page=500"
        );
        let resp = client.get(&url, "application/json").await?;
        let parsed: serde_json::Value = serde_json::from_str(&resp.body).map_err(|e| {
            SourceClientError::permanent(format!("Failed to parse World Bank {label}: {e}"))
        })?;

        // Response is an array: [pagination_info, data_array]
        let data_array = match parsed.as_array().and_then(|a| a.get(1)) {
            Some(d) => d,
            None => continue,
        };

        let records = match data_array.as_array() {
            Some(r) => r,
            None => continue,
        };

        for record in records {
            let country_code = record["countryiso3code"]
                .as_str()
                .unwrap_or("")
                .to_string();
            let year = record["date"].as_str().unwrap_or("").to_string();
            let value = match record["value"].as_f64() {
                Some(v) => v,
                None => continue, // null values are common for recent years
            };

            // Convert ISO3 to ISO2 for consistency
            let country_code_2 = iso3_to_iso2(&country_code);

            all_points.push(WorldBankNormalizationPoint {
                country_code: country_code_2,
                year,
                indicator_code: indicator.to_string(),
                value,
            });
        }
    }

    tracing::info!(
        "fetch_normalization: parsed {} World Bank points",
        all_points.len()
    );
    Ok(all_points)
}

fn iso3_to_iso2(iso3: &str) -> String {
    match iso3 {
        "AUS" => "AU",
        "USA" => "US",
        "GBR" => "GB",
        "DEU" => "DE",
        "JPN" => "JP",
        "NZL" => "NZ",
        "SGP" => "SG",
        "IDN" => "ID",
        "CHN" => "CN",
        _ => iso3,
    }
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_iso3_conversion() {
        assert_eq!(iso3_to_iso2("AUS"), "AU");
        assert_eq!(iso3_to_iso2("USA"), "US");
        assert_eq!(iso3_to_iso2("XYZ"), "XYZ"); // unknown passes through
    }
}
