import { Hono } from "hono";
import { cors } from "hono/cors";
import { describeRoute, openAPIRouteHandler } from "hono-openapi";
import { registerEnergyRoutes, registerV1EnergyRoutes } from "./routes/energy-routes";
import { registerHousingRoutes } from "./routes/housing-routes";
import {
  registerMetadataRoutes,
  registerV1MetadataRoutes
} from "./routes/metadata-routes";
import {
  HEALTH_RESPONSE_SCHEMA,
  jsonError,
  jsonResponse
} from "./routes/route-contracts";
import { registerSeriesRoutes } from "./routes/series-routes";
import { OPENAPI_DOCUMENTATION, renderOpenApiDocs } from "./openapi";
import {
  createLiveDataRepository,
  type LiveDataRepository
} from "./repositories/live-data-repository";

type AppEnvironment = Record<string, string | undefined>;
type ErrorLogger = Pick<Console, "error">;

export type AppDependencies = {
  createRepository?: () => LiveDataRepository;
  env?: AppEnvironment;
  logger?: ErrorLogger;
};

function registerDocsAndHealthRoutes(api: Hono) {
  api.get(
    "/docs",
    describeRoute({
      tags: ["OpenAPI"],
      summary: "Interactive API documentation",
      responses: {
        200: {
          description: "ReDoc HTML page",
          content: {
            "text/html": {
              schema: {
                type: "string"
              }
            }
          }
        }
      }
    }),
    (c) => {
      return c.html(renderOpenApiDocs("/api/openapi.json"));
    }
  );

  api.get(
    "/health",
    describeRoute({
      tags: ["Health"],
      summary: "Service health check",
      responses: {
        200: jsonResponse("Service status", HEALTH_RESPONSE_SCHEMA)
      }
    }),
    (c) => {
      return c.json({ status: "ok", service: "aus-dash-api" });
    }
  );
}

function registerCurrentApiRoutes(
  api: Hono,
  createRepository: () => LiveDataRepository,
  env: AppEnvironment
) {
  registerDocsAndHealthRoutes(api);
  registerHousingRoutes(api, createRepository);
  registerSeriesRoutes(api, createRepository);
  registerEnergyRoutes(api, createRepository, env);
  registerMetadataRoutes(api, createRepository);
}

function registerV1Routes(v1: Hono, createRepository: () => LiveDataRepository) {
  registerV1EnergyRoutes(v1, createRepository);
  registerV1MetadataRoutes(v1);
}

export function createApp(dependencies: AppDependencies = {}) {
  const createRepository = dependencies.createRepository ?? (() => createLiveDataRepository());
  const env = dependencies.env ?? process.env;
  const logger = dependencies.logger ?? console;

  const app = new Hono();
  const api = new Hono();
  const v1 = new Hono();

  api.use("*", cors());
  registerCurrentApiRoutes(api, createRepository, env);
  registerV1Routes(v1, createRepository);
  api.route("/v1", v1);
  api.get(
    "/openapi.json",
    openAPIRouteHandler(app, {
      documentation: OPENAPI_DOCUMENTATION,
      exclude: ["/api/docs"]
    })
  );

  app.route("/api", api);

  app.notFound((c) => {
    return jsonError(c, 404, "NOT_FOUND", `Route not found: ${c.req.path}`);
  });

  app.onError((error, c) => {
    logger.error(error);
    return jsonError(c, 500, "INTERNAL_SERVER_ERROR", "Internal server error");
  });

  return app;
}

export const app = createApp();
