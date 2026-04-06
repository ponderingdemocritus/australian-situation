use async_trait::async_trait;

use crate::error::SourceClientError;

/// Response from a fetch operation
pub struct FetchResponse {
    pub status: u16,
    pub body: String,
}

/// Binary response from a fetch operation
pub struct FetchBytesResponse {
    pub status: u16,
    pub body: Vec<u8>,
}

/// Injectable HTTP client trait for testing
#[async_trait]
pub trait SourceFetch: Send + Sync {
    async fn get(&self, url: &str, accept: &str) -> Result<FetchResponse, SourceClientError>;
    async fn get_bytes(
        &self,
        url: &str,
        accept: &str,
    ) -> Result<FetchBytesResponse, SourceClientError>;
}

/// Real HTTP client using reqwest
pub struct HttpFetcher {
    client: reqwest::Client,
}

impl HttpFetcher {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .user_agent("aus-dash/1.0 (https://github.com/ponderingdemocritus/australian-situation)")
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
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

    async fn get_bytes(
        &self,
        url: &str,
        accept: &str,
    ) -> Result<FetchBytesResponse, SourceClientError> {
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
        let body = resp.bytes().await.map_err(|e| {
            SourceClientError::transient(format!("Failed to read response bytes: {e}"))
                .with_cause(e)
        })?;

        if status >= 400 {
            let preview = String::from_utf8_lossy(&body[..body.len().min(200)]);
            return Err(SourceClientError::from_http(
                status,
                format!("HTTP {status}: {preview}"),
            ));
        }

        Ok(FetchBytesResponse {
            status,
            body: body.to_vec(),
        })
    }
}
