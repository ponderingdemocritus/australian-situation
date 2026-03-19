use serde::{Deserialize, Serialize};

use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlnRetailTariffPoint {
    pub tariff_class: String,
    pub consumption_band: String,
    pub price_local_kwh: f64,
}

#[derive(Deserialize)]
struct PlnPostResponse {
    #[allow(dead_code)]
    date: Option<String>,
    content: PlnContent,
}

#[derive(Deserialize)]
struct PlnContent {
    rendered: String,
}

fn parse_pln_currency(text: &str) -> Option<f64> {
    let re = regex::Regex::new(r"(?i)Rp\s*([\d.,]+)").ok()?;
    let caps = re.captures(text)?;
    let num_str = caps[1].replace('.', "").replace(',', ".");
    num_str.parse::<f64>().ok()
}

pub async fn fetch_tariff(
    client: &(impl SourceFetch + ?Sized),
) -> Result<Vec<PlnRetailTariffPoint>, SourceClientError> {
    let url = "https://web.pln.co.id/cms/wp-json/wp/v2/posts/54823";
    let resp = client.get(url, "application/json").await?;
    let parsed: PlnPostResponse = serde_json::from_str(&resp.body)
        .map_err(|e| SourceClientError::permanent(format!("Failed to parse PLN: {e}")))?;

    let html = &parsed.content.rendered;
    let document = scraper::Html::parse_document(html);
    let row_sel = scraper::Selector::parse("tr").unwrap();
    let td_sel = scraper::Selector::parse("td").unwrap();

    let mut points = Vec::new();
    for row in document.select(&row_sel) {
        let cells: Vec<String> = row
            .select(&td_sel)
            .map(|td| crate::parsers::html::strip_html_tags(&td.inner_html()))
            .collect();
        if cells.len() < 4 {
            continue;
        }

        let col0 = &cells[0];
        let (tariff_class, consumption_band) = if col0.contains("R-1")
            && col0.contains("Subsidi")
            && cells.iter().any(|c| c.contains("900"))
        {
            (col0.clone(), "household_low".to_string())
        } else if col0.contains("R-1")
            && col0.contains("Non")
            && cells
                .iter()
                .any(|c| c.contains("1300") || c.contains("1.300"))
        {
            (col0.clone(), "household_mid".to_string())
        } else if col0.starts_with("R-2") {
            (col0.clone(), "household_high".to_string())
        } else {
            continue;
        };

        if let Some(price) = cells.get(3).and_then(|c| parse_pln_currency(c)) {
            points.push(PlnRetailTariffPoint {
                tariff_class,
                consumption_band,
                price_local_kwh: price,
            });
        }
    }

    Ok(points)
}
