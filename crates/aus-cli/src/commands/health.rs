use crate::config::Config;

pub async fn run(config: &Config) -> Result<(), Box<dyn std::error::Error>> {
    let resp = config
        .client()
        .get(config.url("/api/health"))
        .send()
        .await?
        .text()
        .await?;
    println!("{resp}");
    Ok(())
}
