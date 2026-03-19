//! Domain error types.

use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum DomainError {
    #[error("Unsupported region: {0}")]
    UnsupportedRegion(String),

    #[error("Unknown series ID: {0}")]
    UnknownSeriesId(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),
}
