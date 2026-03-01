import type { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import type { LiveDataRepository } from "../repositories/live-data-contract";
import {
  HOUSING_OVERVIEW_RESPONSE_SCHEMA,
  REGION_QUERY_SCHEMA,
  jsonResponse
} from "./route-contracts";

export function registerHousingRoutes(
  api: Hono,
  createRepository: () => LiveDataRepository
) {
  api.get(
    "/housing/overview",
    describeRoute({
      tags: ["Housing"],
      summary: "Housing metrics overview",
      responses: {
        200: jsonResponse("Housing overview payload", HOUSING_OVERVIEW_RESPONSE_SCHEMA)
      }
    }),
    validator("query", REGION_QUERY_SCHEMA),
    async (c) => {
      const { region } = c.req.valid("query");
      const repository = createRepository();
      const overview = await repository.getHousingOverview(region ?? "AU");
      return c.json(overview);
    }
  );
}
