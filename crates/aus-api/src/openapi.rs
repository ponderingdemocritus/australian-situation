use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Australian Economic Dashboard API",
        version = "1.0.0",
        description = "API for Australian economic data — energy, housing, and prices"
    ),
    paths(
        crate::routes::health::health,
        crate::routes::housing::overview,
        crate::routes::series::get_series,
        crate::routes::energy::live_wholesale,
        crate::routes::energy::retail_average,
        crate::routes::energy::overview,
        crate::routes::energy::retail_comparison,
        crate::routes::energy::wholesale_comparison,
        crate::routes::prices::major_goods,
        crate::routes::prices::ai_deflation,
        crate::routes::metadata::freshness,
        crate::routes::metadata::sources,
        crate::routes::metadata::methodology,
    ),
    components(schemas(
        crate::dto::HealthResponse,
        crate::dto::HousingOverviewResponse,
        crate::dto::HousingMetric,
        crate::dto::SeriesResponse,
        crate::dto::MetricPoint,
        crate::dto::EnergyLiveWholesaleResponse,
        crate::dto::WholesaleLatestPoint,
        crate::dto::WholesaleRollups,
        crate::dto::EnergyRetailAverageResponse,
        crate::dto::EnergyOverviewResponse,
        crate::dto::SourceMixViewDto,
        crate::dto::SourceMixRowDto,
        crate::dto::EnergyPanels,
        crate::dto::PanelWholesale,
        crate::dto::PanelRetail,
        crate::dto::PanelBenchmark,
        crate::dto::PanelCpi,
        crate::dto::ComparisonResponse,
        crate::dto::ComparisonRow,
        crate::dto::ComparisonPeer,
        crate::dto::PriceIndexOverviewResponse,
        crate::dto::PriceIndexItem,
        crate::dto::MetadataFreshnessResponse,
        crate::dto::FreshnessSeriesItem,
        crate::dto::MetadataSourcesResponse,
        crate::dto::SourceCatalogDto,
        crate::dto::MethodologyResponse,
        crate::dto::SourceRef,
        crate::dto::FreshnessInfo,
    ))
)]
pub struct ApiDoc;
