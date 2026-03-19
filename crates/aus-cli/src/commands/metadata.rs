use crate::config::Config;

pub async fn freshness(config: &Config) -> Result<(), Box<dyn std::error::Error>> {
    let resp = config
        .client()
        .get(config.url("/api/metadata/freshness"))
        .send()
        .await?
        .text()
        .await?;
    println!("{resp}");
    Ok(())
}

pub async fn sources(config: &Config) -> Result<(), Box<dyn std::error::Error>> {
    let resp = config
        .client()
        .get(config.url("/api/metadata/sources"))
        .send()
        .await?
        .text()
        .await?;
    println!("{resp}");
    Ok(())
}

pub async fn methodology(config: &Config, metric: &str) -> Result<(), Box<dyn std::error::Error>> {
    let resp = config
        .client()
        .get(config.url("/api/v1/metadata/methodology"))
        .query(&[("metric", metric)])
        .send()
        .await?
        .text()
        .await?;
    println!("{resp}");
    Ok(())
}
