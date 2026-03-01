import type { OpenAPIV3_1 } from "openapi-types";

export const OPENAPI_DOCUMENTATION: Partial<OpenAPIV3_1.Document> = {
  info: {
    title: "AUS Dash API",
    version: "1.1.0",
    description:
      "Economic and energy indicators API for AUS Dash, including cross-country energy comparison endpoints."
  },
  servers: [{ url: "http://localhost:3001", description: "Local Server" }],
  tags: [
    { name: "Health" },
    { name: "Housing" },
    { name: "Series" },
    { name: "Energy" },
    { name: "Metadata" },
    { name: "OpenAPI" }
  ]
};

export function renderOpenApiDocs(specUrl: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AUS Dash API Docs</title>
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <redoc spec-url="${specUrl}"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`;
}
