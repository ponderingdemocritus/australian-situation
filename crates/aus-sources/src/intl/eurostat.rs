use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EurostatRetailPricePoint {
    pub country_code: String,
    pub period: String,
    pub customer_type: String,
    pub consumption_band: String,
    pub tax_status: String,
    pub currency: String,
    pub price_local_kwh: f64,
}

/// Eurostat SDMX JSON response structure.
/// The "value" object maps flat index -> numeric value.
/// Dimensions are ordered per the "id" array, with sizes per the "size" array.
/// We iterate through the flat index space and decode dimension positions.
pub async fn fetch_retail(
    client: &(impl SourceFetch + ?Sized),
    _url: &str, // ignored - we use the real API URL
) -> Result<Vec<EurostatRetailPricePoint>, SourceClientError> {
    let api_url = "https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/nrg_pc_204/?format=JSON&lang=en";
    let resp = client.get(api_url, "application/json").await?;
    let parsed: serde_json::Value = serde_json::from_str(&resp.body)
        .map_err(|e| SourceClientError::permanent(format!("Failed to parse Eurostat JSON: {e}")))?;

    let id = parsed["id"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
        .unwrap_or_default();
    let size = parsed["size"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_u64().map(|n| n as usize)).collect::<Vec<_>>())
        .unwrap_or_default();

    if id.is_empty() || size.is_empty() || id.len() != size.len() {
        return Ok(vec![]);
    }

    // Build reverse lookup: dim_name -> { index -> code }
    let dims = &parsed["dimension"];
    let mut dim_codes: Vec<HashMap<usize, String>> = Vec::new();
    for dim_name in &id {
        let cat_idx = &dims[dim_name]["category"]["index"];
        let mut idx_to_code: HashMap<usize, String> = HashMap::new();
        if let Some(obj) = cat_idx.as_object() {
            for (code, pos) in obj {
                if let Some(p) = pos.as_u64() {
                    idx_to_code.insert(p as usize, code.clone());
                }
            }
        }
        dim_codes.push(idx_to_code);
    }

    let values = match parsed["value"].as_object() {
        Some(v) => v,
        None => return Ok(vec![]),
    };

    // Find dimension positions
    let geo_dim = id.iter().position(|d| *d == "geo");
    let time_dim = id.iter().position(|d| *d == "time");
    let tax_dim = id.iter().position(|d| *d == "tax");
    let currency_dim = id.iter().position(|d| *d == "currency");
    let nrg_cons_dim = id.iter().position(|d| *d == "nrg_cons");

    let mut points = Vec::new();

    for (flat_idx_str, val) in values {
        let flat_idx: usize = match flat_idx_str.parse() {
            Ok(i) => i,
            Err(_) => continue,
        };
        let price = match val.as_f64() {
            Some(p) => p,
            None => continue,
        };

        // Decode flat index into dimension positions
        let dim_positions = decode_flat_index(flat_idx, &size);

        let geo = geo_dim
            .and_then(|d| dim_codes.get(d)?.get(&dim_positions[d]))
            .cloned()
            .unwrap_or_default();
        let time = time_dim
            .and_then(|d| dim_codes.get(d)?.get(&dim_positions[d]))
            .cloned()
            .unwrap_or_default();
        let tax = tax_dim
            .and_then(|d| dim_codes.get(d)?.get(&dim_positions[d]))
            .cloned()
            .unwrap_or_default();
        let currency = currency_dim
            .and_then(|d| dim_codes.get(d)?.get(&dim_positions[d]))
            .cloned()
            .unwrap_or_default();
        let nrg_cons = nrg_cons_dim
            .and_then(|d| dim_codes.get(d)?.get(&dim_positions[d]))
            .cloned()
            .unwrap_or_default();

        // Skip aggregates (EU27, EA) and non-EUR currency for simplicity
        if geo.starts_with("EU") || geo == "EA" {
            continue;
        }
        // Only keep EUR prices and all-taxes-included
        if currency != "EUR" || tax != "I_TAX" {
            continue;
        }

        let consumption_band = match nrg_cons.as_str() {
            "KWH2500-4999" | "KWH5000-14999" => "household_mid",
            "KWH_LT1000" | "KWH1000-2499" => "household_low",
            "KWH_GE15000" => "household_high",
            "TOT_KWH" => "household_mid",
            _ => "household_mid",
        };

        points.push(EurostatRetailPricePoint {
            country_code: geo,
            period: time,
            customer_type: "household".to_string(),
            consumption_band: consumption_band.to_string(),
            tax_status: "incl_tax".to_string(),
            currency: "EUR".to_string(),
            price_local_kwh: price,
        });
    }

    tracing::info!("fetch_retail: parsed {} Eurostat points", points.len());
    Ok(points)
}

/// Decode a flat index into per-dimension positions given dimension sizes.
fn decode_flat_index(mut flat: usize, sizes: &[usize]) -> Vec<usize> {
    let mut positions = vec![0usize; sizes.len()];
    for i in (0..sizes.len()).rev() {
        positions[i] = flat % sizes[i];
        flat /= sizes[i];
    }
    positions
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_flat_index() {
        // sizes = [2, 3, 4] => total = 24
        // index 0 => [0, 0, 0]
        // index 1 => [0, 0, 1]
        // index 4 => [0, 1, 0]
        assert_eq!(decode_flat_index(0, &[2, 3, 4]), vec![0, 0, 0]);
        assert_eq!(decode_flat_index(1, &[2, 3, 4]), vec![0, 0, 1]);
        assert_eq!(decode_flat_index(4, &[2, 3, 4]), vec![0, 1, 0]);
        assert_eq!(decode_flat_index(12, &[2, 3, 4]), vec![1, 0, 0]);
    }
}
