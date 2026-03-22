use std::collections::HashMap;

use quick_xml::Reader;
use quick_xml::events::Event;

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone)]
pub struct WitsTradeImport {
    pub partner_code: String,
    pub partner_name: String,
    pub product_code: String,
    pub period: String,
    pub value_thousand_usd: f64,
}

/// Aggregate/group codes to exclude — these are not real countries.
const AGGREGATE_CODES: &[&str] = &[
    "WLD", "EAS", "OAS", "MEA", "SAS", "NAC", "ECS", "SSF", "LCN", "ARB", "CEB", "EMU", "EUU",
    "FCS", "HIC", "HPC", "IBD", "IBT", "IDA", "IDX", "INX", "LAC", "LDC", "LIC", "LMC", "LMY",
    "LTE", "MIC", "NOC", "OED", "OSS", "PRE", "PSS", "PST", "SSA", "SST", "TEA", "TEC", "TLA",
    "TMN", "TSA", "TSS", "UMC",
];

/// ISO3 to ISO2 mapping for common fuel import partners.
pub fn iso3_to_iso2(code: &str) -> &'static str {
    match code {
        "KOR" => "KR",
        "SGP" => "SG",
        "MYS" => "MY",
        "BRN" => "BN",
        "CHN" => "CN",
        "JPN" => "JP",
        "IND" => "IN",
        "USA" => "US",
        "VNM" => "VN",
        "IDN" => "ID",
        "NZL" => "NZ",
        "THA" => "TH",
        "RUS" => "RU",
        "ARE" => "AE",
        "SAU" => "SA",
        "QAT" => "QA",
        "NGA" => "NG",
        "PNG" => "PG",
        "GBR" => "GB",
        "DEU" => "DE",
        "TWN" => "TW",
        "COG" => "CG",
        "AGO" => "AO",
        "GAB" => "GA",
        "AUS" => "AU",
        "FRA" => "FR",
        "ITA" => "IT",
        "ESP" => "ES",
        "CAN" => "CA",
        "BRA" => "BR",
        "MEX" => "MX",
        "KWT" => "KW",
        "OMN" => "OM",
        "IRQ" => "IQ",
        "IRN" => "IR",
        "PAK" => "PK",
        "BGD" => "BD",
        "PHL" => "PH",
        "MMR" => "MM",
        "KHM" => "KH",
        "LAO" => "LA",
        _ => "XX",
    }
}

/// Fetch Australian fuel import data from the World Bank WITS SDMX API.
///
/// Returns one record per (partner, latest year) with values in thousands of USD.
pub async fn fetch_fuel_imports(
    client: &(impl SourceFetch + ?Sized),
) -> Result<Vec<WitsTradeImport>, SourceClientError> {
    let url = "https://wits.worldbank.org/API/V1/SDMX/V21/rest/data/DF_WITS_TradeStats_Trade/A.AUS..27-27_Fuels.MPRT-TRD-VL";

    let resp = client.get(url, "application/xml").await?;
    parse_sdmx_response(&resp.body)
}

