use serde::{Deserialize, Serialize};
use std::io::Read;

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AemoWholesalePoint {
    pub settlement_date: String,
    pub region_code: String,
    pub rrp_aud_mwh: f64,
    pub demand_mwh: Option<f64>,
}

fn normalize_aemo_region(region: &str) -> String {
    region.trim_end_matches('1').to_string()
}

/// Fetch the latest 5-minute dispatch price from AEMO NEM.
///
/// AEMO publishes DispatchIS reports as zip files under:
///   https://nemweb.com.au/Reports/Current/DispatchIS_Reports/
///
/// Each zip contains a CSV with rows like:
///   D,DISPATCH,PRICE,5,"2026/03/24 10:10:00",1,NSW1,...,56.98,...
///
/// We download the directory listing, find the latest zip file, download it,
/// extract the CSV, and parse DISPATCH,PRICE rows.
pub async fn fetch_wholesale(
    client: &(impl SourceFetch + ?Sized),
) -> Result<Vec<AemoWholesalePoint>, SourceClientError> {
    let listing_url = "https://nemweb.com.au/Reports/Current/DispatchIS_Reports/";
    let listing = client.get(listing_url, "text/html").await?;

    // Extract the latest zip filename from the HTML directory listing
    let zip_filename = find_latest_zip(&listing.body).ok_or_else(|| {
        SourceClientError::permanent("No DispatchIS zip files found in directory listing".to_string())
    })?;

    let zip_url = format!("{listing_url}{zip_filename}");
    tracing::info!("fetch_wholesale: downloading {zip_url}");

    let zip_resp = client.get_bytes(&zip_url, "*/*").await?;
    let csv_text = extract_csv_from_zip(&zip_resp.body)?;
    let points = parse_dispatch_price_csv(&csv_text);

    tracing::info!("fetch_wholesale: parsed {} price points", points.len());
    Ok(points)
}

/// Find the latest PUBLIC_DISPATCHIS_*.zip filename from the HTML directory listing.
fn find_latest_zip(html: &str) -> Option<String> {
    let mut latest: Option<String> = None;
    for segment in html.split("HREF=\"").chain(html.split("href=\"")) {
        if let Some(end) = segment.find('"') {
            let href = &segment[..end];
            if href.contains("PUBLIC_DISPATCHIS_") && href.ends_with(".zip") {
                // Extract just the filename (strip any path prefix)
                let filename = href
                    .rsplit('/')
                    .next()
                    .unwrap_or(href)
                    .to_string();
                if latest.as_ref().is_none_or(|l| filename > *l) {
                    latest = Some(filename);
                }
            }
        }
    }
    latest
}

/// Extract the first CSV file from a zip archive.
fn extract_csv_from_zip(zip_bytes: &[u8]) -> Result<String, SourceClientError> {
    let cursor = std::io::Cursor::new(zip_bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| SourceClientError::permanent(format!("Failed to open zip: {e}")))?;

    if archive.is_empty() {
        return Err(SourceClientError::permanent(
            "Zip archive is empty".to_string(),
        ));
    }

    let mut file = archive.by_index(0).map_err(|e| {
        SourceClientError::permanent(format!("Failed to read zip entry: {e}"))
    })?;

    let mut contents = String::new();
    file.read_to_string(&mut contents).map_err(|e| {
        SourceClientError::permanent(format!("Failed to read zip file contents: {e}"))
    })?;

    Ok(contents)
}

