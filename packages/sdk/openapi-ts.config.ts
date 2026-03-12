export default {
  input: "../../apps/api/generated/openapi.json",
  output: "src/generated",
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
