//! Data freshness rules and computation.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Whether data is considered fresh or stale.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum FreshnessStatus {
    Fresh,
    Stale,
}

/// Result of a freshness check for a single series.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FreshnessResult {
    pub series_id: String,
    pub status: FreshnessStatus,
    pub lag_minutes: Option<i64>,
    pub last_published_at: Option<DateTime<Utc>>,
}

/// Parse an ISO 8601 date/datetime or YYYY-Q[1-4] quarter string into a `DateTime<Utc>`.
pub fn to_timestamp(date_str: &str) -> Option<DateTime<Utc>> {
    // Try ISO 8601 datetime first
    if let Ok(dt) = date_str.parse::<DateTime<Utc>>() {
        return Some(dt);
    }

    // Try YYYY-MM-DD
    if let Ok(nd) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        return nd
            .and_hms_opt(0, 0, 0)
            .and_then(|ndt| ndt.and_local_timezone(Utc).single());
    }

    // Try quarter format: YYYY-Q[1-4]
    let quarter_re = regex_lite(date_str)?;
    Some(quarter_re)
}

/// Parse quarter format manually without regex dependency.
fn regex_lite(date_str: &str) -> Option<DateTime<Utc>> {
    let bytes = date_str.as_bytes();
    // Must be exactly 7 chars: YYYY-QN
    if bytes.len() != 7 {
        return None;
    }
    if bytes[4] != b'-' || bytes[5] != b'Q' {
        return None;
    }
    let year: i32 = date_str[..4].parse().ok()?;
    let quarter: u32 = date_str[6..7].parse().ok()?;
    if !(1..=4).contains(&quarter) {
        return None;
    }
    // Q1 -> month 1, Q2 -> month 4, Q3 -> month 7, Q4 -> month 10
    // But the TS uses monthEnd = quarter * 3, so Q1->3, Q2->6, Q3->9, Q4->12
    let month = quarter * 3;
    let nd = NaiveDate::from_ymd_opt(year, month, 1)?;
    nd.and_hms_opt(0, 0, 0)
        .and_then(|ndt| ndt.and_local_timezone(Utc).single())
}

/// Compute minutes elapsed since the given timestamp.
pub fn lag_minutes(published_at: DateTime<Utc>) -> i64 {
    let now = Utc::now();
    let diff = now - published_at;
    diff.num_minutes().max(0)
}

/// Determine freshness status from cadence string and lag in minutes.
pub fn freshness_status(cadence: &str, lag: i64) -> FreshnessStatus {
    let threshold = match cadence {
        "5m" => 20,
        "daily" => 2880,      // 48 hours
        "monthly" => 4320,    // 72 hours
        "quarterly" => 10080, // 7 days
        _ => return FreshnessStatus::Stale,
    };
    if lag > threshold {
        FreshnessStatus::Stale
    } else {
        FreshnessStatus::Fresh
    }
}

/// Compute full freshness result for a series.
pub fn compute_freshness(
    series_id: &str,
    cadence: &str,
    published_at: Option<DateTime<Utc>>,
) -> FreshnessResult {
    match published_at {
        Some(pa) => {
            let lag = lag_minutes(pa);
            let status = freshness_status(cadence, lag);
            FreshnessResult {
                series_id: series_id.to_string(),
                status,
                lag_minutes: Some(lag),
                last_published_at: Some(pa),
            }
        }
        None => FreshnessResult {
            series_id: series_id.to_string(),
            status: FreshnessStatus::Stale,
            lag_minutes: None,
            last_published_at: None,
        },
    }
}
