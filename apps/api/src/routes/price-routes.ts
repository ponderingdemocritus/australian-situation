import {
  appendPriceIntakeBatch,
  classifyUnresolvedPriceItem,
  listUnresolvedPriceItems,
  promoteUnresolvedPriceItem,
  readLiveStoreSync,
  reconcileUnresolvedPriceItem,
  writeLiveStoreSync
} from "@aus-dash/shared";
import type { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import type { LiveDataRepository } from "../repositories/live-data-contract";
import { PRICE_INDEX_SUPPORTED_REGIONS } from "./api-domain-constants";
import {
  CLASSIFY_UNRESOLVED_PRICE_ITEM_REQUEST_SCHEMA,
  CLASSIFY_UNRESOLVED_PRICE_ITEM_RESPONSE_SCHEMA,
  ERROR_RESPONSE,
  PRICE_INTAKE_BATCH_REQUEST_SCHEMA,
  PRICE_INTAKE_BATCH_RESPONSE_SCHEMA,
  PRICE_ITEM_PARAM_SCHEMA,
  PRICE_INDEX_OVERVIEW_RESPONSE_SCHEMA,
  PROMOTE_UNRESOLVED_PRICE_ITEM_RESPONSE_SCHEMA,
  RECONCILE_UNRESOLVED_PRICE_ITEM_REQUEST_SCHEMA,
  RECONCILE_UNRESOLVED_PRICE_ITEM_RESPONSE_SCHEMA,
  REGION_QUERY_SCHEMA,
  UNRESOLVED_PRICE_ITEMS_QUERY_SCHEMA,
  UNRESOLVED_PRICE_ITEMS_RESPONSE_SCHEMA,
  jsonError,
  jsonResponse
} from "./route-contracts";

const PRICES_BASIC_AUTH_PASSWORD = "buildaustralia";
const PRICES_BASIC_AUTH_REALM = 'Basic realm="AUS Dash Prices"';

function hasValidBasicAuth(headerValue: string | undefined): boolean {
  if (!headerValue || !headerValue.startsWith("Basic ")) {
    return false;
  }

  try {
    const decoded = Buffer.from(headerValue.slice(6), "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) {
      return false;
    }

    const password = decoded.slice(separatorIndex + 1);
    return password === PRICES_BASIC_AUTH_PASSWORD;
  } catch {
    return false;
  }
}

function requirePricesBasicAuth(headerValue: string | undefined) {
  return hasValidBasicAuth(headerValue);
}

function invalidStateMessage(
  action: "reconcile" | "classify" | "promote",
  unresolvedItemId: string
): string {
  switch (action) {
    case "reconcile":
      return `Unresolved item ${unresolvedItemId} cannot be reconciled after promotion`;
    case "classify":
      return `Unresolved item ${unresolvedItemId} must be reconciled before classification`;
    case "promote":
      return `Unresolved item ${unresolvedItemId} must be reconciled before promotion`;
  }
}

export function registerPriceRoutes(
  api: Hono,
  createRepository: () => LiveDataRepository
) {
  api.post(
    "/prices/intake/batches",
    describeRoute({
      tags: ["Prices"],
      summary: "Submit a batch of discovered price items",
      security: [{ basicAuth: [] }],
      responses: {
        200: jsonResponse(
          "Price intake batch queued",
          PRICE_INTAKE_BATCH_RESPONSE_SCHEMA
        ),
        401: ERROR_RESPONSE
      }
    }),
    validator("json", PRICE_INTAKE_BATCH_REQUEST_SCHEMA),
    async (c) => {
      if (!requirePricesBasicAuth(c.req.header("authorization"))) {
        c.header("WWW-Authenticate", PRICES_BASIC_AUTH_REALM);
        return jsonError(c, 401, "UNAUTHORIZED", "Basic auth is required");
      }

      const body = c.req.valid("json");
      const capturedAt = body.capturedAt ?? new Date().toISOString();
      const store = readLiveStoreSync();
      const result = appendPriceIntakeBatch(store, {
        sourceId: body.sourceId,
        capturedAt,
        items: body.items
      });
      writeLiveStoreSync(store);

      return c.json({
        batchId: result.batch.batchId,
        sourceId: result.batch.sourceId,
        queuedCount: result.unresolvedItems.length,
        unresolvedItemIds: result.unresolvedItems.map((item) => item.unresolvedItemId),
        rawSnapshotId: result.snapshot.snapshotId
      });
    }
  );

  api.get(
    "/prices/unresolved-items",
    describeRoute({
      tags: ["Prices"],
      summary: "List unresolved discovered price items",
      security: [{ basicAuth: [] }],
      responses: {
        200: jsonResponse(
          "Unresolved price intake items",
          UNRESOLVED_PRICE_ITEMS_RESPONSE_SCHEMA
        ),
        401: ERROR_RESPONSE
      }
    }),
    validator("query", UNRESOLVED_PRICE_ITEMS_QUERY_SCHEMA),
    async (c) => {
      if (!requirePricesBasicAuth(c.req.header("authorization"))) {
        c.header("WWW-Authenticate", PRICES_BASIC_AUTH_REALM);
        return jsonError(c, 401, "UNAUTHORIZED", "Basic auth is required");
      }

      const { status } = c.req.valid("query");
      const store = readLiveStoreSync();
      return c.json({
        items: listUnresolvedPriceItems(
          store,
          status === "reconciled"
            ? "reconciled"
            : status === "promoted"
              ? "promoted"
              : "open"
        )
      });
    }
  );

  api.post(
    "/prices/unresolved-items/:id/reconcile",
    describeRoute({
      tags: ["Prices"],
      summary: "Reconcile an unresolved discovered price item",
      security: [{ basicAuth: [] }],
      responses: {
        200: jsonResponse(
          "Reconciled unresolved price item",
          RECONCILE_UNRESOLVED_PRICE_ITEM_RESPONSE_SCHEMA
        ),
        401: ERROR_RESPONSE,
        409: ERROR_RESPONSE,
        404: ERROR_RESPONSE
      }
    }),
    validator("param", PRICE_ITEM_PARAM_SCHEMA),
    validator("json", RECONCILE_UNRESOLVED_PRICE_ITEM_REQUEST_SCHEMA),
    async (c) => {
      if (!requirePricesBasicAuth(c.req.header("authorization"))) {
        c.header("WWW-Authenticate", PRICES_BASIC_AUTH_REALM);
        return jsonError(c, 401, "UNAUTHORIZED", "Basic auth is required");
      }

      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const store = readLiveStoreSync();
      const result = reconcileUnresolvedPriceItem(store, id, body);
      if (result.kind === "not_found") {
        return jsonError(c, 404, "UNRESOLVED_ITEM_NOT_FOUND", `Unknown unresolved item: ${id}`);
      }
      if (result.kind === "invalid_state") {
        return jsonError(c, 409, "INVALID_ITEM_STATE", invalidStateMessage("reconcile", id));
      }

      writeLiveStoreSync(store);
      return c.json({ item: result.item });
    }
  );

  api.post(
    "/prices/unresolved-items/:id/classify",
    describeRoute({
      tags: ["Prices"],
      summary: "Classify a reconciled price item for cohort publication",
      security: [{ basicAuth: [] }],
      responses: {
        200: jsonResponse(
          "Classified unresolved price item",
          CLASSIFY_UNRESOLVED_PRICE_ITEM_RESPONSE_SCHEMA
        ),
        401: ERROR_RESPONSE,
        409: ERROR_RESPONSE,
        404: ERROR_RESPONSE
      }
    }),
    validator("param", PRICE_ITEM_PARAM_SCHEMA),
    validator("json", CLASSIFY_UNRESOLVED_PRICE_ITEM_REQUEST_SCHEMA),
    async (c) => {
      if (!requirePricesBasicAuth(c.req.header("authorization"))) {
        c.header("WWW-Authenticate", PRICES_BASIC_AUTH_REALM);
        return jsonError(c, 401, "UNAUTHORIZED", "Basic auth is required");
      }

      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const store = readLiveStoreSync();
      const result = classifyUnresolvedPriceItem(store, id, body);
      if (result.kind === "not_found") {
        return jsonError(c, 404, "UNRESOLVED_ITEM_NOT_FOUND", `Unknown unresolved item: ${id}`);
      }
      if (result.kind === "invalid_state") {
        return jsonError(c, 409, "INVALID_ITEM_STATE", invalidStateMessage("classify", id));
      }

      writeLiveStoreSync(store);
      return c.json({ item: result.item });
    }
  );

  api.post(
    "/prices/unresolved-items/:id/promote",
    describeRoute({
      tags: ["Prices"],
      summary: "Promote a reconciled price item for downstream publication",
      security: [{ basicAuth: [] }],
      responses: {
        200: jsonResponse(
          "Promoted unresolved price item",
          PROMOTE_UNRESOLVED_PRICE_ITEM_RESPONSE_SCHEMA
        ),
        401: ERROR_RESPONSE,
        409: ERROR_RESPONSE,
        404: ERROR_RESPONSE
      }
    }),
    validator("param", PRICE_ITEM_PARAM_SCHEMA),
    async (c) => {
      if (!requirePricesBasicAuth(c.req.header("authorization"))) {
        c.header("WWW-Authenticate", PRICES_BASIC_AUTH_REALM);
        return jsonError(c, 401, "UNAUTHORIZED", "Basic auth is required");
      }

      const { id } = c.req.valid("param");
      const store = readLiveStoreSync();
      const result = promoteUnresolvedPriceItem(store, id, new Date().toISOString());
      if (result.kind === "not_found") {
        return jsonError(c, 404, "UNRESOLVED_ITEM_NOT_FOUND", `Unknown unresolved item: ${id}`);
      }
      if (result.kind === "invalid_state") {
        return jsonError(c, 409, "INVALID_ITEM_STATE", invalidStateMessage("promote", id));
      }

      writeLiveStoreSync(store);
      return c.json({ item: result.item });
    }
  );

  api.get(
    "/prices/ai-deflation",
    describeRoute({
      tags: ["Prices"],
      summary: "AI-deflation cohort overview",
      security: [{ basicAuth: [] }],
      responses: {
        200: jsonResponse(
          "AI-deflation cohort payload",
          PRICE_INDEX_OVERVIEW_RESPONSE_SCHEMA
        ),
        401: ERROR_RESPONSE,
        400: ERROR_RESPONSE
      }
    }),
    validator("query", REGION_QUERY_SCHEMA),
    async (c) => {
      if (!requirePricesBasicAuth(c.req.header("authorization"))) {
        c.header("WWW-Authenticate", PRICES_BASIC_AUTH_REALM);
        return jsonError(c, 401, "UNAUTHORIZED", "Basic auth is required");
      }

      const { region } = c.req.valid("query");
      const targetRegion = region ?? "AU";
      if (!PRICE_INDEX_SUPPORTED_REGIONS.has(targetRegion)) {
        return jsonError(c, 400, "UNSUPPORTED_REGION", `Unsupported region: ${targetRegion}`);
      }

      const repository = createRepository();
      return c.json(await repository.getAiDeflationOverview(targetRegion));
    }
  );

  api.get(
    "/prices/major-goods",
    describeRoute({
      tags: ["Prices"],
      summary: "Major goods price index overview",
      security: [{ basicAuth: [] }],
      responses: {
        200: jsonResponse(
          "Major goods price index payload",
          PRICE_INDEX_OVERVIEW_RESPONSE_SCHEMA
        ),
        401: ERROR_RESPONSE,
        400: ERROR_RESPONSE
      }
    }),
    validator("query", REGION_QUERY_SCHEMA),
    async (c) => {
      if (!requirePricesBasicAuth(c.req.header("authorization"))) {
        c.header("WWW-Authenticate", PRICES_BASIC_AUTH_REALM);
        return jsonError(c, 401, "UNAUTHORIZED", "Basic auth is required");
      }

      const { region } = c.req.valid("query");
      const targetRegion = region ?? "AU";
      if (!PRICE_INDEX_SUPPORTED_REGIONS.has(targetRegion)) {
        return jsonError(c, 400, "UNSUPPORTED_REGION", `Unsupported region: ${targetRegion}`);
      }

      const repository = createRepository();
      return c.json(await repository.getPriceIndexOverview(targetRegion));
    }
  );
}
