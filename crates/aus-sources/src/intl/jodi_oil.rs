use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

/// A single JODI Oil data point for a country/period/flow combination.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JodiOilDataPoint {
    pub country_code: String,
    pub period: String,
    pub product: String,
    pub flow: String,
    pub value_kbd: f64,
}

/// Flows we are interested in.
const RELEVANT_FLOWS: &[&str] = &["INDPROD", "TOTIMPSB", "TOTEXPSB", "REFINOBS"];

/// Build the JODI primary CSV URL for a given year.
fn jodi_url(year: u32) -> String {
    if year >= 2026 {
        format!(
            "https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/primary/primaryyear{}.csv",
            year
        )
    } else {
        format!(
            "https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/primary/{}.csv",
            year
        )
    }
}

/// Fetch and parse JODI Oil CSV data for the given years, filtered to Australian crude oil in KBD.
pub async fn fetch_jodi_oil(
    client: &(impl SourceFetch + ?Sized),
    years: &[u32],
) -> Result<Vec<JodiOilDataPoint>, SourceClientError> {
    let mut all_points = Vec::new();

    for &year in years {
        let url = jodi_url(year);
        let resp = client.get(&url, "*/*").await?;
        let points = parse_jodi_csv(&resp.body)?;
        all_points.extend(points);
    }

    Ok(all_points)
}

/// Parse a JODI CSV body into filtered data points.
fn parse_jodi_csv(body: &str) -> Result<Vec<JodiOilDataPoint>, SourceClientError> {
    let mut points = Vec::new();
    let mut lines = body.lines();

    // Skip header
    let _header = lines.next();

    for line in lines {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let fields: Vec<&str> = line.split(',').collect();
        if fields.len() < 7 {
            continue;
        }

        let ref_area = fields[0].trim();
        let time_period = fields[1].trim();
        let energy_product = fields[2].trim();
        let flow_breakdown = fields[3].trim();
        let unit_measure = fields[4].trim();
        let obs_value = fields[5].trim();

        // Filter: AU, KBD, CRUDEOIL, relevant flows
        if ref_area != "AU" {
            continue;
        }
        if unit_measure != "KBD" {
            continue;
        }
        if energy_product != "CRUDEOIL" {
            continue;
        }
        if !RELEVANT_FLOWS.contains(&flow_breakdown) {
            continue;
        }

        // Skip missing/confidential values
        if obs_value == "-" || obs_value == "x" || obs_value.is_empty() {
            continue;
        }

        let value: f64 = match obs_value.parse() {
            Ok(v) => v,
            Err(_) => continue,
        };

        points.push(JodiOilDataPoint {
            country_code: ref_area.to_string(),
            period: time_period.to_string(),
            product: energy_product.to_string(),
            flow: flow_breakdown.to_string(),
            value_kbd: value,
        });
    }

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

        async fn get_bytes(
            &self,
            _url: &str,
            _accept: &str,
        ) -> Result<crate::fetch::FetchBytesResponse, SourceClientError> {
            Ok(crate::fetch::FetchBytesResponse {
                status: 200,
                body: self.body.as_bytes().to_vec(),
            })
        }
    }

    fn sample_csv() -> String {
        [
            "REF_AREA,TIME_PERIOD,ENERGY_PRODUCT,FLOW_BREAKDOWN,UNIT_MEASURE,OBS_VALUE,ASSESSMENT_CODE",
            "AU,2025-01,CRUDEOIL,INDPROD,KBD,302.5,A",
            "AU,2025-01,CRUDEOIL,TOTIMPSB,KBD,150.3,A",
            "AU,2025-01,CRUDEOIL,TOTEXPSB,KBD,200.1,A",
            "AU,2025-01,CRUDEOIL,REFINOBS,KBD,400.0,A",
            "US,2025-01,CRUDEOIL,INDPROD,KBD,12000.0,A",
            "AU,2025-01,TOTCRUDE,INDPROD,KBD,350.0,A",
            "AU,2025-01,CRUDEOIL,INDPROD,KBBL,9000.0,A",
            "AU,2025-02,CRUDEOIL,INDPROD,KBD,-,A",
            "AU,2025-02,CRUDEOIL,TOTIMPSB,KBD,x,A",
            "AU,2025-02,CRUDEOIL,TOTEXPSB,KBD,,A",
        ]
        .join("\n")
    }

    #[tokio::test]
    async fn parses_valid_jodi_csv() {
        let fetcher = MockFetcher {
            body: sample_csv(),
        };
        let points = fetch_jodi_oil(&fetcher, &[2025]).await.unwrap();
        assert_eq!(points.len(), 4);
        assert_eq!(points[0].country_code, "AU");
        assert_eq!(points[0].period, "2025-01");
        assert_eq!(points[0].flow, "INDPROD");
        assert!((points[0].value_kbd - 302.5).abs() < f64::EPSILON);
    }

    #[tokio::test]
    async fn filters_non_au_rows() {
        let fetcher = MockFetcher {
            body: sample_csv(),
        };
        let points = fetch_jodi_oil(&fetcher, &[2025]).await.unwrap();
        assert!(points.iter().all(|p| p.country_code == "AU"));
    }

    #[tokio::test]
    async fn filters_non_crudeoil_products() {
        let fetcher = MockFetcher {
            body: sample_csv(),
        };
        let points = fetch_jodi_oil(&fetcher, &[2025]).await.unwrap();
        assert!(points.iter().all(|p| p.product == "CRUDEOIL"));
    }

    #[tokio::test]
    async fn filters_non_kbd_units() {
        let fetcher = MockFetcher {
            body: sample_csv(),
        };
        let points = fetch_jodi_oil(&fetcher, &[2025]).await.unwrap();
        // The KBBL row should be excluded
        assert!(!points.iter().any(|p| p.value_kbd > 1000.0));
    }

    #[tokio::test]
    async fn skips_missing_and_confidential_values() {
        let fetcher = MockFetcher {
            body: sample_csv(),
        };
        let points = fetch_jodi_oil(&fetcher, &[2025]).await.unwrap();
        // Only 4 valid AU/CRUDEOIL/KBD rows from 2025-01; the 2025-02 rows have -, x, empty
        assert_eq!(points.len(), 4);
    }

    #[tokio::test]
    async fn includes_all_relevant_flows() {
        let fetcher = MockFetcher {
            body: sample_csv(),
        };
        let points = fetch_jodi_oil(&fetcher, &[2025]).await.unwrap();
        let flows: Vec<&str> = points.iter().map(|p| p.flow.as_str()).collect();
        assert!(flows.contains(&"INDPROD"));
        assert!(flows.contains(&"TOTIMPSB"));
        assert!(flows.contains(&"TOTEXPSB"));
        assert!(flows.contains(&"REFINOBS"));
    }

    #[test]
    fn url_for_2024() {
        assert_eq!(
            jodi_url(2024),
            "https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/primary/2024.csv"
        );
    }

    #[test]
    fn url_for_2025() {
        assert_eq!(
            jodi_url(2025),
            "https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/primary/2025.csv"
        );
    }

    #[test]
    fn url_for_2026() {
        assert_eq!(
            jodi_url(2026),
            "https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/primary/primaryyear2026.csv"
        );
    }
}
