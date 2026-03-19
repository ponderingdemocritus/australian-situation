//! Energy comparison and source mix topology.

use std::collections::HashMap;

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Comparison logic
// ---------------------------------------------------------------------------

/// An observation with its rank in a sorted peer set.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RankedObservation {
    pub country_code: String,
    pub value: Decimal,
    pub rank: usize,
    pub percentile: f64,
}

/// Rank a set of `(country_code, value)` pairs by value ascending, tie-break by country code.
pub fn rank_comparable_observations(observations: &[(String, Decimal)]) -> Vec<RankedObservation> {
    let mut sorted: Vec<_> = observations.to_vec();
    sorted.sort_by(|a, b| a.1.cmp(&b.1).then_with(|| a.0.cmp(&b.0)));

    let count = sorted.len();
    let mut result = Vec::with_capacity(count);
    let mut prev_value: Option<Decimal> = None;
    let mut prev_rank: usize = 0;

    for (i, (country_code, value)) in sorted.iter().enumerate() {
        let rank = if prev_value == Some(*value) {
            prev_rank
        } else {
            i + 1
        };
        prev_value = Some(*value);
        prev_rank = rank;

        let percentile = compute_percentile(rank, count);
        result.push(RankedObservation {
            country_code: country_code.clone(),
            value: *value,
            rank,
            percentile,
        });
    }

    result
}

/// Compute percentile from rank and total count.
pub fn compute_percentile(rank: usize, count: usize) -> f64 {
    if count <= 1 {
        return 100.0;
    }
    let pct = ((count - rank) as f64 / (count - 1) as f64) * 100.0;
    (pct * 100.0).round() / 100.0
}

/// Comparison of a base value against a peer.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PeerComparison {
    pub country_code: String,
    pub value: Decimal,
    pub gap: Decimal,
    pub gap_pct: f64,
}

/// Compute peer comparisons relative to a base value.
pub fn compute_peer_comparisons(
    base_value: Decimal,
    peers: &[RankedObservation],
) -> Vec<PeerComparison> {
    peers
        .iter()
        .map(|peer| {
            let gap = base_value - peer.value;
            let gap_pct = if peer.value.is_zero() {
                0.0
            } else {
                let raw = gap.to_string().parse::<f64>().unwrap_or(0.0)
                    / peer.value.to_string().parse::<f64>().unwrap_or(1.0)
                    * 100.0;
                (raw * 100.0).round() / 100.0
            };
            PeerComparison {
                country_code: peer.country_code.clone(),
                value: peer.value,
                gap,
                gap_pct,
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Source mix
// ---------------------------------------------------------------------------

/// The five canonical energy source keys.
pub const ENERGY_SOURCE_MIX_KEYS: &[&str] = &["coal", "gas", "hydro", "oil", "other_renewables"];

/// A single source's share in the energy mix.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SourceMixShare {
    pub source_key: String,
    pub label: String,
    pub share_pct: f64,
}

/// A view (official or operational) of the energy source mix.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SourceMixView {
    pub view_type: String,
    pub period: String,
    pub region_code: String,
    pub shares: Vec<SourceMixShare>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data_note: Option<String>,
}

fn label_for_key(key: &str) -> &'static str {
    match key {
        "coal" => "Coal",
        "gas" => "Gas",
        "hydro" => "Hydro",
        "oil" => "Oil",
        "other_renewables" => "Other Renewables",
        _ => "Unknown",
    }
}

/// Official source mix share percentages by region.
/// Indices: [coal, gas, hydro, oil, other_renewables]
fn official_source_mix_shares() -> HashMap<&'static str, [f64; 5]> {
    let mut m = HashMap::new();
    m.insert("AU", [47.0, 18.0, 6.0, 1.0, 28.0]);
    m.insert("NSW", [68.0, 4.0, 7.0, 0.0, 21.0]);
    m.insert("VIC", [63.0, 6.0, 5.0, 0.0, 26.0]);
    m.insert("QLD", [73.0, 10.0, 1.0, 0.0, 16.0]);
    m.insert("SA", [0.0, 21.0, 0.0, 1.0, 78.0]);
    m.insert("WA", [23.0, 62.0, 0.0, 2.0, 13.0]);
    m.insert("TAS", [0.0, 0.0, 79.0, 0.0, 21.0]);
    m.insert("NT", [0.0, 84.0, 0.0, 8.0, 8.0]);
    m
}

