use crate::config::Config;

pub async fn major_goods(config: &Config, region: &str) -> Result<(), Box<dyn std::error::Error>> {
    let mut req = config
        .client()
        .get(config.url("/api/prices/major-goods"))
        .query(&[("region", region)]);
    if let Some(auth) = config.auth_header() {
        req = req.header("Authorization", auth);
    }
    let resp = req.send().await?.text().await?;
    println!("{resp}");
    Ok(())
}

pub async fn ai_deflation(config: &Config, region: &str) -> Result<(), Box<dyn std::error::Error>> {
    let mut req = config
        .client()
        .get(config.url("/api/prices/ai-deflation"))
        .query(&[("region", region)]);
    if let Some(auth) = config.auth_header() {
        req = req.header("Authorization", auth);
    }
    let resp = req.send().await?.text().await?;
    println!("{resp}");
    Ok(())
}
