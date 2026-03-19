use crate::config::Config;

pub async fn get(
    config: &Config,
    id: &str,
    region: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let resp = config
        .client()
        .get(config.url(&format!("/api/series/{id}")))
        .query(&[("region", region)])
        .send()
        .await?
        .text()
        .await?;
    println!("{resp}");
    Ok(())
}
