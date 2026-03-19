use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

#[derive(Debug)]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub status: StatusCode,
}

impl AppError {
    pub fn bad_request(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            status: StatusCode::BAD_REQUEST,
        }
    }
    pub fn not_found(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            status: StatusCode::NOT_FOUND,
        }
    }
    pub fn unauthorized() -> Self {
        Self {
            code: "UNAUTHORIZED".into(),
            message: "Authentication required".into(),
            status: StatusCode::UNAUTHORIZED,
        }
    }
    #[allow(dead_code)]
    pub fn forbidden(message: impl Into<String>) -> Self {
        Self {
            code: "FORBIDDEN".into(),
            message: message.into(),
            status: StatusCode::FORBIDDEN,
        }
    }
    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            code: "INTERNAL_ERROR".into(),
            message: message.into(),
            status: StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let body = json!({ "error": { "code": self.code, "message": self.message } });
        (self.status, axum::Json(body)).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        tracing::error!("Database error: {e}");
        Self::internal("Database error")
    }
}

impl From<aus_domain::error::DomainError> for AppError {
    fn from(e: aus_domain::error::DomainError) -> Self {
        match &e {
            aus_domain::error::DomainError::UnsupportedRegion(_) => {
                Self::bad_request("UNSUPPORTED_REGION", e.to_string())
            }
            aus_domain::error::DomainError::UnknownSeriesId(_) => {
                Self::not_found("UNKNOWN_SERIES_ID", e.to_string())
            }
            aus_domain::error::DomainError::InvalidInput(_) => {
                Self::bad_request("INVALID_INPUT", e.to_string())
            }
        }
    }
}
