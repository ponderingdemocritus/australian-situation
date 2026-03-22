use aus_sources::fetch::SourceFetch;
use sqlx::PgPool;

use crate::mappers;

pub async fn run(
    pool: &PgPool,
    client: &(impl SourceFetch + ?Sized),
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("sync-oil-eia-petroleum-daily: starting");

    let api_key = std::env::var("EIA_API_KEY").unwrap_or_default();

    // Fetch monthly production (only activity with monthly data for AUS)
    let monthly_url = format!(
        "https://api.eia.gov/v2/international/data/?api_key={}&frequency=monthly&data[0]=value&facets[productId][]=57&facets[countryRegionId][]=AUS&facets[activityId][]=1&facets[unit][]=TBPD&sort[0][column]=period&sort[0][direction]=desc&length=5000",
        api_key
    );
    let monthly_points = aus_sources::intl::eia_petroleum::fetch_oil_data(client, &monthly_url).await?;
    tracing::info!("sync-oil-eia-petroleum-daily: fetched {} monthly points", monthly_points.len());

    // Fetch annual data for production/imports/exports (product 57 = crude oil) in TBPD
    let annual_url = format!(
        "https://api.eia.gov/v2/international/data/?api_key={}&frequency=annual&data[0]=value&facets[productId][]=57&facets[countryRegionId][]=AUS&facets[activityId][]=1&facets[activityId][]=3&facets[activityId][]=4&facets[unit][]=TBPD&sort[0][column]=period&sort[0][direction]=desc&length=5000",
        api_key
    );
    let annual_points = aus_sources::intl::eia_petroleum::fetch_oil_data(client, &annual_url).await?;
    tracing::info!("sync-oil-eia-petroleum-daily: fetched {} annual crude points", annual_points.len());

    // Fetch annual consumption (product 5 = petroleum & other liquids, activity 2)
    let consumption_url = format!(
        "https://api.eia.gov/v2/international/data/?api_key={}&frequency=annual&data[0]=value&facets[productId][]=5&facets[countryRegionId][]=AUS&facets[activityId][]=2&facets[unit][]=TBPD&sort[0][column]=period&sort[0][direction]=desc&length=5000",
        api_key
    );
    let consumption_points = aus_sources::intl::eia_petroleum::fetch_oil_data(client, &consumption_url).await?;
    tracing::info!("sync-oil-eia-petroleum-daily: fetched {} annual consumption points", consumption_points.len());

    let mut all_points = monthly_points;
    all_points.extend(annual_points);
    all_points.extend(consumption_points);
    let observations = mappers::oil::map_eia_oil_points(all_points);

    let obs_models = super::to_db_observations(&observations);
    let (inserted, _updated) =
        aus_db::queries::observations::upsert_batch(pool, &obs_models).await?;
    tracing::info!("sync-oil-eia-petroleum-daily: upserted {inserted} observations");
    Ok(())
}
