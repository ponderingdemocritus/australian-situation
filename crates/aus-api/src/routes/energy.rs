use axum::Json;
use axum::extract::{Query, State};
use sqlx::PgPool;

use crate::dto::*;
use crate::error::AppError;

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
    let region = params.region.as_deref().unwrap_or("AU");
    let window = params.window.as_deref().unwrap_or("5m");

    // Validate region (exclude WA, NT, ACT for wholesale)
    let excluded = ["WA", "NT", "ACT"];
    if excluded.contains(&region.to_uppercase().as_str()) {
        return Err(AppError::bad_request(
            "UNSUPPORTED_REGION",
            format!("Region {region} not supported for wholesale"),
        ));
    }

    // Validate window
    if !["5m", "1h", "24h"].contains(&window) {
        return Err(AppError::bad_request(
            "INVALID_WINDOW",
            format!("Window {window} not supported"),
        ));
    }

    let series_id = format!("energy.wholesale_price_{window}");
    let obs = aus_db::queries::observations::latest_by_series(&pool, &series_id, region).await?;

    let (latest, freshness_status) = match &obs {
        Some(o) => {
            let value_mwh = o.value.to_string().parse::<f64>().unwrap_or(0.0);
            (
                Some(WholesaleLatestPoint {
                    timestamp: o.published_at.to_rfc3339(),
                    value_aud_mwh: value_mwh,
                    value_c_kwh: value_mwh / 10.0,
                }),
                "fresh".to_string(),
            )
        }
        None => (None, "stale".to_string()),
    };

    Ok(Json(EnergyLiveWholesaleResponse {
        region: region.to_string(),
        window: window.to_string(),
        is_modeled: false,
        method_summary: "Spot price from AEMO".to_string(),
        source_refs: vec![SourceRef {
            source_id: "aemo_wholesale".to_string(),
            name: "AEMO".to_string(),
            url: "https://www.nemweb.com.au".to_string(),
        }],
        latest,
        rollups: None,
        freshness: FreshnessInfo {
            updated_at: obs.map(|o| o.published_at.to_rfc3339()),
            status: freshness_status,
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
    let region = params.region.as_deref().unwrap_or("AU");

    let obs = aus_db::queries::observations::latest_by_series(
        &pool,
        "energy.retail_annual_bill_aud",
        region,
    )
    .await?;

    Ok(Json(EnergyRetailAverageResponse {
        region: region.to_string(),
        customer_type: "residential".to_string(),
        is_modeled: false,
        method_summary: "AER product reference data".to_string(),
        source_refs: vec![SourceRef {
            source_id: "aer_prd".to_string(),
            name: "AER".to_string(),
            url: "https://www.aer.gov.au".to_string(),
        }],
        annual_bill_aud_mean: obs
            .as_ref()
            .map(|o| o.value.to_string().parse::<f64>().unwrap_or(0.0)),
        annual_bill_aud_median: None,
        usage_rate_c_kwh_mean: None,
        daily_charge_aud_day_mean: None,
        freshness: FreshnessInfo {
            updated_at: obs.map(|o| o.published_at.to_rfc3339()),
            status: "fresh".to_string(),
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
    State(_pool): State<PgPool>,
    Query(params): Query<RegionQuery>,
) -> Result<Json<EnergyOverviewResponse>, AppError> {
    let region = params.region.as_deref().unwrap_or("AU");

    let mix_views = aus_domain::energy::build_energy_source_mix_views(region);
    let mix_dtos: Vec<SourceMixViewDto> = mix_views
        .into_iter()
        .map(|v| SourceMixViewDto {
            view_id: v.view_type.clone(),
            title: if v.view_type == "official" {
                "Annual Generation Mix".to_string()
            } else {
                "Operational Mix".to_string()
            },
            coverage_label: v.region_code.clone(),
            updated_at: None,
            source_refs: vec![],
            rows: v
                .shares
                .into_iter()
                .map(|s| SourceMixRowDto {
                    source_key: s.source_key,
                    label: s.label,
                    share_pct: s.share_pct,
                })
                .collect(),
        })
        .collect();

    Ok(Json(EnergyOverviewResponse {
        region: region.to_string(),
        method_summary: "Combined energy dashboard".to_string(),
        source_refs: vec![],
        source_mix_views: mix_dtos,
        panels: EnergyPanels {
            live_wholesale: None,
            retail_average: None,
            benchmark: None,
            cpi_electricity: None,
        },
        freshness: FreshnessInfo {
            updated_at: None,
            status: "stale".to_string(),
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
