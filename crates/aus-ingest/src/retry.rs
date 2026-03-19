use std::time::Duration;

#[allow(dead_code)]
pub async fn with_retry<F, Fut, T, E>(name: &str, max_attempts: u32, f: F) -> Result<T, E>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
    E: std::fmt::Display,
{
    let mut attempt = 0;
    loop {
        attempt += 1;
        match f().await {
            Ok(v) => return Ok(v),
            Err(e) => {
                if attempt >= max_attempts {
                    tracing::error!("{name}: failed after {attempt} attempts: {e}");
                    return Err(e);
                }
                let delay = Duration::from_secs(2u64.pow(attempt));
                tracing::warn!("{name}: attempt {attempt} failed: {e}, retrying in {delay:?}");
                tokio::time::sleep(delay).await;
            }
        }
    }
}
