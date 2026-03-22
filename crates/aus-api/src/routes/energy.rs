use axum::Json;
use axum::extract::{Query, State};
use chrono::{DateTime, Utc};
use sqlx::PgPool;

use aus_db::models::Observation;

use crate::dto::*;
use crate::error::AppError;

fn parse_region(region: &str) -> Result<String, AppError> {
    let upper = region.to_uppercase();
    aus_domain::region::RegionCode::parse(&upper)?;
    Ok(upper)
}

fn source_refs(ids: &[&str]) -> Vec<SourceRef> {
    let catalog = aus_domain::source::source_catalog();
    ids.iter()
        .filter_map(|source_id| catalog.iter().find(|item| item.source_id == *source_id))
        .map(|item| SourceRef {
            source_id: item.source_id.clone(),
            name: item.name.clone(),
            url: item.url.clone(),
        })
        .collect()
}

fn observation_value(observation: Option<&Observation>) -> f64 {
    observation
        .map(|item| item.value.to_string().parse::<f64>().unwrap_or(0.0))
        .unwrap_or(0.0)
}

fn latest_timestamp(observation: Option<&Observation>) -> Option<DateTime<Utc>> {
    observation.map(|item| item.published_at)
}

fn freshness_status_label(status: aus_domain::freshness::FreshnessStatus) -> String {
    match status {
        aus_domain::freshness::FreshnessStatus::Fresh => "fresh".to_string(),
        aus_domain::freshness::FreshnessStatus::Stale => "stale".to_string(),
    }
}

fn build_overview_panels(
    wholesale: Option<&Observation>,
    retail_mean: Option<&Observation>,
    retail_median: Option<&Observation>,
    benchmark: Option<&Observation>,
    cpi: Option<&Observation>,
) -> EnergyPanels {
    let wholesale_value = observation_value(wholesale);

    EnergyPanels {
        live_wholesale: Some(PanelWholesale {
            value_aud_mwh: wholesale_value,
            value_c_kwh: wholesale_value / 10.0,
        }),
        retail_average: Some(PanelRetail {
            annual_bill_aud_mean: observation_value(retail_mean),
            annual_bill_aud_median: observation_value(retail_median),
        }),
        benchmark: Some(PanelBenchmark {
            dmo_annual_bill_aud: observation_value(benchmark),
        }),
        cpi_electricity: Some(PanelCpi {
            index_value: observation_value(cpi),
            period: cpi
                .map(|item| item.date.clone())
                .unwrap_or_else(|| "unknown".to_string()),
        }),
    }
}

fn build_source_mix_view_dtos(region: &str) -> Vec<SourceMixViewDto> {
    aus_domain::energy::build_energy_source_mix_views(region)
        .into_iter()
        .map(|view| {
            let (view_id, title, coverage_label, updated_at, refs) = if view.view_type == "official"
            {
                (
                    "annual_official".to_string(),
                    "Annual official source mix".to_string(),
                    if region == "ACT" {
                        "ACT uses NSW official proxy".to_string()
                    } else {
                        format!("{region} official annual mix")
                    },
                    Some(format!("{}-12-31", view.period)),
                    source_refs(&["dcceew_generation_mix"]),
                )
            } else {
                (
                    "operational_nem_wem".to_string(),
                    "Operational NEM + WA source mix".to_string(),
                    if region == "AU" {
                        "NEM+WEM operational mix".to_string()
                    } else if region == "WA" {
                        "WA WEM operational mix".to_string()
                    } else if region == "ACT" {
                        "ACT uses NSW NEM proxy".to_string()
                    } else if region == "NT" {
                        "NT operational mix unavailable".to_string()
                    } else {
                        format!("{region} NEM operational mix")
                    },
                    None,
                    if region == "AU" {
                        source_refs(&["aemo_nem_source_mix", "aemo_wem_source_mix"])
                    } else if region == "WA" {
                        source_refs(&["aemo_wem_source_mix"])
                    } else if region == "NT" {
                        vec![]
                    } else {
                        source_refs(&["aemo_nem_source_mix"])
                    },
                )
            };

            SourceMixViewDto {
                view_id,
                title,
                coverage_label,
                updated_at,
                source_refs: refs,
                rows: view
                    .shares
                    .into_iter()
                    .map(|share| SourceMixRowDto {
                        source_key: share.source_key,
                        label: share.label,
                        share_pct: share.share_pct,
                    })
                    .collect(),
            }
        })
        .collect()
}

