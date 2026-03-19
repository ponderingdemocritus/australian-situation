use thiserror::Error;

#[derive(Debug, Error)]
#[error("{message}")]
pub struct SourceClientError {
    pub message: String,
    pub is_transient: bool,
    pub status: Option<u16>,
    #[source]
    pub cause: Option<Box<dyn std::error::Error + Send + Sync>>,
}

impl SourceClientError {
    pub fn transient(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            is_transient: true,
            status: None,
            cause: None,
        }
    }
    pub fn permanent(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            is_transient: false,
            status: None,
            cause: None,
        }
    }
    pub fn from_http(status: u16, message: impl Into<String>) -> Self {
        let is_transient = matches!(status, 408 | 429 | 500..=599);
        Self {
            message: message.into(),
            is_transient,
            status: Some(status),
            cause: None,
        }
    }
    pub fn with_cause(mut self, cause: impl std::error::Error + Send + Sync + 'static) -> Self {
        self.cause = Some(Box::new(cause));
        self
    }
}
