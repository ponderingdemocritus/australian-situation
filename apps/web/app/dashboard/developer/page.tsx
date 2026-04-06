import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@aus-dash/ui";
import { DashboardFrame } from "../../../features/site/components/dashboard-frame";
import {
  parseOpenApiSpec,
  type EndpointInfo,
} from "../../../lib/openapi-parser";

export const dynamic = "force-dynamic";

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    POST: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    PUT: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    DELETE: "bg-red-500/15 text-red-700 dark:text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${colors[method] ?? "bg-muted text-muted-foreground"}`}
    >
      {method}
    </span>
  );
}

function AuthBadge() {
  return (
    <span className="inline-flex items-center rounded-md bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-400">
      Auth
    </span>
  );
}

function ParamTable({
  parameters,
}: {
  parameters: EndpointInfo["parameters"];
}) {
  if (parameters.length === 0) return null;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Parameter</th>
            <th className="pb-2 pr-4 font-medium">In</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((p) => (
            <tr key={`${p.in}-${p.name}`} className="border-b last:border-0">
              <td className="py-1.5 pr-4 font-mono text-xs">
                {p.name}
                {p.required && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </td>
              <td className="py-1.5 pr-4 text-xs text-muted-foreground">
                {p.in}
              </td>
              <td className="py-1.5 pr-4 font-mono text-xs text-muted-foreground">
                {p.type}
              </td>
              <td className="py-1.5 text-xs text-muted-foreground">
                {p.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CurlExample({ endpoint }: { endpoint: EndpointInfo }) {
  const base = "${API_BASE}";
  const params = endpoint.parameters
    .filter((p) => p.in === "query")
    .slice(0, 2);
  const queryString =
    params.length > 0
      ? `?${params.map((p) => `${p.name}=...`).join("&")}`
      : "";
  const path = endpoint.path.replace("{id}", ":id");
  return (
    <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">
      <code>{`curl ${base}${path}${queryString}`}</code>
    </pre>
  );
}

function SdkExample({ endpoint }: { endpoint: EndpointInfo }) {
  const fnName = endpoint.operationId.replace(/_([a-z])/g, (_, c: string) =>
    c.toUpperCase()
  );
  const hasQuery = endpoint.parameters.some((p) => p.in === "query");
  const hasPath = endpoint.parameters.some((p) => p.in === "path");

  let options = "";
  if (hasQuery || hasPath) {
    const parts: string[] = [];
    if (hasPath) parts.push(`path: { id: "..." }`);
    if (hasQuery) parts.push(`query: { region: "AU" }`);
    options = `{ ${parts.join(", ")} }`;
  }

  return (
    <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">
      <code>{`import { ${fnName} } from "@aus-dash/sdk";\n\nconst { data } = await ${fnName}(${options});`}</code>
    </pre>
  );
}

function EndpointCard({ endpoint }: { endpoint: EndpointInfo }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <MethodBadge method={endpoint.method} />
          <code className="text-sm font-semibold">{endpoint.path}</code>
          {endpoint.requiresAuth && <AuthBadge />}
        </div>
        {endpoint.responseSchema && (
          <CardDescription className="mt-1 font-mono text-xs">
            {endpoint.responseSchema}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <ParamTable parameters={endpoint.parameters} />

        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">
              curl
            </div>
            <CurlExample endpoint={endpoint} />
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">
              SDK
            </div>
            <SdkExample endpoint={endpoint} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DeveloperPage() {
  const { groups, endpointCount, schemaCount, version, title, description } =
    parseOpenApiSpec();

  return (
    <DashboardFrame
      eyebrow="Developer"
      title="API Reference"
      summary={`${title} v${version} — ${endpointCount} endpoints, ${schemaCount} schemas. Auto-generated from OpenAPI spec.`}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{endpointCount}</div>
            <div className="text-sm text-muted-foreground">Endpoints</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{schemaCount}</div>
            <div className="text-sm text-muted-foreground">Schemas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold font-mono">v{version}</div>
            <div className="text-sm text-muted-foreground">API Version</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick start</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">
              Install SDK
            </div>
            <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">
              <code>npm install @aus-dash/sdk</code>
            </pre>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">
              Configure client
            </div>
            <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">
              <code>{`import { client } from "@aus-dash/sdk";\n\nclient.setConfig({ baseUrl: "https://api.example.com" });`}</code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {groups.map((group) => (
        <section key={group.domain} className="space-y-3">
          <h2 className="text-lg font-semibold capitalize tracking-tight">
            {group.domain}
          </h2>
          {group.endpoints.map((ep) => (
            <EndpointCard
              key={`${ep.method}-${ep.path}`}
              endpoint={ep}
            />
          ))}
        </section>
      ))}
    </DashboardFrame>
  );
}