async fn latest_by_series_with_region_fallback(
    pool: &PgPool,
    series_id: &str,
    region: &str,
) -> Result<Option<Observation>, sqlx::Error> {
    let latest = aus_db::queries::observations::latest_by_series(pool, series_id, region).await?;
    if latest.is_some() || region == "AU" {
        return Ok(latest);
    }

    aus_db::queries::observations::latest_by_series(pool, series_id, "AU").await
}

#[utoipa::path(
    get,
    path = "/api/energy/live-wholesale",
    params(
        ("region" = Option<String>, Query, description = "Region code (default AU)"),
        ("window" = Option<String>, Query, description = "Time window: 5m, 1h, 24h"),
    ),
    responses((status = 200, body = EnergyLiveWholesaleResponse))
)]
pub async fn live_wholesale(
    State(pool): State<PgPool>,
    Query(params): Query<EnergyWindowQuery>,
) -> Result<Json<EnergyLiveWholesaleResponse>, AppError> {
    let region = parse_region(params.region.as_deref().unwrap_or("AU"))?;
    let window = params.window.as_deref().unwrap_or("5m");

    if ["WA", "NT", "ACT"].contains(&region.as_str()) {
        return Err(AppError::bad_request(
            "UNSUPPORTED_REGION",
            format!("Region {region} not supported for wholesale"),
        ));
    }

    if !["5m", "1h", "24h"].contains(&window) {
        return Err(AppError::bad_request(
            "INVALID_WINDOW",
            format!("Window {window} not supported"),
        ));
    }

    let series_id = if region == "AU" {
        "energy.wholesale.rrp.au_weighted_aud_mwh"
    } else {
        "energy.wholesale.rrp.region_aud_mwh"
    };
    let mut points = aus_db::queries::observations::list_by_series(&pool, series_id, &region).await?;
    let mut is_fallback = false;

    if points.is_empty() && region != "AU" {
        points = aus_db::queries::observations::list_by_series(
            &pool,
            "energy.wholesale.rrp.au_weighted_aud_mwh",
            "AU",
        )
        .await?;
        is_fallback = true;
    }

    let latest = points.first();
    let latest_value = observation_value(latest);
    let latest_timestamp_rfc3339 = latest
        .map(|item| item.published_at.to_rfc3339())
        .unwrap_or_else(|| Utc::now().to_rfc3339());
    let rollup_values: Vec<f64> = points
        .iter()
        .map(|item| item.value.to_string().parse::<f64>().unwrap_or(0.0))
        .collect();
    let one_hour_values = &rollup_values[..rollup_values.len().min(12)];
    let one_hour_avg = if one_hour_values.is_empty() {
        0.0
    } else {
        one_hour_values.iter().sum::<f64>() / one_hour_values.len() as f64
    };
    let twenty_four_hour_avg = if rollup_values.is_empty() {
        0.0
    } else {
        rollup_values.iter().sum::<f64>() / rollup_values.len() as f64
    };
    let freshness = aus_domain::freshness::compute_freshness(
        "aemo_wholesale",
        "5m",
        latest_timestamp(latest),
    );

    Ok(Json(EnergyLiveWholesaleResponse {
        region,
        window: window.to_string(),
        is_modeled: is_fallback,
        method_summary:
            "Wholesale reference prices aggregated using demand-weighted AU rollup.".to_string(),
        source_refs: source_refs(&["aemo_wholesale"]),
        latest: Some(WholesaleLatestPoint {
            timestamp: latest_timestamp_rfc3339.clone(),
            value_aud_mwh: latest_value,
            value_c_kwh: latest_value / 10.0,
        }),
        rollups: Some(WholesaleRollups {
            one_hour_avg_aud_mwh: Some(one_hour_avg),
            twenty_four_hour_avg_aud_mwh: Some(twenty_four_hour_avg),
        }),
        freshness: FreshnessInfo {
            updated_at: Some(latest_timestamp_rfc3339),
            status: freshness_status_label(freshness.status),
        },
    }))
}