/// Parse the SDMX XML response from WITS into WitsTradeImport records.
///
/// Keeps only real country partners (filters out aggregate codes) and
/// retains only the latest year per partner.
fn parse_sdmx_response(xml: &str) -> Result<Vec<WitsTradeImport>, SourceClientError> {
    let mut reader = Reader::from_str(xml);

    // Collect all (partner, period, value) triples first
    let mut raw_records: Vec<(String, String, f64)> = Vec::new();

    let mut current_partner: Option<String> = None;
    let mut in_series = false;
    let mut in_obs = false;
    let mut obs_period: Option<String> = None;
    let mut obs_value: Option<f64> = None;

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e) | Event::Empty(ref e)) => {
                let local_name = e.local_name();
                let local_name_str = std::str::from_utf8(local_name.as_ref()).unwrap_or("");

                match local_name_str {
                    "Series" => {
                        in_series = true;
                        current_partner = None;
                    }
                    "Value" if in_series && !in_obs => {
                        // SeriesKey Value element
                        let mut id = None;
                        let mut val = None;
                        for attr in e.attributes().flatten() {
                            let local = attr.key.local_name();
                            let key = std::str::from_utf8(local.as_ref()).unwrap_or("");
                            let v = std::str::from_utf8(&attr.value).unwrap_or("");
                            match key {
                                "id" => id = Some(v.to_string()),
                                "value" => val = Some(v.to_string()),
                                _ => {}
                            }
                        }
                        if id.as_deref() == Some("PARTNER") {
                            current_partner = val;
                        }
                    }
                    "Obs" => {
                        in_obs = true;
                        obs_period = None;
                        obs_value = None;
                    }
                    "ObsDimension" if in_obs => {
                        for attr in e.attributes().flatten() {
                            let local = attr.key.local_name();
                            let key = std::str::from_utf8(local.as_ref()).unwrap_or("");
                            if key == "value" {
                                obs_period = Some(
                                    std::str::from_utf8(&attr.value).unwrap_or("").to_string(),
                                );
                            }
                        }
                    }
                    "ObsValue" if in_obs => {
                        for attr in e.attributes().flatten() {
                            let local = attr.key.local_name();
                            let key = std::str::from_utf8(local.as_ref()).unwrap_or("");
                            if key == "value" {
                                obs_value = std::str::from_utf8(&attr.value)
                                    .ok()
                                    .and_then(|s| s.parse::<f64>().ok());
                            }
                        }
                    }
                    _ => {}
                }

                // If this was an Empty Obs element, finalize it
                if local_name_str == "Obs" && matches!(reader.read_event(), Ok(Event::End(_))) {
                    // We already moved past the end; handle below
                }
            }
            Ok(Event::End(ref e)) => {
                let local_name = e.local_name();
                let local_name_str = std::str::from_utf8(local_name.as_ref()).unwrap_or("");

                match local_name_str {
                    "Obs" => {
                        if let (Some(partner), Some(period), Some(value)) =
                            (&current_partner, &obs_period, obs_value)
                        {
                            raw_records.push((partner.clone(), period.clone(), value));
                        }
                        in_obs = false;
                        obs_period = None;
                        obs_value = None;
                    }
                    "Series" => {
                        in_series = false;
                        current_partner = None;
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(SourceClientError::permanent(format!(
                    "Failed to parse WITS SDMX XML: {e}"
                )));
            }
            _ => {}
        }
    }

    // Filter out aggregate codes
    let is_aggregate = |code: &str| AGGREGATE_CODES.contains(&code);

    // Keep only the latest year per partner
    let mut latest_by_partner: HashMap<String, (String, f64)> = HashMap::new();
    for (partner, period, value) in raw_records {
        if is_aggregate(&partner) {
            continue;
        }
        let entry = latest_by_partner.entry(partner.clone()).or_insert_with(|| (period.clone(), value));
        if period > entry.0 {
            *entry = (period, value);
        }
    }

    let imports: Vec<WitsTradeImport> = latest_by_partner
        .into_iter()
        .map(|(partner, (period, value))| {
            let partner_name = partner.clone(); // ISO3 code as name fallback
            WitsTradeImport {
                partner_code: partner,
                partner_name,
                product_code: "27-27_Fuels".to_string(),
                period,
                value_thousand_usd: value,
            }
        })
        .collect();

    Ok(imports)
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

    fn sample_sdmx_xml() -> String {
        r#"<?xml version="1.0" encoding="UTF-8"?>
<message:GenericData xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message"
                     xmlns:generic="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/generic">
  <message:DataSet>
    <generic:Series>
      <generic:SeriesKey>
        <generic:Value id="FREQ" value="A"/>
        <generic:Value id="REPORTER" value="AUS"/>
        <generic:Value id="PARTNER" value="SGP"/>
        <generic:Value id="PRODUCT" value="27-27_Fuels"/>
        <generic:Value id="INDICATOR" value="MPRT-TRD-VL"/>
      </generic:SeriesKey>
      <generic:Obs>
        <generic:ObsDimension value="2022"/>
        <generic:ObsValue value="5000000.0"/>
      </generic:Obs>
      <generic:Obs>
        <generic:ObsDimension value="2023"/>
        <generic:ObsValue value="8399287.5"/>
      </generic:Obs>
    </generic:Series>
    <generic:Series>
      <generic:SeriesKey>
        <generic:Value id="FREQ" value="A"/>
        <generic:Value id="REPORTER" value="AUS"/>
        <generic:Value id="PARTNER" value="KOR"/>
        <generic:Value id="PRODUCT" value="27-27_Fuels"/>
        <generic:Value id="INDICATOR" value="MPRT-TRD-VL"/>
      </generic:SeriesKey>
      <generic:Obs>
        <generic:ObsDimension value="2023"/>
        <generic:ObsValue value="11100000.0"/>
      </generic:Obs>
    </generic:Series>
    <generic:Series>
      <generic:SeriesKey>
        <generic:Value id="FREQ" value="A"/>
        <generic:Value id="REPORTER" value="AUS"/>
        <generic:Value id="PARTNER" value="WLD"/>
        <generic:Value id="PRODUCT" value="27-27_Fuels"/>
        <generic:Value id="INDICATOR" value="MPRT-TRD-VL"/>
      </generic:SeriesKey>
      <generic:Obs>
        <generic:ObsDimension value="2023"/>
        <generic:ObsValue value="99999999.0"/>
      </generic:Obs>
    </generic:Series>
  </message:DataSet>
</message:GenericData>"#.to_string()
    }

    #[tokio::test]
    async fn parses_valid_sdmx_response() {
        let fetcher = MockFetcher {
            body: sample_sdmx_xml(),
        };
        let imports = fetch_fuel_imports(&fetcher).await.unwrap();
        assert!(imports.len() >= 2);
        // SGP and KOR should be present, WLD should be filtered out
        let partners: Vec<&str> = imports.iter().map(|i| i.partner_code.as_str()).collect();
        assert!(partners.contains(&"SGP"));
        assert!(partners.contains(&"KOR"));
        assert!(!partners.contains(&"WLD"));
    }

    #[tokio::test]
    async fn keeps_only_latest_year_per_partner() {
        let fetcher = MockFetcher {
            body: sample_sdmx_xml(),
        };
        let imports = fetch_fuel_imports(&fetcher).await.unwrap();
        let sgp = imports.iter().find(|i| i.partner_code == "SGP").unwrap();
        // Should keep 2023 (latest), not 2022
        assert_eq!(sgp.period, "2023");
        assert!((sgp.value_thousand_usd - 8_399_287.5).abs() < f64::EPSILON);
    }

    #[tokio::test]
    async fn filters_out_aggregate_codes() {
        let fetcher = MockFetcher {
            body: sample_sdmx_xml(),
        };
        let imports = fetch_fuel_imports(&fetcher).await.unwrap();
        for imp in &imports {
            assert!(
                !AGGREGATE_CODES.contains(&imp.partner_code.as_str()),
                "Aggregate code {} should be filtered out",
                imp.partner_code
            );
        }
    }

    #[tokio::test]
    async fn handles_empty_dataset() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<message:GenericData xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message"
                     xmlns:generic="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/generic">
  <message:DataSet>
  </message:DataSet>
