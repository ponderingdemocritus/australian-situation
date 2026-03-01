# Research Plan: Electricity Prices APIs (Australia + Global)

## Main question
What data APIs and datasets should we use to build clear, reliable electricity price comparisons between Australia and global markets?

## Subtopics
1. Australia wholesale + retail data sources
- Expected: official market operators/regulators, API/file access patterns, refresh cadence, geographic coverage (NEM regions + WA/NT where possible), licensing.

2. Global official and widely-used price APIs
- Expected: authoritative multi-country APIs (e.g., OECD/Eurostat/US/EIA/ENTSO-E), granularity, historical depth, limitations, access requirements.

3. Benchmarking design for Australia-vs-global comparisons
- Expected: metric definitions, normalization strategy (currency, taxes, PPP, units), and minimum viable data model for dashboarding.

4. Commercial API alternatives and fallback options
- Expected: paid APIs, pros/cons, and where they fill gaps not covered by public APIs.

## Synthesis approach
- Prioritize official/public sources for baseline reliability.
- Separate wholesale market prices from end-consumer tariffs.
- Recommend a practical API stack for MVP and a phased expansion path.
- Deliver scope including data contracts, cadence, risks, and implementation effort.
