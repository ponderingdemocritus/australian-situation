import type { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import type { LiveDataRepository } from "../repositories/live-data-contract";
import {
  ERROR_RESPONSE,
  METHODOLOGY_METADATA,
  METHODOLOGY_QUERY_SCHEMA,
  METHODOLOGY_RESPONSE_SCHEMA,
  METADATA_FRESHNESS_RESPONSE_SCHEMA,
  METADATA_SOURCES_RESPONSE_SCHEMA,
  jsonError,
  jsonResponse
} from "./route-contracts";

export function registerMetadataRoutes(
  api: Hono,
  createRepository: () => LiveDataRepository
) {
  api.get(
    "/metadata/freshness",
    describeRoute({
      tags: ["Metadata"],
      summary: "Freshness metadata for key series",
      responses: {
        200: jsonResponse(
          "Metadata freshness payload",
          METADATA_FRESHNESS_RESPONSE_SCHEMA
        )
      }
    }),
    async (c) => {
      const repository = createRepository();
      return c.json(await repository.getMetadataFreshness());
    }
  );

  api.get(
    "/metadata/sources",
    describeRoute({
      tags: ["Metadata"],
      summary: "Source provenance metadata",
      responses: {
        200: jsonResponse("Metadata sources payload", METADATA_SOURCES_RESPONSE_SCHEMA)
      }
    }),
    async (c) => {
      const repository = createRepository();
      return c.json(await repository.getMetadataSources());
    }
  );
}

export function registerV1MetadataRoutes(v1: Hono) {
  v1.get(
    "/metadata/methodology",
    describeRoute({
      tags: ["Metadata"],
      summary: "Methodology metadata by metric key",
      responses: {
        200: jsonResponse("Methodology payload", METHODOLOGY_RESPONSE_SCHEMA),
        404: ERROR_RESPONSE
      }
    }),
    validator("query", METHODOLOGY_QUERY_SCHEMA),
    (c) => {
      const { metric } = c.req.valid("query");
      const response = METHODOLOGY_METADATA[metric as keyof typeof METHODOLOGY_METADATA];
      if (!response) {
        return jsonError(c, 404, "UNKNOWN_METRIC", `Unknown metric: ${metric ?? ""}`);
      }

      return c.json(response);
    }
  );
}
