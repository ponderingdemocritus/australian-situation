//! Observation recency comparison.

use std::cmp::Ordering;

use crate::observation::LiveObservation;

/// Compare two observations for recency.
///
/// Orders by `published_at` DESC, then `ingested_at` DESC, then `date` DESC.
/// The "most recent" observation sorts first.
pub fn compare_observation_recency(a: &LiveObservation, b: &LiveObservation) -> Ordering {
    b.date
        .cmp(&a.date)
        .then_with(|| b.vintage.cmp(&a.vintage))
        .then_with(|| b.published_at.cmp(&a.published_at))
        .then_with(|| b.ingested_at.cmp(&a.ingested_at))
        .then_with(|| b.source_name.cmp(&a.source_name))
        .then_with(|| b.source_url.cmp(&a.source_url))
}

/// Pick the most recent observation from a slice.
pub fn pick_latest_observation(observations: &[LiveObservation]) -> Option<&LiveObservation> {
    if observations.is_empty() {
        return None;
    }
    let mut best = &observations[0];
    for obs in &observations[1..] {
        if compare_observation_recency(obs, best) == Ordering::Less {
            best = obs;
        }
    }
    Some(best)
}