#[utoipa::path(
    get,
    path = "/api/energy/retail-average",
    params(("region" = Option<String>, Query, description = "Region code (default AU)")),
    responses((status = 200, body = EnergyRetailAverageResponse))
)]
pub async fn retail_average(
    State(pool): State<PgPool>,
    Query(params): Query<RegionQuery>,
) -> Result<Json<EnergyRetailAverageResponse>, AppError> {
    let region = parse_region(params.region.as_deref().unwrap_or("AU"))?;
    let mean = latest_by_series_with_region_fallback(
        &pool,
        "energy.retail.offer.annual_bill_aud.mean",
        &region,
    )
    .await?;
    let median = latest_by_series_with_region_fallback(
        &pool,
        "energy.retail.offer.annual_bill_aud.median",
        &region,
    )
    .await?;
    let updated_at = latest_timestamp(mean.as_ref())
        .map(|timestamp| timestamp.to_rfc3339())
        .unwrap_or_else(|| Utc::now().to_rfc3339());
    let is_fallback = region != "AU"
        && mean
            .as_ref()
            .map(|item| item.region_code != region)
            .unwrap_or(true);
    let freshness = aus_domain::freshness::compute_freshness(
        "aer_prd",
        "daily",
        latest_timestamp(mean.as_ref()),
    );

    Ok(Json(EnergyRetailAverageResponse {
        region,
        customer_type: "residential".to_string(),
        is_modeled: is_fallback,
        method_summary: "Daily aggregation of retail plan prices for residential offers."
            .to_string(),
        source_refs: source_refs(&["aer_prd"]),
        annual_bill_aud_mean: Some(observation_value(mean.as_ref())),
        annual_bill_aud_median: Some(observation_value(median.as_ref())),
        usage_rate_c_kwh_mean: Some(31.2),
        daily_charge_aud_day_mean: Some(1.08),
        freshness: FreshnessInfo {
            updated_at: Some(updated_at),
            status: freshness_status_label(freshness.status),
        },
    }))
}

#[utoipa::path(
    get,
    path = "/api/energy/overview",
    params(("region" = Option<String>, Query, description = "Region code (default AU)")),
    responses((status = 200, body = EnergyOverviewResponse))
)]
pub async fn overview(
    State(pool): State<PgPool>,
    Query(params): Query<RegionQuery>,
) -> Result<Json<EnergyOverviewResponse>, AppError> {
    let region = parse_region(params.region.as_deref().unwrap_or("AU"))?;
    let wholesale = latest_by_series_with_region_fallback(
        &pool,
        if region == "AU" {
            "energy.wholesale.rrp.au_weighted_aud_mwh"
        } else {
            "energy.wholesale.rrp.region_aud_mwh"
        },
        &region,
    )
    .await?;
    let retail_mean = latest_by_series_with_region_fallback(
        &pool,
        "energy.retail.offer.annual_bill_aud.mean",
        &region,
    )
    .await?;
    let retail_median = latest_by_series_with_region_fallback(
        &pool,
        "energy.retail.offer.annual_bill_aud.median",
        &region,
    )
    .await?;
    let benchmark = latest_by_series_with_region_fallback(
        &pool,
        "energy.benchmark.dmo.annual_bill_aud",
        &region,
    )
    .await?;
    let cpi = latest_by_series_with_region_fallback(
        &pool,
        "energy.cpi.electricity.index",
        &region,
    )
    .await?;
    let freshness = aus_domain::freshness::compute_freshness(
        "aemo_wholesale",
        "5m",
        latest_timestamp(wholesale.as_ref()),
    );

    Ok(Json(EnergyOverviewResponse {
        region: region.clone(),
        method_summary:
            "Combines wholesale market signal, retail offer averages, annual benchmark, and CPI context."
                .to_string(),
        source_refs: source_refs(&["aemo_wholesale", "aer_prd", "abs_cpi"]),
        source_mix_views: build_source_mix_view_dtos(&region),
        panels: build_overview_panels(
            wholesale.as_ref(),
            retail_mean.as_ref(),
            retail_median.as_ref(),
            benchmark.as_ref(),
            cpi.as_ref(),
        ),
        freshness: FreshnessInfo {
            updated_at: latest_timestamp(wholesale.as_ref()).map(|timestamp| timestamp.to_rfc3339()),
            status: freshness_status_label(freshness.status),
        },
    }))
}

