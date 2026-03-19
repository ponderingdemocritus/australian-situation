use axum::extract::Request;
use axum::http::header;
use axum::middleware::Next;
use axum::response::Response;
use base64::Engine;

use crate::error::AppError;

pub async fn basic_auth(req: Request, next: Next) -> Result<Response, AppError> {
    let auth_header = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok());

    match auth_header {
        Some(auth) if auth.starts_with("Basic ") => {
            let decoded = base64::engine::general_purpose::STANDARD
                .decode(&auth[6..])
                .map_err(|_| AppError::unauthorized())?;
            let credentials = String::from_utf8(decoded).map_err(|_| AppError::unauthorized())?;
            let password = credentials.split(':').nth(1).unwrap_or("");
            if password == "buildaustralia" {
                Ok(next.run(req).await)
            } else {
                Err(AppError::unauthorized())
            }
        }
        _ => Err(AppError::unauthorized()),
    }
}
