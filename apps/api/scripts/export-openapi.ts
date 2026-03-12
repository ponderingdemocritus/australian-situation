import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { app } from "../src/app";

export const DEFAULT_OPENAPI_EXPORT_PATH = path.resolve(
  import.meta.dirname,
  "../generated/openapi.json"
);

function parseOutputPath(args: string[]): string {
  const outputFlagIndex = args.findIndex((argument) => argument === "--output");
  if (outputFlagIndex >= 0) {
    const outputPath = args[outputFlagIndex + 1];
    if (!outputPath) {
      throw new Error("Missing value for --output");
    }

    return path.resolve(process.cwd(), outputPath);
  }

  return DEFAULT_OPENAPI_EXPORT_PATH;
}

async function exportOpenApiDocument(outputPath: string) {
  const response = await app.request("http://api.local/api/openapi.json");
  if (!response.ok) {
    throw new Error(`OpenAPI export failed with status ${response.status}`);
  }

  const document = await response.json();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

async function main() {
  const outputPath = parseOutputPath(process.argv.slice(2));
  await exportOpenApiDocument(outputPath);
  console.log(outputPath);
}

if (import.meta.main) {
  await main();
}

export { exportOpenApiDocument };
