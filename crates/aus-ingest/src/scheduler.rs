use std::sync::Arc;

use aus_sources::fetch::HttpFetcher;
use sqlx::PgPool;
use tokio_cron_scheduler::{Job, JobScheduler};

pub async fn start_scheduler(
    pool: PgPool,
) -> Result<JobScheduler, Box<dyn std::error::Error + Send + Sync>> {
    let scheduler = JobScheduler::new().await?;
    let client = Arc::new(HttpFetcher::new());

    for job_def in crate::jobs::job_registry() {
        let pool = pool.clone();
        let client = client.clone();
        let name = job_def.name;

        let job = Job::new_async(job_def.cron, move |_uuid, _lock| {
            let pool = pool.clone();
            let client = client.clone();
            Box::pin(async move {
                if let Err(e) = crate::jobs::run_job(name, &pool, client.as_ref()).await {
                    tracing::error!("Job {name} failed: {e}");
                }
            })
        })?;

        scheduler.add(job).await?;
        tracing::info!(
            "Registered job: {} with cron: {}",
            job_def.name,
            job_def.cron
        );
    }

    scheduler.start().await?;
    Ok(scheduler)
}
