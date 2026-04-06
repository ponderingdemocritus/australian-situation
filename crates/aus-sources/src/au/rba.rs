use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RbaRatePoint {
    pub series_id: String,
    pub date: String,
    pub value: f64,
}

/// Parse an RBA statistical table CSV.
///
/// RBA CSVs have metadata rows before the data:
/// Row 1: Title
/// Row 2: Column titles
/// ...
/// Row N: "Series ID" row with IDs like FILRHLBVD
/// Remaining rows: DD/MM/YYYY, val1, val2, ...
///
/// We locate the "Series ID" row to find column positions, then parse data rows.
fn parse_rba_csv(body: &str) -> Vec<RbaRatePoint> {
    let lines: Vec<&str> = body.lines().collect();

    // Find the Series ID row
    let series_id_row_idx = lines
        .iter()
        .position(|l| l.starts_with("Series ID"));
    let series_id_row_idx = match series_id_row_idx {
        Some(i) => i,
        None => return vec![],
    };

    let series_ids: Vec<&str> = lines[series_id_row_idx].split(',').collect();

    // Map RBA series IDs to our internal series IDs.
    // F5 table (Indicator Lending Rates):
    //   FILRHLBVD = Housing; Banks; Variable; Discounted; Owner-occupier
    //   FILRHL3YF = Housing; Banks; 3-year fixed; Owner-occupier
    // F6 table (Housing Lending Rates):
    //   FLRHOOVL = Outstanding; Owner-occupied; Variable-rate; Large institutions
    //   FLRHOOFA = Outstanding; Owner-occupied; Fixed-rate; <=3yr
    let col_mapping: Vec<(usize, &str)> = series_ids
        .iter()
        .enumerate()
        .filter_map(|(i, id)| {
            let id = id.trim();
            match id {
                // F5 indicator rates
                "FILRHLBVD" => Some((i, "rates.oo.variable_pct")),
                "FILRHL3YF" => Some((i, "rates.oo.fixed_pct")),
                // F6 outstanding rates (fallback)
                "FLRHOOVL" => Some((i, "rates.oo.variable_pct")),
                "FLRHOOFA" => Some((i, "rates.oo.fixed_pct")),
                _ => None,
            }
        })
        .collect();

    if col_mapping.is_empty() {
        return vec![];
    }

    let mut points = Vec::new();

    // Data rows start after the Series ID row
    for line in &lines[(series_id_row_idx + 1)..] {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let fields: Vec<&str> = line.split(',').collect();
        let raw_date = fields.first().map(|s| s.trim()).unwrap_or("");

        // Parse DD/MM/YYYY to YYYY-MM-DD
        let date = match parse_dmy_date(raw_date) {
            Some(d) => d,
            None => continue,
        };

        for &(col_idx, series_id) in &col_mapping {
            if let Some(val_str) = fields.get(col_idx) {
                if let Ok(v) = val_str.trim().parse::<f64>() {
                    points.push(RbaRatePoint {
                        series_id: series_id.to_string(),
                        date: date.clone(),
                        value: v,
                    });
                }
            }
        }
    }

    points
}

/// Convert DD/MM/YYYY to YYYY-MM-DD.
fn parse_dmy_date(s: &str) -> Option<String> {
    let parts: Vec<&str> = s.split('/').collect();
    if parts.len() != 3 {
        return None;
    }
    let day = parts[0];
    let month = parts[1];
    let year = parts[2];
    if year.len() != 4 {
        return None;
    }
    Some(format!("{year}-{month}-{day}"))
}

pub async fn fetch_rates(
    client: &(impl SourceFetch + ?Sized),
) -> Result<Vec<RbaRatePoint>, SourceClientError> {
    let url = "https://www.rba.gov.au/statistics/tables/csv/f5-data.csv";
    let resp = client.get(url, "text/csv,text/plain").await?;
    let points = parse_rba_csv(&resp.body);
    tracing::info!("fetch_rates: parsed {} points from RBA f5", points.len());
    Ok(points)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_rba_f5_csv() {
        let csv = "\u{feff}F5  INDICATOR LENDING RATES\n\
Title,Small biz,Small biz OO,Housing Variable Standard OO,Housing Variable Discounted OO,Housing Variable IO OO,Housing 3yr Fixed OO\n\
Description,d1,d2,d3,d4,d5,d6\n\
Frequency,Monthly,Monthly,Monthly,Monthly,Monthly,Monthly\n\
Type,Original,Original,Original,Original,Original,Original\n\
Units,pct,pct,pct,pct,pct,pct\n\
Source,RBA,RBA,RBA,RBA,RBA,RBA\n\
Publication date,01-Jan-2026,01-Jan-2026,01-Jan-2026,01-Jan-2026,01-Jan-2026,01-Jan-2026\n\
Series ID,FILRSBVRT,FILRSBVOO,FILRHLBVS,FILRHLBVD,FILRHLBVO,FILRHL3YF\n\
31/01/2026,8.25,10.01,8.02,6.05,8.54,5.99\n\
28/02/2026,8.50,10.26,8.27,6.30,8.79,6.24";

        let points = parse_rba_csv(csv);
        assert!(!points.is_empty(), "should parse some points");

        let variable: Vec<_> = points
            .iter()
            .filter(|p| p.series_id == "rates.oo.variable_pct")
            .collect();
        let fixed: Vec<_> = points
            .iter()
            .filter(|p| p.series_id == "rates.oo.fixed_pct")
            .collect();

        assert_eq!(variable.len(), 2);
        assert_eq!(fixed.len(), 2);
        assert!((variable[0].value - 6.05).abs() < 0.01);
        assert!((fixed[0].value - 5.99).abs() < 0.01);
        assert_eq!(variable[0].date, "2026-01-31");
    }

    #[test]
    fn parse_dmy() {
        assert_eq!(parse_dmy_date("31/01/2026"), Some("2026-01-31".into()));
        assert_eq!(parse_dmy_date("bad"), None);
    }
}
