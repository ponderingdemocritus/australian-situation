use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbsObservation {
    pub series_id: String,
    pub region_code: String,
    pub date: String,
    pub value: f64,
    pub unit: String,
}

/// Parse ABS SDMX CSV response into rows.
/// CSV format: DATAFLOW,DIM1,DIM2,...,TIME_PERIOD,OBS_VALUE,...
fn parse_sdmx_csv(
    body: &str,
    series_id_fn: impl Fn(&[&str]) -> Option<String>,
    region_fn: impl Fn(&[&str]) -> String,
) -> Vec<AbsObservation> {
    let mut lines = body.lines();
    let header = match lines.next() {
        Some(h) => h,
        None => return vec![],
    };

    let cols: Vec<&str> = header.split(',').collect();
    let time_idx = cols.iter().position(|c| *c == "TIME_PERIOD");
    let value_idx = cols.iter().position(|c| *c == "OBS_VALUE");

    let (time_idx, value_idx) = match (time_idx, value_idx) {
        (Some(t), Some(v)) => (t, v),
        _ => return vec![],
    };

    lines
        .filter_map(|line| {
            let fields: Vec<&str> = line.split(',').collect();
            if fields.len() <= time_idx.max(value_idx) {
                return None;
            }
            let value: f64 = fields[value_idx].parse().ok()?;
            let series_id = series_id_fn(&fields)?;
            let region = region_fn(&fields);
            let date = fields[time_idx].to_string();

            Some(AbsObservation {
                series_id,
                region_code: region,
                date,
                value,
                unit: "index".to_string(),
            })
        })
        .collect()
}

/// Fetch CPI data from ABS SDMX API.
///
/// Uses dataflow ABS,CPI with key: MEASURE.INDEX.TSEST.REGION.FREQ
/// - INDEX 10001 = All groups CPI
/// - INDEX 40001 = Electricity
/// - TSEST 10 = Original
/// - REGION 1 = Australia (weighted avg of 8 capitals)
/// - FREQ Q = Quarterly
pub async fn fetch_cpi(
    client: &(impl SourceFetch + ?Sized),
) -> Result<Vec<AbsObservation>, SourceClientError> {
    // All groups + Electricity CPI, original series, Australia, quarterly, from 2020
    let url = "https://data.api.abs.gov.au/rest/data/ABS,CPI/1.10001+40001.10.1.Q?startPeriod=2020-Q1&detail=dataonly";
    let resp = client.get(url, "text/csv").await?;

    let observations = parse_sdmx_csv(
        &resp.body,
        |fields| {
            // fields[2] = INDEX code
            let index = *fields.get(2)?;
            match index {
                "10001" => Some("cpi.all_groups.au.index".to_string()),
                "40001" => Some("cpi.electricity.au.index".to_string()),
                _ => None,
            }
        },
        |_fields| "AU".to_string(),
    );

    tracing::info!("fetch_cpi: parsed {} observations", observations.len());
    Ok(observations)
}

/// Fetch residential dwelling approvals from ABS SDMX API.
///
/// Uses dataflow ABS,RES_DWELL with key: MEASURE.REGION.FREQ
/// - MEASURE 1 = Number of dwelling units
/// Regions: 1=NSW, 2=VIC, 3=QLD, 4=SA, 5=WA, 6=TAS, 7=NT, 8=ACT, 0=AUS
pub async fn fetch_housing(
    client: &(impl SourceFetch + ?Sized),
) -> Result<Vec<AbsObservation>, SourceClientError> {
    // Dwelling approvals, all regions, quarterly, from 2020
    let url = "https://data.api.abs.gov.au/rest/data/ABS,RES_DWELL/1..Q?startPeriod=2020-Q1&detail=dataonly";
    let resp = client.get(url, "text/csv").await?;

    let observations = parse_sdmx_csv(
        &resp.body,
        |_fields| {
            // fields[1] = MEASURE (always 1 for dwelling units)
            Some("housing.dwelling_approvals.au.count".to_string())
        },
        |fields| {
            // fields[2] = REGION code
            let region = fields.get(2).unwrap_or(&"AU");
            abs_region_to_code(region).to_string()
        },
    );

    tracing::info!("fetch_housing: parsed {} observations", observations.len());
    Ok(observations)
}

fn abs_region_to_code(abs_region: &str) -> &str {
    // ABS uses compound codes like 1GSYD (Greater Sydney), 1RNSW (Rest of NSW)
    // The first digit maps to the state
    match abs_region {
        "0" | "AUS" => "AU",
        _ => match abs_region.chars().next() {
            Some('1') => "NSW",
            Some('2') => "VIC",
            Some('3') => "QLD",
            Some('4') => "SA",
            Some('5') => "WA",
            Some('6') => "TAS",
            Some('7') => "NT",
            Some('8') => "ACT",
            _ => "AU",
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_cpi_csv() {
        let csv = "DATAFLOW,MEASURE,INDEX,TSEST,REGION,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE\n\
                   ABS:CPI(2.0.0),1,10001,10,1,Q,2024-Q1,95.6,,,\n\
                   ABS:CPI(2.0.0),1,40001,10,1,Q,2024-Q1,88.2,,,";

        let obs = parse_sdmx_csv(
            csv,
            |f| match *f.get(2)? {
                "10001" => Some("cpi.all_groups.au.index".into()),
                "40001" => Some("cpi.electricity.au.index".into()),
                _ => None,
            },
            |_| "AU".to_string(),
        );

        assert_eq!(obs.len(), 2);
        assert_eq!(obs[0].series_id, "cpi.all_groups.au.index");
        assert!((obs[0].value - 95.6).abs() < 0.01);
        assert_eq!(obs[1].series_id, "cpi.electricity.au.index");
    }

    #[test]
    fn parses_housing_csv() {
        let csv = "DATAFLOW,MEASURE,REGION,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE\n\
                   ABS:RES_DWELL(1.0.0),1,1NSW,Q,2024-Q1,11696,,";

        let obs = parse_sdmx_csv(
            csv,
            |_| Some("housing.dwelling_approvals.au.count".into()),
            |f| abs_region_to_code(f.get(2).unwrap_or(&"AU")).to_string(),
        );

        assert_eq!(obs.len(), 1);
        assert_eq!(obs[0].region_code, "NSW");
        assert!((obs[0].value - 11696.0).abs() < 0.01);
    }

    #[test]
    fn abs_region_mapping() {
        assert_eq!(abs_region_to_code("1GSYD"), "NSW");
        assert_eq!(abs_region_to_code("1RNSW"), "NSW");
        assert_eq!(abs_region_to_code("2GMEL"), "VIC");
        assert_eq!(abs_region_to_code("3RQLD"), "QLD");
        assert_eq!(abs_region_to_code("0"), "AU");
        assert_eq!(abs_region_to_code("AUS"), "AU");
    }
}
