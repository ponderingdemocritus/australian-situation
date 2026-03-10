# Comparison Expansion Research Plan

## Main Question

What reliable retail and wholesale electricity price sources can support adding India, China, and Indonesia to the dashboard comparison pipeline, and which of those countries are realistically implementable in this repo now?

## Subtopics

1. Retail source research for India, China, and Indonesia
   - Find official or primary-source retail electricity price datasets with machine-readable access or stable publication format.
   - Confirm cadence, unit, geography, and whether household-comparable pricing is available.

2. Wholesale source research for India, China, and Indonesia
   - Find official or primary-source wholesale/spot market price datasets.
   - Confirm whether each country has a comparable wholesale market concept and stable access path.

3. Implementation fit against current pipeline
   - Map viable sources onto the existing ingest architecture.
   - Identify which countries can be supported without inventing fake data and what code changes would be required.

## Expected Output

1. Country-by-country source table for retail and wholesale.
2. Recommendation on which countries should be added now versus deferred.
3. Specific repo changes needed for ingest, normalization, API, tests, and UI.

## Synthesis Plan

After the research subtopics complete, compare source quality and implementation risk, choose the countries that are supportable now, then implement only the defensible subset with tests first.
