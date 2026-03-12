type OpenApiTsConfigOverrides = {
  input?: string;
  output?: string;
};

export function createOpenApiTsConfig(overrides: OpenApiTsConfigOverrides = {}) {
  return {
    input: overrides.input ?? "../../apps/api/generated/openapi.json",
    output: overrides.output ?? "src/generated",
    plugins: [
      "@hey-api/client-fetch",
      {
        name: "@hey-api/sdk",
        operations: {
          strategy: "flat"
        }
      }
    ]
  };
}

export default createOpenApiTsConfig();
