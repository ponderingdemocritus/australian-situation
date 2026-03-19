mod jobs;
mod mappers;
mod retry;
mod scheduler;

use clap::Parser;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(
    name = "aus-ingest",
    about = "Australian Economic Dashboard ingestion worker"
)]
struct Cli {
    /// Run a single job by name then exit
    #[arg(long)]
    run_once: Option<String>,

    /// List all registered jobs
    #[arg(long)]
    list_jobs: bool,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let cli = Cli::parse();

    if cli.list_jobs {
        for job in jobs::job_registry() {
            println!("{:<40} {}", job.name, job.cron);
        }
        return Ok(());
    }

    let pool = aus_db::pool::create_pool().await?;

    if let Some(job_name) = cli.run_once {
        let client = aus_sources::fetch::HttpFetcher::new();
        jobs::run_job(&job_name, &pool, &client).await?;
        return Ok(());
    }

    // Start cron scheduler
    tracing::info!("aus-ingest starting scheduler");
    let _scheduler = scheduler::start_scheduler(pool).await?;

    // Wait forever (graceful shutdown on SIGTERM)
    tokio::signal::ctrl_c().await?;
    tracing::info!("aus-ingest shutting down");
    Ok(())
}