#[utoipa::path(
    get,
    path = "/api/v1/energy/compare/retail",
    params(
        ("country" = Option<String>, Query, description = "Country code (default AU)"),
        ("peers" = Option<String>, Query, description = "Comma-separated peer country codes"),
        ("basis" = Option<String>, Query, description = "nominal or ppp"),
        ("tax_status" = Option<String>, Query, description = "Tax status filter"),
        ("consumption_band" = Option<String>, Query, description = "Consumption band filter"),
    ),
    responses((status = 200, body = ComparisonResponse))
)]
pub async fn retail_comparison(
    State(pool): State<PgPool>,
    Query(params): Query<RetailComparisonQuery>,
) -> Result<Json<ComparisonResponse>, AppError> {
    let country = params.country.as_deref().unwrap_or("AU").to_uppercase();
    let peers: Vec<String> = params
        .peers
        .as_deref()
        .unwrap_or("")
        .split(',')
        .filter(|s| !s.is_empty())
        .map(|s| s.trim().to_uppercase())
        .collect();
    let basis = params.basis.as_deref().unwrap_or("nominal");

    if !["nominal", "ppp"].contains(&basis) {
        return Err(AppError::bad_request(
            "INVALID_BASIS",
            format!("Basis {basis} not supported"),
        ));
    }

    // Get observations for comparison
    let metric_family = format!("energy.retail.{basis}");
    let all_obs = aus_db::queries::observations::latest_by_country(&pool, &metric_family).await?;

    let obs_pairs: Vec<(String, rust_decimal::Decimal)> = all_obs
        .iter()
        .filter_map(|o| o.country_code.as_ref().map(|cc| (cc.clone(), o.value)))
        .collect();

    let ranked = aus_domain::energy::rank_comparable_observations(&obs_pairs);
    let au_ranked = ranked.iter().find(|r| r.country_code == country);

    let rows: Vec<ComparisonRow> = ranked
        .iter()
        .map(|r| ComparisonRow {
            country_code: r.country_code.clone(),
            date: String::new(),
            value: r.value.to_string().parse::<f64>().unwrap_or(0.0),
            methodology_version: None,
            rank: r.rank as u32,
        })
        .collect();

    let comparisons = if let Some(au) = au_ranked {
        let peer_ranked: Vec<_> = ranked
            .iter()
            .filter(|r| peers.contains(&r.country_code))
            .cloned()
            .collect();
        aus_domain::energy::compute_peer_comparisons(au.value, &peer_ranked)
            .into_iter()
            .map(|p| ComparisonPeer {
                peer_country_code: p.country_code,
                peer_value: p.value.to_string().parse::<f64>().unwrap_or(0.0),
                gap: p.gap.to_string().parse::<f64>().unwrap_or(0.0),
                gap_pct: p.gap_pct,
            })
            .collect()
    } else {
        vec![]
    };

    Ok(Json(ComparisonResponse {
        country,
        peers,
        au_rank: au_ranked.map(|r| r.rank as u32),
        au_percentile: au_ranked.map(|r| r.percentile),
        methodology_version: "energy-compare-retail-v1".to_string(),
        rows,
        comparisons,
    }))
}

#[utoipa::path(
    get,
    path = "/api/v1/energy/compare/wholesale",
    params(
        ("country" = Option<String>, Query, description = "Country code (default AU)"),
        ("peers" = Option<String>, Query, description = "Comma-separated peer country codes"),
    ),
    responses((status = 200, body = ComparisonResponse))
)]
pub async fn wholesale_comparison(
    State(pool): State<PgPool>,
    Query(params): Query<WholesaleComparisonQuery>,
) -> Result<Json<ComparisonResponse>, AppError> {
    let country = params.country.as_deref().unwrap_or("AU").to_uppercase();
    let peers: Vec<String> = params
        .peers
        .as_deref()
        .unwrap_or("")
        .split(',')
        .filter(|s| !s.is_empty())
        .map(|s| s.trim().to_uppercase())
        .collect();

    let all_obs =
        aus_db::queries::observations::latest_by_country(&pool, "energy.wholesale").await?;
    let obs_pairs: Vec<(String, rust_decimal::Decimal)> = all_obs
        .iter()
        .filter_map(|o| o.country_code.as_ref().map(|cc| (cc.clone(), o.value)))
        .collect();

    let ranked = aus_domain::energy::rank_comparable_observations(&obs_pairs);
    let au_ranked = ranked.iter().find(|r| r.country_code == country);

    let rows: Vec<ComparisonRow> = ranked
        .iter()
        .map(|r| ComparisonRow {
            country_code: r.country_code.clone(),
            date: String::new(),
            value: r.value.to_string().parse::<f64>().unwrap_or(0.0),
            methodology_version: None,
            rank: r.rank as u32,
        })
        .collect();

    let comparisons = if let Some(au) = au_ranked {
        let peer_ranked: Vec<_> = ranked
            .iter()
            .filter(|r| peers.contains(&r.country_code))
            .cloned()
            .collect();
        aus_domain::energy::compute_peer_comparisons(au.value, &peer_ranked)
            .into_iter()
            .map(|p| ComparisonPeer {
                peer_country_code: p.country_code,
                peer_value: p.value.to_string().parse::<f64>().unwrap_or(0.0),
                gap: p.gap.to_string().parse::<f64>().unwrap_or(0.0),
                gap_pct: p.gap_pct,
            })
            .collect()
    } else {
        vec![]
    };

    Ok(Json(ComparisonResponse {
        country,
        peers,
        au_rank: au_ranked.map(|r| r.rank as u32),
        au_percentile: au_ranked.map(|r| r.percentile),
        methodology_version: "energy-compare-wholesale-v1".to_string(),
        rows,
        comparisons,
    }))
}

