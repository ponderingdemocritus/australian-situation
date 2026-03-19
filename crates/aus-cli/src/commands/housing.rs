use crate::config::Config;

pub async fn overview(config: &Config, region: &str) -> Result<(), Box<dyn std::error::Error>> {
    let resp = config
        .client()
        .get(config.url("/api/housing/overview"))
        .query(&[("region", region)])
        .send()
        .await?
        .text()
        .await?;
    println!("{resp}");
    Ok(())
}
