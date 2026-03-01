import type { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { LiveDataRepository } from "../repositories/live-data-contract";
import { SeriesRepositoryError } from "../repositories/series-repository-error";
import {
  ERROR_RESPONSE,
  SERIES_PARAM_SCHEMA,
  SERIES_QUERY_SCHEMA,
  SERIES_RESPONSE_SCHEMA,
  jsonError,
  jsonResponse
} from "./route-contracts";

export function registerSeriesRoutes(
  api: Hono,
  createRepository: () => LiveDataRepository
) {
  api.get(
    "/series/:id",
    describeRoute({
      tags: ["Series"],
      summary: "Get series points by id",
      responses: {
        200: jsonResponse("Series points payload", SERIES_RESPONSE_SCHEMA),
        400: ERROR_RESPONSE,
        404: ERROR_RESPONSE
      }
    }),
    validator("param", SERIES_PARAM_SCHEMA),
    validator("query", SERIES_QUERY_SCHEMA),
    async (c) => {
      const { id } = c.req.valid("param");
      const { region, from, to } = c.req.valid("query");
      const repository = createRepository();

      try {
        const result = await repository.getSeries({
          seriesId: id,
          region: region ?? "AU",
          from,
          to
        });
        return c.json(result);
      } catch (error) {
        if (error instanceof SeriesRepositoryError) {
          return jsonError(
            c,
            error.status as ContentfulStatusCode,
            error.code,
            error.message
          );
        }

        throw error;
      }
    }
  );
}
