use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EiaOilDataPoint {
    pub country_region_id: String,
    pub country_region_name: String,
    pub period: String,
    pub activity_id: u32,
    pub activity_name: String,
    pub product_id: u32,
    pub product_name: String,
    pub value: f64,
    pub unit: String,
}

#[derive(Deserialize)]
struct EiaInternationalResponse {
    response: EiaResponseBody,
}

#[derive(Deserialize)]
struct EiaResponseBody {
    data: Vec<EiaInternationalRow>,
}

fn deserialize_string_or_f64<'de, D>(deserializer: D) -> Result<Option<f64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de;
    struct StringOrF64;
    impl<'de> de::Visitor<'de> for StringOrF64 {
        type Value = Option<f64>;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("an f64 or string-encoded f64")
        }
        fn visit_f64<E: de::Error>(self, v: f64) -> Result<Self::Value, E> { Ok(Some(v)) }
        fn visit_u64<E: de::Error>(self, v: u64) -> Result<Self::Value, E> { Ok(Some(v as f64)) }
        fn visit_i64<E: de::Error>(self, v: i64) -> Result<Self::Value, E> { Ok(Some(v as f64)) }
        fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
            if v == "NA" || v == "--" || v.is_empty() { return Ok(None); }
            v.parse::<f64>().map(Some).map_err(de::Error::custom)
        }
        fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> { Ok(None) }
        fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> { Ok(None) }
    }
    deserializer.deserialize_any(StringOrF64)
}

fn deserialize_string_or_u32<'de, D>(deserializer: D) -> Result<Option<u32>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de;
    struct StringOrU32;
    impl<'de> de::Visitor<'de> for StringOrU32 {
        type Value = Option<u32>;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("a u32 or string-encoded u32")
        }
        fn visit_u64<E: de::Error>(self, v: u64) -> Result<Self::Value, E> {
            Ok(Some(v as u32))
        }
        fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
            v.parse::<u32>().map(Some).map_err(de::Error::custom)
        }
        fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> { Ok(None) }
        fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> { Ok(None) }
    }
    deserializer.deserialize_any(StringOrU32)
}

#[derive(Deserialize)]
struct EiaInternationalRow {
    period: Option<String>,
    #[serde(rename = "countryRegionId")]
    country_region_id: Option<String>,
    #[serde(rename = "countryRegionName")]
    country_region_name: Option<String>,
    #[serde(rename = "activityId", default, deserialize_with = "deserialize_string_or_u32")]
    activity_id: Option<u32>,
    #[serde(rename = "activityName")]
    activity_name: Option<String>,
    #[serde(rename = "productId", default, deserialize_with = "deserialize_string_or_u32")]
    product_id: Option<u32>,
    #[serde(rename = "productName")]
    product_name: Option<String>,
    #[serde(default, deserialize_with = "deserialize_string_or_f64")]
    value: Option<f64>,
    unit: Option<String>,
}

pub async fn fetch_oil_data(
    client: &(impl SourceFetch + ?Sized),
    base_url: &str,
) -> Result<Vec<EiaOilDataPoint>, SourceClientError> {
    let resp = client.get(base_url, "application/json").await?;
    let parsed: EiaInternationalResponse = serde_json::from_str(&resp.body)
        .map_err(|e| SourceClientError::permanent(format!("Failed to parse EIA petroleum: {e}")))?;

    let points = parsed
        .response
        .data
        .into_iter()
        .filter_map(|row| {
            Some(EiaOilDataPoint {
                country_region_id: row.country_region_id?,
                country_region_name: row.country_region_name.unwrap_or_default(),
                period: row.period?,
                activity_id: row.activity_id?,
                activity_name: row.activity_name.unwrap_or_default(),
                product_id: row.product_id.unwrap_or(57),
                product_name: row.product_name.unwrap_or_default(),
                value: row.value?,
                unit: row.unit.unwrap_or_else(|| "TBPD".into()),
            })
        })
        .collect();

    Ok(points)
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
    async fn parses_valid_eia_response() {
        let json = r#"{
            "response": {
                "data": [
                    {
                        "period": "2025-09",
                        "countryRegionId": "AUS",
                        "countryRegionName": "Australia",
                        "productId": 57,
                        "productName": "Crude oil including lease condensate",
                        "activityId": 1,
                        "activityName": "Production",
                        "value": 302.456,
                        "unit": "TBPD"
                    }
                ]
            }
        }"#;

        let fetcher = MockFetcher {
            body: json.to_string(),
        };
        let points = fetch_oil_data(&fetcher, "http://test").await.unwrap();
        assert_eq!(points.len(), 1);
        assert_eq!(points[0].country_region_id, "AUS");
        assert_eq!(points[0].period, "2025-09");
        assert_eq!(points[0].activity_id, 1);
        assert!((points[0].value - 302.456).abs() < f64::EPSILON);
        assert_eq!(points[0].unit, "TBPD");
    }

    #[tokio::test]
    async fn skips_rows_with_null_values() {
        let json = r#"{
            "response": {
                "data": [
                    {
                        "period": "2025-09",
                        "countryRegionId": "AUS",
                        "countryRegionName": "Australia",
                        "activityId": 1,
                        "activityName": "Production",
                        "productId": 57,
                        "productName": "Crude oil",
                        "value": null,
                        "unit": "TBPD"
                    },
                    {
                        "period": null,
                        "countryRegionId": "AUS",
                        "countryRegionName": "Australia",
                        "activityId": 1,
                        "activityName": "Production",
                        "value": 100.0,
                        "unit": "TBPD"
                    },
                    {
                        "period": "2025-09",
                        "countryRegionId": "USA",
                        "countryRegionName": "United States",
                        "activityId": 1,
                        "activityName": "Production",
                        "productId": 57,
                        "productName": "Crude oil",
                        "value": 12500.0,
                        "unit": "TBPD"
                    }
                ]
            }
        }"#;

        let fetcher = MockFetcher {
            body: json.to_string(),
        };
        let points = fetch_oil_data(&fetcher, "http://test").await.unwrap();
        assert_eq!(points.len(), 1);
        assert_eq!(points[0].country_region_id, "USA");
    }

    #[tokio::test]
    async fn returns_permanent_error_on_malformed_json() {
        let fetcher = MockFetcher {
            body: "not json".to_string(),
        };
        let err = fetch_oil_data(&fetcher, "http://test").await.unwrap_err();
        assert!(!err.is_transient);
        assert!(err.message.contains("Failed to parse EIA petroleum"));
    }
}
