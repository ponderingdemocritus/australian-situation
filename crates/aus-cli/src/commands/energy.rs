use crate::config::Config;

pub async fn wholesale(
    config: &Config,
    region: &str,
    window: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let resp = config
        .client()
        .get(config.url("/api/energy/live-wholesale"))
        .query(&[("region", region), ("window", window)])
        .send()
        .await?
        .text()
        .await?;
    println!("{resp}");
    Ok(())
}

pub async fn retail(config: &Config, region: &str) -> Result<(), Box<dyn std::error::Error>> {
    let resp = config
        .client()
        .get(config.url("/api/energy/retail-average"))
        .query(&[("region", region)])
        .send()
        .await?
        .text()
        .await?;
    println!("{resp}");
    Ok(())
}

pub async fn overview(config: &Config, region: &str) -> Result<(), Box<dyn std::error::Error>> {
    let resp = config
        .client()
        .get(config.url("/api/energy/overview"))
        .query(&[("region", region)])
        .send()
        .await?
        .text()
        .await?;
    println!("{resp}");
    Ok(())
}

pub async fn compare_retail(
    config: &Config,
    country: &str,
    peers: &str,
    basis: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let resp = config
        .client()
        .get(config.url("/api/v1/energy/compare/retail"))
        .query(&[("country", country), ("peers", peers), ("basis", basis)])
        .send()
        .await?
        .text()
        .await?;
    println!("{resp}");
    Ok(())
}

pub async fn compare_wholesale(
    config: &Config,
    country: &str,
    peers: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let resp = config
        .client()
        .get(config.url("/api/v1/energy/compare/wholesale"))
        .query(&[("country", country), ("peers", peers)])
        .send()
        .await?
        .text()
        .await?;
    println!("{resp}");
    Ok(())
}
