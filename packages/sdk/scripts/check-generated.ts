import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createOpenApiTsConfig } from "../openapi-ts.config";

const packageRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const openApiArtifactPath = path.join(repoRoot, "apps/api/generated/openapi.json");
const generatedArtifactPath = path.join(packageRoot, "src/generated");

function runCommand(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `${command} failed`);
  }
}

async function listRelativeFiles(root: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(path.join(root, prefix), { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(prefix, entry.name);
      if (entry.isDirectory()) {
        return await listRelativeFiles(root, relativePath);
      }

      return [relativePath];
    })
  );

  return files.flat().sort();
}

async function pathsMatch(leftPath: string, rightPath: string): Promise<boolean> {
  const [leftFiles, rightFiles] = await Promise.all([
    listRelativeFiles(leftPath),
    listRelativeFiles(rightPath)
  ]);

  if (JSON.stringify(leftFiles) !== JSON.stringify(rightFiles)) {
    return false;
  }

  for (const relativePath of leftFiles) {
    const [leftContent, rightContent] = await Promise.all([
      readFile(path.join(leftPath, relativePath), "utf8"),
      readFile(path.join(rightPath, relativePath), "utf8")
    ]);

    if (leftContent !== rightContent) {
      return false;
    }
  }

  return true;
}

export async function checkGeneratedArtifacts(options: {
  generatedPath?: string;
  openApiPath?: string;
} = {}) {
  const generatedPath = options.generatedPath ?? generatedArtifactPath;
  const openApiPath = options.openApiPath ?? openApiArtifactPath;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "aus-dash-sdk-check-"));

  try {
    const tempOpenApiPath = path.join(tempDir, "openapi.json");
    const tempGeneratedPath = path.join(tempDir, "generated");
    const tempConfigPath = path.join(tempDir, "openapi-ts.config.mjs");

    runCommand(
      "bun",
      ["../../apps/api/scripts/export-openapi.ts", "--output", tempOpenApiPath],
      packageRoot
    );

    const config = createOpenApiTsConfig({
      input: tempOpenApiPath,
      output: tempGeneratedPath
    });
    await writeFile(tempConfigPath, `export default ${JSON.stringify(config, null, 2)};\n`, "utf8");
    runCommand("bunx", ["openapi-ts", "-f", tempConfigPath], packageRoot);

    const issues: string[] = [];
    const [currentOpenApi, expectedOpenApi, generatedMatches] = await Promise.all([
      readFile(tempOpenApiPath, "utf8"),
      readFile(openApiPath, "utf8"),
      pathsMatch(tempGeneratedPath, generatedPath)
    ]);

    if (currentOpenApi !== expectedOpenApi) {
      issues.push("OpenAPI export is stale. Run `bun run api:openapi:export`.");
    }

    if (!generatedMatches) {
      issues.push("SDK generated artifacts are stale. Run `bun run sdk:generate`.");
    }

    return issues;
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function main() {
  const issues = await checkGeneratedArtifacts();
  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(issue);
    }
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await main();
}