/// Parse AEMO DispatchIS CSV for DISPATCH,PRICE rows.
///
/// Format:
///   I,DISPATCH,PRICE,5,SETTLEMENTDATE,RUNNO,REGIONID,...,RRP,...
///   D,DISPATCH,PRICE,5,"2026/03/24 10:10:00",1,NSW1,...,56.98,...
///
/// Column indices (0-based in PRICE rows):
///   4 = SETTLEMENTDATE
///   6 = REGIONID
///   10 = RRP (regional reference price)
fn parse_dispatch_price_csv(csv: &str) -> Vec<AemoWholesalePoint> {
    let mut points = Vec::new();

    // First find the header row to get column positions
    let mut rrp_idx: Option<usize> = None;
    let mut region_idx: Option<usize> = None;
    let mut settle_idx: Option<usize> = None;

    for line in csv.lines() {
        let fields: Vec<&str> = line.split(',').collect();

        // Header row: I,DISPATCH,PRICE,...
        if fields.len() > 3
            && fields[0] == "I"
            && fields[1] == "DISPATCH"
            && fields[2] == "PRICE"
        {
            for (i, f) in fields.iter().enumerate() {
                match *f {
                    "SETTLEMENTDATE" => settle_idx = Some(i),
                    "REGIONID" => region_idx = Some(i),
                    "RRP" => rrp_idx = Some(i),
                    _ => {}
                }
            }
            continue;
        }

        // Data row: D,DISPATCH,PRICE,...
        if fields.len() > 3
            && fields[0] == "D"
            && fields[1] == "DISPATCH"
            && fields[2] == "PRICE"
        {
            let si = match settle_idx {
                Some(i) => i,
                None => 4, // fallback to known position
            };
            let ri = match region_idx {
                Some(i) => i,
                None => 6,
            };
            let pi = match rrp_idx {
                Some(i) => i,
                None => 10,
            };

            let date = fields
                .get(si)
                .map(|s| s.trim_matches('"').to_string())
                .unwrap_or_default();
            let region = fields
                .get(ri)
                .map(|s| s.to_string())
                .unwrap_or_default();
            let rrp = fields
                .get(pi)
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0);

            if !region.is_empty() && !date.is_empty() {
                points.push(AemoWholesalePoint {
                    settlement_date: date,
                    region_code: normalize_aemo_region(&region),
                    rrp_aud_mwh: rrp,
                    demand_mwh: None,
                });
            }
        }
    }

    points
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_dispatch_price() {
        let csv = "\
C,NEMP.WORLD,DISPATCHIS,AEMO,PUBLIC,2026/03/24,10:05:13,0000000509440807,DISPATCHIS,0000000509440806
I,DISPATCH,PRICE,5,SETTLEMENTDATE,RUNNO,REGIONID,DISPATCHINTERVAL,INTERVENTION,RRP,EEP
D,DISPATCH,PRICE,5,\"2026/03/24 10:10:00\",1,NSW1,20260324074,0,56.98,0
D,DISPATCH,PRICE,5,\"2026/03/24 10:10:00\",1,VIC1,20260324074,0,0.00012,0
D,DISPATCH,PRICE,5,\"2026/03/24 10:10:00\",1,QLD1,20260324074,0,5.71,0
D,DISPATCH,PRICE,5,\"2026/03/24 10:10:00\",1,SA1,20260324074,0,66.44,0
D,DISPATCH,PRICE,5,\"2026/03/24 10:10:00\",1,TAS1,20260324074,0,74.24,0
C,END,DISPATCHIS,0000000509440807";

        let points = parse_dispatch_price_csv(csv);
        assert_eq!(points.len(), 5);

        let nsw = points.iter().find(|p| p.region_code == "NSW").unwrap();
        assert!((nsw.rrp_aud_mwh - 56.98).abs() < 0.01);

        let vic = points.iter().find(|p| p.region_code == "VIC").unwrap();
        assert!((vic.rrp_aud_mwh - 0.00012).abs() < 0.001);
    }

    #[test]
    fn test_find_latest_zip() {
        let html = r#"<A HREF="PUBLIC_DISPATCHIS_202603241000_001.zip">file1</A>
<A HREF="PUBLIC_DISPATCHIS_202603241010_002.zip">file2</A>"#;
        let latest = find_latest_zip(html);
        assert_eq!(
            latest,
            Some("PUBLIC_DISPATCHIS_202603241010_002.zip".to_string())
        );
    }
}
