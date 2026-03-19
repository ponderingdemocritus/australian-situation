use crate::au::aemo_nem_mix::AemoOperationalMixPoint;
use crate::error::SourceClientError;
use crate::fetch::SourceFetch;

pub async fn fetch_wem_mix(
    client: &(impl SourceFetch + ?Sized),
    url: &str,
) -> Result<Vec<AemoOperationalMixPoint>, SourceClientError> {
    // Same structure as NEM, different URL
    crate::au::aemo_nem_mix::fetch_nem_mix(client, url).await
}
