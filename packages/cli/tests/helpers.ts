import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import path from "node:path";
import { getRequestListener } from "@hono/node-server";
import { createApp } from "../../../apps/api/src/app";

export type CliResult = {
  status: number | null;
  stderr: string;
  stdout: string;
};

export type StartedServer = {
  stop: () => void;
  url: string;
};

const packageRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(packageRoot, "..", "..", "..");
const storePath = path.join(repoRoot, "data/live-store.json");

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();

    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not resolve a free TCP port"));
        return;
      }

      const { port } = address;
      probe.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

export async function startServer(): Promise<StartedServer> {
  const port = await getAvailablePort();
  process.env.AUS_DASH_STORE_PATH = storePath;
  const app = createApp({
    env: {
      ...process.env,
      AUS_DASH_STORE_PATH: storePath
    }
  });
  const server = createHttpServer(getRequestListener(app.fetch));

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return {
    stop: () => server.close(),
    url: `http://127.0.0.1:${port}`
  };
}

export function runCli(
  baseUrl: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env
): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn("bun", ["src/index.ts", "--base-url", baseUrl, ...args], {
      cwd: packageRoot,
      env: {
        ...env
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      resolve({ status, stderr, stdout });
    });
  });
}
