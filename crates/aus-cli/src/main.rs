mod commands;
mod config;

use clap::{Parser, Subcommand};
use config::Config;

#[derive(Parser)]
#[command(
    name = "aus-cli",
    about = "CLI for the Australian Economic Dashboard API"
)]
struct Cli {
    /// API base URL (overrides AUS_DASH_API_URL env)
    #[arg(long, global = true)]
    api_url: Option<String>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Check API health
    Health,

    /// Energy endpoints
    Energy {
        #[command(subcommand)]
        cmd: EnergyCmd,
    },

    /// Housing endpoints
    Housing {
        #[command(subcommand)]
        cmd: HousingCmd,
    },

    /// Series data
    Series {
        /// Series ID
        id: String,
        /// Region code
        #[arg(long, default_value = "AU")]
        region: String,
    },

    /// Price endpoints (require auth)
    Prices {
        #[command(subcommand)]
        cmd: PricesCmd,
    },

    /// Metadata endpoints
    Metadata {
        #[command(subcommand)]
        cmd: MetadataCmd,
    },
}

#[derive(Subcommand)]
enum EnergyCmd {
    /// Live wholesale prices
    Wholesale {
        #[arg(long, default_value = "AU")]
        region: String,
        #[arg(long, default_value = "5m")]
        window: String,
    },
    /// Retail average
    Retail {
        #[arg(long, default_value = "AU")]
        region: String,
    },
    /// Energy overview
    Overview {
        #[arg(long, default_value = "AU")]
        region: String,
    },
    /// Compare retail prices internationally
    CompareRetail {
        #[arg(long, default_value = "AU")]
        country: String,
        #[arg(long, default_value = "")]
        peers: String,
        #[arg(long, default_value = "nominal")]
        basis: String,
    },
    /// Compare wholesale prices internationally
    CompareWholesale {
        #[arg(long, default_value = "AU")]
        country: String,
        #[arg(long, default_value = "")]
        peers: String,
    },
}

#[derive(Subcommand)]
enum HousingCmd {
    /// Housing overview
    Overview {
        #[arg(long, default_value = "AU")]
        region: String,
    },
}

#[derive(Subcommand)]
enum PricesCmd {
    /// Major goods price index
    MajorGoods {
        #[arg(long, default_value = "AU")]
        region: String,
    },
    /// AI deflation index
    AiDeflation {
        #[arg(long, default_value = "AU")]
        region: String,
    },
}

#[derive(Subcommand)]
enum MetadataCmd {
    /// Data freshness
    Freshness,
    /// Source catalog
    Sources,
    /// Methodology info
    Methodology {
        /// Metric key
        metric: String,
    },
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    let mut config = Config::from_env();
    if let Some(url) = cli.api_url {
        config.base_url = url;
    }

    match cli.command {
        Commands::Health => commands::health::run(&config).await?,
        Commands::Energy { cmd } => match cmd {
            EnergyCmd::Wholesale { region, window } => {
                commands::energy::wholesale(&config, &region, &window).await?
            }
            EnergyCmd::Retail { region } => commands::energy::retail(&config, &region).await?,
            EnergyCmd::Overview { region } => commands::energy::overview(&config, &region).await?,
            EnergyCmd::CompareRetail {
                country,
                peers,
                basis,
            } => commands::energy::compare_retail(&config, &country, &peers, &basis).await?,
            EnergyCmd::CompareWholesale { country, peers } => {
                commands::energy::compare_wholesale(&config, &country, &peers).await?
            }
        },
        Commands::Housing { cmd } => match cmd {
            HousingCmd::Overview { region } => {
                commands::housing::overview(&config, &region).await?
            }
        },
        Commands::Series { id, region } => commands::series::get(&config, &id, &region).await?,
        Commands::Prices { cmd } => match cmd {
            PricesCmd::MajorGoods { region } => {
                commands::prices::major_goods(&config, &region).await?
            }
            PricesCmd::AiDeflation { region } => {
                commands::prices::ai_deflation(&config, &region).await?
            }
        },
        Commands::Metadata { cmd } => match cmd {
            MetadataCmd::Freshness => commands::metadata::freshness(&config).await?,
            MetadataCmd::Sources => commands::metadata::sources(&config).await?,
            MetadataCmd::Methodology { metric } => {
                commands::metadata::methodology(&config, &metric).await?
            }
        },
    }

    Ok(())
}