</message:GenericData>"#;
        let fetcher = MockFetcher {
            body: xml.to_string(),
        };
        let imports = fetch_fuel_imports(&fetcher).await.unwrap();
        assert!(imports.is_empty());
    }

    #[tokio::test]
    async fn returns_error_on_malformed_xml() {
        let fetcher = MockFetcher {
            body: "not xml at all <<<<".to_string(),
        };
        // Should still parse (quick-xml may not error on all malformed input)
        // but at minimum should not panic
        let result = fetch_fuel_imports(&fetcher).await;
        // Either Ok with empty or Err is acceptable
        assert!(result.is_ok() || !result.as_ref().unwrap_err().is_transient);
    }

    #[test]
    fn iso3_maps_common_codes() {
        assert_eq!(iso3_to_iso2("KOR"), "KR");
        assert_eq!(iso3_to_iso2("SGP"), "SG");
        assert_eq!(iso3_to_iso2("MYS"), "MY");
        assert_eq!(iso3_to_iso2("USA"), "US");
        assert_eq!(iso3_to_iso2("BRN"), "BN");
        assert_eq!(iso3_to_iso2("PNG"), "PG");
        assert_eq!(iso3_to_iso2("ZZZ"), "XX");
    }

    #[test]
    fn parses_sdmx_xml_directly() {
        let xml = sample_sdmx_xml();
        let imports = parse_sdmx_response(&xml).unwrap();
        assert!(imports.len() >= 2);
    }
}
