pub struct Config {
    pub base_url: String,
    pub auth_password: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            base_url: std::env::var("AUS_DASH_API_URL")
                .unwrap_or_else(|_| "http://localhost:3002".to_string()),
            auth_password: std::env::var("AUS_DASH_API_PASSWORD").ok(),
        }
    }

    pub fn client(&self) -> reqwest::Client {
        reqwest::Client::new()
    }

    pub fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    pub fn auth_header(&self) -> Option<String> {
        self.auth_password.as_ref().map(|pw| {
            use base64::Engine;
            let encoded = base64::engine::general_purpose::STANDARD.encode(format!("user:{pw}"));
            format!("Basic {encoded}")
        })
    }
}
