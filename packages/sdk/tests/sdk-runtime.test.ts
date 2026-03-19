import { describe, expect, test } from "vitest";

type RuntimeModule = {
  configureSdk?: (config?: Record<string, unknown>) => unknown;
  resetSdkConfig?: () => unknown;
  getSdkConfig?: () => Record<string, unknown>;
  getApiHealth?: () => Promise<{ data: unknown }>;
  getApiPricesMajorGoods?: (options?: Record<string, unknown>) => Promise<{ data: unknown }>;
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}

describe("@aus-dash/sdk runtime configuration", () => {
  test("applies configured baseUrl, default headers, and user agent to generated calls", async () => {
    const requests: Request[] = [];
    const sdk = (await import("../src/index.ts")) as RuntimeModule;

    expect(typeof sdk.configureSdk).toBe("function");
    expect(typeof sdk.getApiHealth).toBe("function");

    sdk.configureSdk?.({
      baseUrl: "https://sdk.example.test",
      headers: {
        "x-test-header": "phase-d"
      },
      userAgent: "aus-dash-cli/test",
      fetch: async (request: RequestInfo | URL, init?: RequestInit) => {
        const nextRequest =
          request instanceof Request ? request : new Request(request, init);
        requests.push(nextRequest);
        return jsonResponse({ status: "ok", service: "aus-dash-api" });
      }
    });

    const result = await sdk.getApiHealth?.();
    expect(result?.data).toMatchObject({ status: "ok", service: "aus-dash-api" });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://sdk.example.test/api/health");
    expect(requests[0]?.headers.get("x-test-header")).toBe("phase-d");
    expect(requests[0]?.headers.get("user-agent")).toBe("aus-dash-cli/test");
  });

  test("applies optional basic auth and exposes resettable public config state", async () => {
    const requests: Request[] = [];
    const sdk = (await import("../src/index.ts")) as RuntimeModule;

    expect(typeof sdk.configureSdk).toBe("function");
    expect(typeof sdk.resetSdkConfig).toBe("function");
    expect(typeof sdk.getSdkConfig).toBe("function");
    expect(typeof sdk.getApiPricesMajorGoods).toBe("function");

    sdk.configureSdk?.({
      baseUrl: "https://sdk.example.test",
      auth: {
        username: "agent",
        password: "buildaustralia"
      },
      fetch: async (request: RequestInfo | URL, init?: RequestInit) => {
        const nextRequest =
          request instanceof Request ? request : new Request(request, init);
        requests.push(nextRequest);
        return jsonResponse({ region: "AU", indexes: [], freshness: {} });
      }
    });

    await sdk.getApiPricesMajorGoods?.({
      query: {
        region: "AU"
      }
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers.get("authorization")).toBe(
      "Basic YWdlbnQ6YnVpbGRhdXN0cmFsaWE="
    );
    expect(sdk.getSdkConfig?.()).toMatchObject({
      baseUrl: "https://sdk.example.test",
      auth: {
        username: "agent"
      }
    });

    sdk.resetSdkConfig?.();
    expect(sdk.getSdkConfig?.()).toMatchObject({
      baseUrl: "http://localhost:3002",
      auth: null
    });
  });
});