/// NEM operational generation in MW by region.
/// Indices: [coal, gas, hydro, oil, other_renewables]
fn nem_operational_mix_mw() -> HashMap<&'static str, [f64; 5]> {
    let mut m = HashMap::new();
    m.insert("NSW", [5520.0, 560.0, 400.0, 0.0, 1520.0]);
    m.insert("VIC", [2900.0, 300.0, 200.0, 0.0, 1600.0]);
    m.insert("QLD", [4560.0, 780.0, 60.0, 0.0, 600.0]);
    m.insert("SA", [0.0, 180.0, 0.0, 0.0, 820.0]);
    m.insert("TAS", [0.0, 0.0, 648.0, 0.0, 152.0]);
    m
}

/// WEM operational generation in MW (WA only).
/// Indices: [coal, gas, hydro, oil, other_renewables]
const WEM_OPERATIONAL_MIX_MW: [f64; 5] = [420.0, 1240.0, 0.0, 80.0, 260.0];

fn build_shares_from_pcts(region: &str, pcts: &[f64; 5]) -> Vec<SourceMixShare> {
    let mut shares: Vec<SourceMixShare> = ENERGY_SOURCE_MIX_KEYS
        .iter()
        .zip(pcts.iter())
        .map(|(key, &pct)| SourceMixShare {
            source_key: (*key).to_string(),
            label: label_for_key(key).to_string(),
            share_pct: pct,
        })
        .collect();
    shares.sort_by(|a, b| {
        b.share_pct
            .partial_cmp(&a.share_pct)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let _ = region; // used by caller for region_code
    shares
}

fn build_shares_from_mw(mw_values: &[f64; 5]) -> Vec<SourceMixShare> {
    let total: f64 = mw_values.iter().sum();
    let mut shares: Vec<SourceMixShare> = ENERGY_SOURCE_MIX_KEYS
        .iter()
        .zip(mw_values.iter())
        .map(|(key, &mw)| {
            let pct = if total > 0.0 {
                ((mw / total) * 1000.0).round() / 10.0
            } else {
                0.0
            };
            SourceMixShare {
                source_key: (*key).to_string(),
                label: label_for_key(key).to_string(),
                share_pct: pct,
            }
        })
        .collect();
    shares.sort_by(|a, b| {
        b.share_pct
            .partial_cmp(&a.share_pct)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    shares
}

/// Build energy source mix views (official + operational) for a region code.
pub fn build_energy_source_mix_views(region_code: &str) -> Vec<SourceMixView> {
    let official_map = official_source_mix_shares();
    let nem_map = nem_operational_mix_mw();

    // --- Official view ---
    let official_region = if region_code == "ACT" {
        "NSW"
    } else {
        region_code
    };
    let official_view = if let Some(pcts) = official_map.get(official_region) {
        SourceMixView {
            view_type: "official".to_string(),
            period: "2024".to_string(),
            region_code: region_code.to_string(),
            shares: build_shares_from_pcts(official_region, pcts),
            data_note: None,
        }
    } else {
        SourceMixView {
            view_type: "official".to_string(),
            period: "2024".to_string(),
            region_code: region_code.to_string(),
            shares: vec![],
            data_note: Some("not available".to_string()),
        }
    };

    // --- Operational view ---
    let operational_view = if region_code == "NT" {
        SourceMixView {
            view_type: "operational".to_string(),
            period: String::new(),
            region_code: region_code.to_string(),
            shares: vec![],
            data_note: Some("not available".to_string()),
        }
    } else if region_code == "WA" {
        SourceMixView {
            view_type: "operational".to_string(),
            period: String::new(),
            region_code: region_code.to_string(),
            shares: build_shares_from_mw(&WEM_OPERATIONAL_MIX_MW),
            data_note: None,
        }
    } else {
        let op_region = if region_code == "ACT" {
            "NSW"
        } else {
            region_code
        };
        if region_code == "AU" {
            // Aggregate all NEM + WEM
            let mut totals = [0.0_f64; 5];
            for mw in nem_map.values() {
                for (i, val) in mw.iter().enumerate() {
                    totals[i] += val;
                }
            }
            for (i, val) in WEM_OPERATIONAL_MIX_MW.iter().enumerate() {
                totals[i] += val;
            }
            SourceMixView {
                view_type: "operational".to_string(),
                period: String::new(),
                region_code: region_code.to_string(),
                shares: build_shares_from_mw(&totals),
                data_note: None,
            }
        } else if let Some(mw) = nem_map.get(op_region) {
            SourceMixView {
                view_type: "operational".to_string(),
                period: String::new(),
                region_code: region_code.to_string(),
                shares: build_shares_from_mw(mw),
                data_note: None,
            }
        } else {
            SourceMixView {
                view_type: "operational".to_string(),
                period: String::new(),
                region_code: region_code.to_string(),
                shares: vec![],
                data_note: Some("not available".to_string()),
            }
        }
    };

    vec![official_view, operational_view]
}
