import spec from "../../../generated/openapi.json";

type OpenApiParam = {
  name: string;
  in: string;
  description?: string;
  required?: boolean;
  schema?: { type?: string };
};

type OpenApiOperation = {
  tags?: string[];
  operationId?: string;
  parameters?: OpenApiParam[];
  responses?: Record<string, { description?: string; content?: Record<string, { schema?: { $ref?: string } }> }>;
  security?: Record<string, unknown[]>[];
};

export type EndpointInfo = {
  method: string;
  path: string;
  operationId: string;
  domain: string;
  parameters: { name: string; in: string; description: string; required: boolean; type: string }[];
  responseSchema: string | null;
  requiresAuth: boolean;
};

export type EndpointGroup = {
  domain: string;
  endpoints: EndpointInfo[];
};

function extractDomain(tags: string[] | undefined): string {
  if (!tags || tags.length === 0) return "other";
  const tag = tags[0];
  const match = tag.match(/::(\w+)$/);
  return match ? match[1] : tag;
}

function extractResponseSchema(
  responses: OpenApiOperation["responses"]
): string | null {
  const ok = responses?.["200"];
  if (!ok?.content) return null;
  const json = ok.content["application/json"];
  if (!json?.schema?.$ref) return null;
  return json.schema.$ref.replace("#/components/schemas/", "");
}

export function parseOpenApiSpec(): {
  groups: EndpointGroup[];
  endpointCount: number;
  schemaCount: number;
  version: string;
  title: string;
  description: string;
} {
  const paths = spec.paths as Record<string, Record<string, OpenApiOperation>>;
  const endpoints: EndpointInfo[] = [];

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      endpoints.push({
        method: method.toUpperCase(),
        path,
        operationId: operation.operationId ?? "unknown",
        domain: extractDomain(operation.tags),
        parameters: (operation.parameters ?? []).map((p) => ({
          name: p.name,
          in: p.in,
          description: p.description ?? "",
          required: p.required ?? false,
          type: p.schema?.type ?? "string",
        })),
        responseSchema: extractResponseSchema(operation.responses),
        requiresAuth: Array.isArray(operation.security) && operation.security.length > 0,
      });
    }
  }

  const groupMap = new Map<string, EndpointInfo[]>();
  for (const ep of endpoints) {
    const existing = groupMap.get(ep.domain) ?? [];
    existing.push(ep);
    groupMap.set(ep.domain, existing);
  }

  const domainOrder = ["health", "energy", "housing", "oil", "prices", "series", "metadata"];
  const groups = [...groupMap.entries()]
    .sort(([a], [b]) => {
      const ai = domainOrder.indexOf(a);
      const bi = domainOrder.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    })
    .map(([domain, eps]) => ({ domain, endpoints: eps }));

  const schemaCount = Object.keys(
    (spec.components as { schemas?: Record<string, unknown> })?.schemas ?? {}
  ).length;

  return {
    groups,
    endpointCount: endpoints.length,
    schemaCount,
    version: spec.info.version,
    title: spec.info.title,
    description: spec.info.description,
  };
}
