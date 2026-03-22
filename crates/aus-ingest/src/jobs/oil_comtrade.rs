use aus_sources::fetch::SourceFetch;
use aus_sources::intl::un_comtrade::UnComtradeConfig;
use chrono::Datelike;
use sqlx::PgPool;

use crate::mappers;

pub async fn run(
    pool: &PgPool,
    client: &(impl SourceFetch + ?Sized),
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("sync-oil-comtrade-annual: starting");

    let api_key = std::env::var("UN_COMTRADE_API_KEY").map_err(|_| {
        Box::<dyn std::error::Error + Send + Sync>::from(
            "UN_COMTRADE_API_KEY environment variable not set",
        )
    })?;

    let config = UnComtradeConfig { api_key };

    let now = chrono::Utc::now();
    let current_year = now.format("%Y").to_string();
    let prev_year = (now.year() - 1).to_string();
    let prev2_year = (now.year() - 2).to_string();
    let periods: Vec<&str> = vec![&prev2_year, &prev_year, &current_year];

    let imports = aus_sources::intl::un_comtrade::fetch_oil_imports(
        client,
        &config,
        &["2709", "2710"],
        &periods,
    )
    .await?;

    tracing::info!(
        "sync-oil-comtrade-annual: fetched {} import records",
        imports.len()
    );

    let observations = mappers::oil::map_comtrade_oil_imports(imports);
    let obs_models = super::to_db_observations(&observations);
    let (inserted, _updated) =
        aus_db::queries::observations::upsert_batch(pool, &obs_models).await?;

    tracing::info!("sync-oil-comtrade-annual: upserted {inserted} observations");
    Ok(())
}
