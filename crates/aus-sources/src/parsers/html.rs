/// Strip HTML tags and normalize whitespace
pub fn strip_html_tags(html: &str) -> String {
    let re = regex::Regex::new(r"<[^>]+>").unwrap();
    let text = re.replace_all(html, " ");
    let ws = regex::Regex::new(r"\s+").unwrap();
    ws.replace_all(&text, " ").trim().to_string()
}
