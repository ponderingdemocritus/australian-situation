use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone)]
pub struct UnComtradeConfig {
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnComtradeOilImport {
    pub partner_code: i64,
    pub partner_name: String,
    pub hs_code: String,
    pub period: String,
    pub value_usd: f64,
    pub net_weight_kg: f64,
}

#[derive(Deserialize)]
struct ComtradeResponse {
    data: Option<Vec<ComtradeRow>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ComtradeRow {
    partner_code: Option<i64>,
    partner_desc: Option<String>,
    primary_value: Option<f64>,
    net_wgt: Option<f64>,
    period: Option<i64>,
    cmd_code: Option<String>,
}

/// Fetch Australian oil import data from the UN Comtrade API v1.
///
/// `cmd_codes` are HS commodity codes (e.g. `["2709", "2710"]`).
/// `periods` are years as strings (e.g. `["2023", "2024"]`).
pub async fn fetch_oil_imports(
    client: &(impl SourceFetch + ?Sized),
    config: &UnComtradeConfig,
    cmd_codes: &[&str],
    periods: &[&str],
) -> Result<Vec<UnComtradeOilImport>, SourceClientError> {
    let cmd_param = cmd_codes.join(",");
    let period_param = periods.join(",");

    let url = format!(
        "https://comtradeapi.un.org/data/v1/get/C/A\
         ?reporterCode=36\
         &flowCode=M\
         &cmdCode={}\
         &period={}\
         &subscription-key={}",
        cmd_param, period_param, config.api_key,
    );

    let resp = client.get(&url, "application/json").await?;
    let parsed: ComtradeResponse = serde_json::from_str(&resp.body).map_err(|e| {
        SourceClientError::permanent(format!("Failed to parse UN Comtrade response: {e}"))
    })?;

    let rows = parsed.data.unwrap_or_default();

    let imports = rows
        .into_iter()
        .filter_map(|row| {
            Some(UnComtradeOilImport {
                partner_code: row.partner_code?,
                partner_name: row.partner_desc.unwrap_or_default(),
                hs_code: row.cmd_code?,
                period: row.period?.to_string(),
                value_usd: row.primary_value.unwrap_or(0.0),
                net_weight_kg: row.net_wgt.unwrap_or(0.0),
            })
        })
        .collect();

    Ok(imports)
}

/// Map a UN M49 numeric partner code to an ISO 3166-1 alpha-2 code.
///
/// This covers the most common partners for Australian oil imports.
/// Unknown codes fall through as the numeric code stringified.
pub fn m49_to_iso2(code: i64) -> &'static str {
    match code {
        36 => "AU",
        156 => "CN",
        356 => "IN",
        360 => "ID",
        392 => "JP",
        410 => "KR",
        458 => "MY",
        566 => "NG",
        598 => "PG",
        634 => "QA",
        643 => "RU",
        682 => "SA",
        702 => "SG",
        784 => "AE",
        840 => "US",
        96 => "BN",
        158 => "TW",
        704 => "VN",
        178 => "CG",
        _ => "XX",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::SourceClientError;
    use crate::fetch::{FetchResponse, SourceFetch};
    use async_trait::async_trait;

    struct MockFetcher {
        body: String,
    }

    #[async_trait]
    impl SourceFetch for MockFetcher {
        async fn get(
            &self,
            _url: &str,
            _accept: &str,
        ) -> Result<FetchResponse, SourceClientError> {
            Ok(FetchResponse {
                status: 200,
                body: self.body.clone(),
            })
        }
    }

    #[tokio::test]
    async fn parses_valid_comtrade_response() {
        let json = r#"{
            "data": [
                {
                    "partnerCode": 682,
                    "partnerDesc": "Saudi Arabia",
                    "primaryValue": 5000000000.0,
                    "netWgt": 12000000000.0,
                    "period": 2024,
                    "cmdCode": "2709"
                }
            ]
        }"#;

        let fetcher = MockFetcher {
            body: json.to_string(),
        };
        let config = UnComtradeConfig {
            api_key: "test-key".to_string(),
        };
        let imports = fetch_oil_imports(&fetcher, &config, &["2709"], &["2024"])
            .await
            .unwrap();
        assert_eq!(imports.len(), 1);
        assert_eq!(imports[0].partner_code, 682);
        assert_eq!(imports[0].partner_name, "Saudi Arabia");
        assert_eq!(imports[0].hs_code, "2709");
        assert_eq!(imports[0].period, "2024");
        assert!((imports[0].value_usd - 5_000_000_000.0).abs() < f64::EPSILON);
    }

    #[tokio::test]
    async fn skips_rows_with_missing_partner_code() {
        let json = r#"{
            "data": [
                {
                    "partnerCode": null,
                    "partnerDesc": "Unknown",
                    "primaryValue": 100.0,
                    "netWgt": 200.0,
                    "period": 2024,
                    "cmdCode": "2709"
                },
                {
                    "partnerCode": 840,
                    "partnerDesc": "United States",
                    "primaryValue": 300.0,
                    "netWgt": 400.0,
                    "period": 2024,
                    "cmdCode": "2709"
                }
            ]
        }"#;

        let fetcher = MockFetcher {
            body: json.to_string(),
        };
        let config = UnComtradeConfig {
            api_key: "test-key".to_string(),
        };
        let imports = fetch_oil_imports(&fetcher, &config, &["2709"], &["2024"])
            .await
            .unwrap();
        assert_eq!(imports.len(), 1);
        assert_eq!(imports[0].partner_code, 840);
    }

    #[tokio::test]
    async fn handles_empty_data_array() {
        let json = r#"{ "data": [] }"#;
        let fetcher = MockFetcher {
            body: json.to_string(),
        };
        let config = UnComtradeConfig {
            api_key: "test-key".to_string(),
        };
        let imports = fetch_oil_imports(&fetcher, &config, &["2709"], &["2024"])
            .await
            .unwrap();
        assert!(imports.is_empty());
    }

    #[tokio::test]
    async fn handles_null_data_field() {
        let json = r#"{ "data": null }"#;
        let fetcher = MockFetcher {
            body: json.to_string(),
        };
        let config = UnComtradeConfig {
            api_key: "test-key".to_string(),
        };
        let imports = fetch_oil_imports(&fetcher, &config, &["2709"], &["2024"])
            .await
            .unwrap();
        assert!(imports.is_empty());
    }

    #[tokio::test]
    async fn returns_permanent_error_on_malformed_json() {
        let fetcher = MockFetcher {
            body: "not json".to_string(),
        };
        let config = UnComtradeConfig {
            api_key: "test-key".to_string(),
        };
        let err = fetch_oil_imports(&fetcher, &config, &["2709"], &["2024"])
            .await
            .unwrap_err();
        assert!(!err.is_transient);
        assert!(err.message.contains("Failed to parse UN Comtrade"));
    }

    #[test]
    fn m49_maps_common_codes() {
        assert_eq!(m49_to_iso2(682), "SA");
        assert_eq!(m49_to_iso2(840), "US");
        assert_eq!(m49_to_iso2(458), "MY");
        assert_eq!(m49_to_iso2(784), "AE");
        assert_eq!(m49_to_iso2(598), "PG");
        assert_eq!(m49_to_iso2(9999), "XX");
    }
}
