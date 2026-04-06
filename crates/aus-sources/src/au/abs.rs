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

/// Parse ABS SDMX CSV response into rows with a custom unit.
fn parse_sdmx_csv_with_unit(
    body: &str,
    series_id_fn: impl Fn(&[&str]) -> Option<String>,
    region_fn: impl Fn(&[&str]) -> String,
    unit_fn: impl Fn(&[&str]) -> String,
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
            let unit = unit_fn(&fields);

            Some(AbsObservation {
                series_id,
                region_code: region,
                date,
                value,
                unit,
            })
        })
        .collect()
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
/// Uses two dataflows:
/// - ABS,CPI for All groups CPI (INDEX 10001)
/// - ABS,CPI_Q for Electricity CPI (INDEX 40055)
///
/// Both use: MEASURE.INDEX.TSEST.REGION.FREQ
/// - TSEST 10 = Original
/// - REGION 1 = Australia (weighted avg of 8 capitals)
/// - FREQ Q = Quarterly
pub async fn fetch_cpi(
    client: &(impl SourceFetch + ?Sized),
) -> Result<Vec<AbsObservation>, SourceClientError> {
    let mut all_observations = Vec::new();

    // All groups CPI from main CPI dataflow
    let url_all = "https://data.api.abs.gov.au/rest/data/ABS,CPI/1.10001.10.1.Q?startPeriod=2020-Q1&detail=dataonly";
    let resp_all = client.get(url_all, "text/csv").await?;
    let obs_all = parse_sdmx_csv(
        &resp_all.body,
        |fields| {
            let index = *fields.get(2)?;
            match index {
                "10001" => Some("cpi.all_groups.au.index".to_string()),
                _ => None,
            }
        },
        |_fields| "AU".to_string(),
    );
    all_observations.extend(obs_all);

    // Electricity CPI from CPI_Q dataflow (index 40055)
    // TSEST 20 = Seasonally Adjusted, REGION 50 = Weighted average of eight capital cities
    let url_elec = "https://data.api.abs.gov.au/rest/data/ABS,CPI_Q/1.40055...Q?startPeriod=2020-Q1&detail=dataonly";
    match client.get(url_elec, "text/csv").await {
        Ok(resp_elec) => {
            let obs_elec = parse_sdmx_csv(
                &resp_elec.body,
                |fields| {
                    let index = *fields.get(2)?;
                    match index {
                        "40055" => Some("energy.cpi.electricity.index".to_string()),
                        _ => None,
                    }
                },
                |_fields| "AU".to_string(),
            );
            all_observations.extend(obs_elec);
        }
        Err(e) => {
            tracing::warn!("fetch_cpi: failed to fetch electricity CPI: {e}");
        }
    }

    tracing::info!("fetch_cpi: parsed {} observations", all_observations.len());
    Ok(all_observations)
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

/// Fetch housing lending data from ABS SDMX API.
///
/// Uses dataflow ABS,LEND_HOUSING with key:
///   MEASURE.DATA_ITEM.LOAN_TYPE.LOAN_PURPOSE.LENDER_TYPE.HOUSING_PURPOSE.TSEST.REGION.FREQ
///
/// We fetch new loan commitments (NEWCOMMITS) for total dwellings (TOTDWELL),
/// owner-occupier (DV5167) and investor (DV5168), original series, Australia, quarterly.
///
/// Produces series IDs:
///   lending.oo.count, lending.oo.value_aud,
///   lending.investor.count, lending.investor.value_aud,
///   lending.avg_loan_size_aud
pub async fn fetch_lending(
    client: &(impl SourceFetch + ?Sized),
) -> Result<Vec<AbsObservation>, SourceClientError> {
    // FIN_NUM+FIN_VAL new loan commitments, total fixed+revolving, total dwelling,
    // all lenders, OO + investor, original, Australia, quarterly
    let url = "https://data.api.abs.gov.au/rest/data/ABS,LEND_HOUSING/\
        FIN_NUM+FIN_VAL.NEWCOMMITS.DV8368.TOTDWELL.TOT.DV5167+DV5168.10.AUS.Q\
        ?startPeriod=2020-Q1&detail=dataonly";
    let resp = client
        .get(
            url,
            "application/vnd.sdmx.data+csv",
        )
        .await?;

    // LEND_HOUSING CSV columns:
    // 0=DATAFLOW, 1=MEASURE, 2=DATA_ITEM, 3=LOAN_TYPE, 4=LOAN_PURPOSE,
    // 5=LENDER_TYPE, 6=HOUSING_PURPOSE, 7=TSEST, 8=REGION, 9=FREQ,
    // 10=TIME_PERIOD, 11=OBS_VALUE, ...
    let observations = parse_sdmx_csv_with_unit(
        &resp.body,
        |fields| {
            let measure = *fields.get(1)?; // FIN_NUM or FIN_VAL
            let housing_purpose = *fields.get(6)?; // DV5167=OO, DV5168=investor
            match (measure, housing_purpose) {
                ("FIN_NUM", "DV5167") => Some("lending.oo.count".to_string()),
                ("FIN_VAL", "DV5167") => Some("lending.oo.value_aud".to_string()),
                ("FIN_NUM", "DV5168") => Some("lending.investor.count".to_string()),
                ("FIN_VAL", "DV5168") => Some("lending.investor.value_aud".to_string()),
                _ => None,
            }
        },
        |_fields| "AU".to_string(),
        |fields| {
            let measure = fields.get(1).unwrap_or(&"");
            match *measure {
                "FIN_NUM" => "count".to_string(),
                "FIN_VAL" => "AUD_million".to_string(),
                _ => "unknown".to_string(),
            }
        },
    );

    // Compute average loan size per quarter from OO data
    let mut avg_obs = compute_avg_loan_size(&observations);

    let mut all = observations;
    all.append(&mut avg_obs);

    tracing::info!("fetch_lending: parsed {} observations", all.len());
    Ok(all)
}

/// Compute `lending.avg_loan_size_aud` from OO count and value for each quarter.
fn compute_avg_loan_size(obs: &[AbsObservation]) -> Vec<AbsObservation> {
    use std::collections::HashMap;

    // Group by date
    let mut counts: HashMap<&str, f64> = HashMap::new();
    let mut values: HashMap<&str, f64> = HashMap::new();

    for o in obs {
        match o.series_id.as_str() {
            "lending.oo.count" => {
                counts.insert(&o.date, o.value);
            }
            "lending.oo.value_aud" => {
                values.insert(&o.date, o.value);
            }
            _ => {}
        }
    }

    counts
        .iter()
        .filter_map(|(date, count)| {
            let value = values.get(date)?;
            if *count > 0.0 {
                // Value is in millions, convert to AUD
                let avg = (value * 1_000_000.0) / count;
                Some(AbsObservation {
                    series_id: "lending.avg_loan_size_aud".to_string(),
                    region_code: "AU".to_string(),
                    date: date.to_string(),
                    value: (avg * 100.0).round() / 100.0, // round to cents
                    unit: "AUD".to_string(),
                })
            } else {
                None
            }
        })
        .collect()
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
                "40001" => Some("energy.cpi.electricity.index".into()),
                _ => None,
            },
            |_| "AU".to_string(),
        );

        assert_eq!(obs.len(), 2);
        assert_eq!(obs[0].series_id, "cpi.all_groups.au.index");
        assert!((obs[0].value - 95.6).abs() < 0.01);
        assert_eq!(obs[1].series_id, "energy.cpi.electricity.index");
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
