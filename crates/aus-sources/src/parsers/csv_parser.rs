/// Simple CSV parser: splits by newlines, uses first row as headers
pub fn parse_csv_rows(text: &str) -> Vec<std::collections::HashMap<String, String>> {
    let mut lines: Vec<&str> = text.lines().collect();
    if lines.is_empty() {
        return vec![];
    }

    let headers: Vec<String> = lines
        .remove(0)
        .split(',')
        .map(|h| h.trim().trim_matches('"').to_string())
        .collect();

    lines
        .iter()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            let values: Vec<&str> = line.split(',').collect();
            headers
                .iter()
                .enumerate()
                .filter_map(|(i, h)| {
                    values
                        .get(i)
                        .map(|v| (h.clone(), v.trim().trim_matches('"').to_string()))
                })
                .collect()
        })
        .collect()
}
