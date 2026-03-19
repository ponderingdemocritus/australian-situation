use aus_sources::fetch::SourceFetch;
use sqlx::PgPool;

pub async fn run(
    pool: &PgPool,
    client: &(impl SourceFetch + ?Sized),
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("sync-major-goods-daily: starting");
    let url = super::source_url("major_goods_prices");
    let response = aus_sources::prices::major_goods::fetch_prices(client, &url).await?;
    tracing::info!(
        "sync-major-goods-daily: fetched {} items observed at {}",
        response.items.len(),
        response.observed_at,
    );
    // Major goods prices go through the price warehouse pipeline (price_observations table)
    // rather than the observations table. For now we log the fetch; the price warehouse
    // ingestion logic lives in aus-db::queries::price_warehouse.
    let _ = pool; // acknowledge pool availability for future use
    tracing::info!("sync-major-goods-daily: done");
    Ok(())
}