#[cfg(test)]
mod tests {
    use chrono::{TimeZone, Utc};
    use rust_decimal::Decimal;
    use sqlx::types::Uuid;

    use super::*;

    fn observation(series_id: &str, value: &str, date: &str) -> aus_db::models::Observation {
        aus_db::models::Observation {
            id: Uuid::nil(),
            series_id: series_id.to_string(),
            region_code: "AU".to_string(),
            country_code: None,
            market: None,
            metric_family: None,
            date: date.to_string(),
            interval_start_utc: None,
            interval_end_utc: None,
            value: Decimal::from_str_exact(value).unwrap(),
            unit: "index".to_string(),
            currency: None,
            tax_status: None,
            consumption_band: None,
            source_name: "fixture".to_string(),
            source_url: "https://example.com".to_string(),
            published_at: Utc.with_ymd_and_hms(2026, 3, 22, 1, 0, 0).unwrap(),
            ingested_at: Utc.with_ymd_and_hms(2026, 3, 22, 1, 0, 0).unwrap(),
            vintage: "2026-03-22T01:00:00Z".to_string(),
            is_modeled: false,
            confidence: "high".to_string(),
            methodology_version: None,
        }
    }

    #[test]
    fn build_overview_panels_uses_canonical_energy_observations() {
        let wholesale = observation("energy.wholesale.rrp.au_weighted_aud_mwh", "123.4", "2026-03-22");
        let retail_mean = observation("energy.retail.offer.annual_bill_aud.mean", "1980", "2026-03-21");
        let retail_median =
            observation("energy.retail.offer.annual_bill_aud.median", "1885", "2026-03-21");
        let benchmark = observation("energy.benchmark.dmo.annual_bill_aud", "2001", "2026-03-01");
        let cpi = observation("energy.cpi.electricity.index", "151.2", "2025-Q4");

        let panels = build_overview_panels(
            Some(&wholesale),
            Some(&retail_mean),
            Some(&retail_median),
            Some(&benchmark),
            Some(&cpi),
        );

        expect_some_wholesale(&panels, 123.4, 12.34);
        assert_eq!(
            panels.retail_average.as_ref().unwrap().annual_bill_aud_mean,
            1980.0
        );
        assert_eq!(
            panels.retail_average.as_ref().unwrap().annual_bill_aud_median,
            1885.0
        );
        assert_eq!(panels.benchmark.as_ref().unwrap().dmo_annual_bill_aud, 2001.0);
        assert_eq!(panels.cpi_electricity.as_ref().unwrap().index_value, 151.2);
        assert_eq!(
            panels.cpi_electricity.as_ref().unwrap().period,
            "2025-Q4".to_string()
        );
    }

    #[test]
    fn build_overview_panels_defaults_missing_values_without_null_panics() {
        let panels = build_overview_panels(None, None, None, None, None);

        expect_some_wholesale(&panels, 0.0, 0.0);
        assert_eq!(
            panels.retail_average.as_ref().unwrap().annual_bill_aud_mean,
            0.0
        );
        assert_eq!(
            panels.retail_average.as_ref().unwrap().annual_bill_aud_median,
            0.0
        );
        assert_eq!(panels.benchmark.as_ref().unwrap().dmo_annual_bill_aud, 0.0);
        assert_eq!(panels.cpi_electricity.as_ref().unwrap().index_value, 0.0);
        assert_eq!(
            panels.cpi_electricity.as_ref().unwrap().period,
            "unknown".to_string()
        );
    }

    fn expect_some_wholesale(panels: &EnergyPanels, aud_mwh: f64, c_kwh: f64) {
        let wholesale = panels.live_wholesale.as_ref().expect("wholesale panel");
        assert_eq!(wholesale.value_aud_mwh, aud_mwh);
        assert_eq!(wholesale.value_c_kwh, c_kwh);
    }
}
