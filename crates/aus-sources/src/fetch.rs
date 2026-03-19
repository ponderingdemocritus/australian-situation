use async_trait::async_trait;

use crate::error::SourceClientError;

/// Response from a fetch operation
pub struct FetchResponse {
    pub status: u16,
    pub body: String,
}

/// Injectable HTTP client trait for testing
#[async_trait]
pub trait SourceFetch: Send + Sync {
    async fn get(&self, url: &str, accept: &str) -> Result<FetchResponse, SourceClientError>;
}

/// Real HTTP client using reqwest
pub struct HttpFetcher {
    client: reqwest::Client,
}

impl HttpFetcher {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }
}

impl Default for HttpFetcher {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl SourceFetch for HttpFetcher {
    async fn get(&self, url: &str, accept: &str) -> Result<FetchResponse, SourceClientError> {
        let resp = self
            .client
            .get(url)
            .header("Accept", accept)
            .send()
            .await
            .map_err(|e| {
                SourceClientError::transient(format!("HTTP request failed: {e}")).with_cause(e)
            })?;

        let status = resp.status().as_u16();
        let body = resp.text().await.map_err(|e| {
            SourceClientError::transient(format!("Failed to read response: {e}")).with_cause(e)
        })?;

        if status >= 400 {
            return Err(SourceClientError::from_http(
                status,
                format!("HTTP {status}: {}", &body[..body.len().min(200)]),
            ));
        }

        Ok(FetchResponse { status, body })
    }
}
